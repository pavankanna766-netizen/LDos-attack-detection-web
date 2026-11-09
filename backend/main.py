"""
LDoS Attack Detector — Modular Python FastAPI Backend
=====================================================
Reference Methodology:
Wang et al. (2024), "An LDoS attack detection method based on FSWT time-frequency distribution",
Expert Systems With Applications, 256, 125006.

Run locally with:
    pip install -r backend/requirements.txt
    uvicorn backend.main:app --reload --port 8000
"""

import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.routers import detection

os.makedirs("backend/uploads", exist_ok=True)
os.makedirs("backend/results", exist_ok=True)

app = FastAPI(
    title="LDoS Attack Detector API",
    description=(
        "Low-Rate Denial-of-Service (LDoS) Attack Detection using Frequency Slice "
        "Wavelet Transform (FSWT), Signal Processing, and Machine Learning."
    ),
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(detection.router, prefix="/api", tags=["LDoS Detection Pipeline"])


@app.get("/api/health")
def health_check():
    return {
        "status": "ok",
        "service": "LDoS Attack Detector Scientific Pipeline",
        "reference": "Wang et al. (2024) - FSWT Time-Frequency Distribution",
    }
