"""
FastAPI Router for the LDoS Attack Detection Pipeline
=====================================================
Exposes the required REST endpoints:
- POST /api/upload
- POST /api/validate-dataset
- POST /api/run-detection
- GET  /api/results/{job_id}
- GET  /api/results/{job_id}/metrics
- GET  /api/results/{job_id}/visualizations
- GET  /api/download/{job_id}/{file}
"""

import uuid
import os
from typing import Dict, Any, Optional
import pandas as pd
import numpy as np
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel

from backend.services.dataset_loader import inspect_csv_columns, validate_dataset, merge_dual_datasets
from backend.services.preprocessing import preprocess_and_segment_signal
from backend.services.transforms import apply_transform
from backend.services.feature_extraction import extract_window_features
from backend.services.ml_classifier import train_and_evaluate_classifier

router = APIRouter()

# In-memory session and job stores
UPLOAD_SESSIONS: Dict[str, Dict[str, Any]] = {}
JOBS: Dict[str, Dict[str, Any]] = {}


class ValidateRequest(BaseModel):
    dataset_id: str
    signal_column: str
    label_column: Optional[str] = None
    sampling_rate: float = 10.0
    window_size: int = 100
    window_stride: int = 100


class RunDetectionRequest(BaseModel):
    dataset_id: str
    signal_column: str
    label_column: Optional[str] = None
    sampling_rate: float = 10.0
    window_size: int = 100
    window_stride: int = 100
    transform: str = "FSWT"
    feature_set: str = "original_4"
    model: str = "decision_tree"
    split_strategy: str = "stratified"
    test_size: float = 0.30
    random_state: int = 42


@router.post("/upload")
async def upload_dataset(
    mode: str = Form("single"),
    file: Optional[UploadFile] = File(None),
    normal_file: Optional[UploadFile] = File(None),
    ldos_file: Optional[UploadFile] = File(None),
):
    dataset_id = str(uuid.uuid4())
    if mode == "single":
        if not file:
            raise HTTPException(status_code=400, detail="CSV file is required for Mode A.")
        df = pd.read_csv(file.file)
        filename = file.filename or "uploaded_dataset.csv"
    else:
        if not normal_file or not ldos_file:
            raise HTTPException(status_code=400, detail="Both Normal and LDoS CSV files are required for Mode B.")
        df_norm = pd.read_csv(normal_file.file)
        df_ldos = pd.read_csv(ldos_file.file)
        info_norm = inspect_csv_columns(df_norm)
        df, _ = merge_dual_datasets(df_norm, df_ldos, info_norm["suggested_signal_column"])
        filename = f"{normal_file.filename} + {ldos_file.filename}"

    schema_info = inspect_csv_columns(df)
    UPLOAD_SESSIONS[dataset_id] = {"df": df, "filename": filename, "mode": mode}

    summary = validate_dataset(
        df,
        signal_column=schema_info["suggested_signal_column"],
        label_column=schema_info["suggested_label_column"],
        filename=filename,
    )
    return {"dataset_id": dataset_id, "schema": schema_info, "summary": summary}


@router.post("/validate-dataset")
def validate_dataset_endpoint(req: ValidateRequest):
    session = UPLOAD_SESSIONS.get(req.dataset_id)
    if not session:
        raise HTTPException(status_code=404, detail="Dataset session not found.")
    summary = validate_dataset(
        session["df"],
        signal_column=req.signal_column,
        label_column=req.label_column,
        filename=session["filename"],
    )
    return {"dataset_id": req.dataset_id, "summary": summary}


@router.post("/run-detection")
def run_detection(req: RunDetectionRequest):
    session = UPLOAD_SESSIONS.get(req.dataset_id)
    if not session:
        raise HTTPException(status_code=404, detail="Dataset session not found.")

    df: pd.DataFrame = session["df"]
    signal_arr = pd.to_numeric(df[req.signal_column], errors="coerce").to_numpy()
    labels_arr = None
    if req.label_column and req.label_column in df.columns:
        labels_arr = pd.to_numeric(df[req.label_column], errors="coerce").fillna(0).astype(int).to_numpy()

    windows = preprocess_and_segment_signal(
        signal_arr,
        labels=labels_arr,
        sampling_rate=req.sampling_rate,
        window_size=req.window_size,
        window_stride=req.window_stride,
    )

    feature_names = (
        ["entropy", "energy_ratio", "contrast", "correlation"]
        if req.feature_set == "original_4"
        else ["entropy", "energy_ratio", "contrast", "correlation", "spectral_centroid", "kurtosis"]
    )

    X_list = []
    y_list = []
    for w in windows:
        M, times, freqs = apply_transform(w["preprocessed_signal"], req.transform, req.sampling_rate)
        feats = extract_window_features(M, w["preprocessed_signal"], freqs, req.feature_set)
        w["features"] = feats
        X_list.append([feats[k] for k in feature_names])
        y_list.append(w["label"] if w["label"] is not None else 0)

    X = np.array(X_list, dtype=float)
    y = np.array(y_list, dtype=int)

    ml_res = train_and_evaluate_classifier(
        X, y, feature_names, req.model, req.split_strategy, req.test_size, req.random_state
    )

    job_id = str(uuid.uuid4())
    JOBS[job_id] = {
        "job_id": job_id,
        "config": req.model_dump(),
        "metrics": ml_res["metrics"],
        "predictions": ml_res["predictions"],
        "confidences": ml_res["confidences"],
    }
    return JOBS[job_id]


@router.get("/results/{job_id}")
def get_results(job_id: str):
    if job_id not in JOBS:
        raise HTTPException(status_code=404, detail="Job not found.")
    return JOBS[job_id]


@router.get("/results/{job_id}/metrics")
def get_metrics(job_id: str):
    if job_id not in JOBS:
        raise HTTPException(status_code=404, detail="Job not found.")
    return JOBS[job_id]["metrics"]
