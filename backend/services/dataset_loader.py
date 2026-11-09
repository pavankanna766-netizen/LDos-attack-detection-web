"""
Dataset Loader & Validator Service
==================================
Handles loading, schema inspection, and validation for:
- MODE A: Single labelled CSV containing traffic signal and class label (0 = Normal, 1 = LDoS)
- MODE B: Two separate CSV files (Normal Traffic CSV + LDoS Attack CSV)

[INTEGRATION POINT]:
If your existing Python project has a custom PCAP/CSV parser or dataset loader,
replace or call it inside `load_and_validate_single_csv` or `load_and_merge_dual_csv`.
"""

from typing import Dict, Any, List, Optional, Tuple
import pandas as pd
import numpy as np


def inspect_csv_columns(df: pd.DataFrame) -> Dict[str, Any]:
    """Heuristic detection of candidate signal and label columns in an arbitrary CSV."""
    columns = list(df.columns)
    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()

    # Candidate signal column heuristics
    signal_keywords = ["traffic", "signal", "packets", "bytes", "rate", "throughput", "amplitude", "value", "flow"]
    suggested_signal = numeric_cols[0] if numeric_cols else (columns[0] if columns else "")
    for col in numeric_cols:
        if any(k in col.lower() for k in signal_keywords):
            suggested_signal = col
            break

    # Candidate label column heuristics
    label_keywords = ["label", "class", "attack", "status", "target", "is_ldos", "y"]
    suggested_label: Optional[str] = None
    for col in columns:
        if any(k in col.lower() for k in label_keywords):
            suggested_label = col
            break

    return {
        "columns": columns,
        "numeric_columns": numeric_cols,
        "suggested_signal_column": suggested_signal,
        "suggested_label_column": suggested_label,
    }


def validate_dataset(
    df: pd.DataFrame,
    signal_column: str,
    label_column: Optional[str] = None,
    filename: str = "dataset.csv",
) -> Dict[str, Any]:
    """
    Validates the selected signal and label columns and returns a comprehensive
    Dataset Summary prior to signal processing.
    """
    if signal_column not in df.columns:
        raise ValueError(f"Selected signal column '{signal_column}' not found in dataset.")

    signal_series = pd.to_numeric(df[signal_column], errors="coerce")
    missing_values = int(signal_series.isna().sum())

    class_distribution = {"normal": 0, "ldos": 0, "unlabelled": len(df)}
    has_labels = False

    if label_column and label_column in df.columns:
        has_labels = True
        raw_labels = df[label_column]
        # Map common string/numeric representations to 0 (Normal) and 1 (LDoS)
        mapped = raw_labels.apply(_normalize_label)
        normal_count = int((mapped == 0).sum())
        ldos_count = int((mapped == 1).sum())
        class_distribution = {
            "normal": normal_count,
            "ldos": ldos_count,
            "unlabelled": int(len(df) - normal_count - ldos_count),
        }

    return {
        "filename": filename,
        "num_rows": int(len(df)),
        "num_columns": int(len(df.columns)),
        "columns": list(df.columns),
        "selected_signal_column": signal_column,
        "selected_label_column": label_column if has_labels else None,
        "missing_values": missing_values,
        "class_distribution": class_distribution,
        "signal_stats": {
            "min": float(signal_series.min()) if len(signal_series.dropna()) > 0 else 0.0,
            "max": float(signal_series.max()) if len(signal_series.dropna()) > 0 else 0.0,
            "mean": float(signal_series.mean()) if len(signal_series.dropna()) > 0 else 0.0,
            "std": float(signal_series.std()) if len(signal_series.dropna()) > 0 else 0.0,
        },
    }


def merge_dual_datasets(
    normal_df: pd.DataFrame,
    ldos_df: pd.DataFrame,
    signal_column: str,
) -> Tuple[pd.DataFrame, str]:
    """
    MODE B: Combines separate Normal Traffic (label=0) and LDoS Attack (label=1) CSVs
    into a unified DataFrame for windowing and supervised evaluation.
    """
    normal_copy = normal_df.copy()
    ldos_copy = ldos_df.copy()
    normal_copy["label"] = 0
    ldos_copy["label"] = 1
    combined = pd.concat([normal_copy, ldos_copy], ignore_index=True)
    return combined, "label"


def _normalize_label(val: Any) -> int:
    if pd.isna(val):
        return -1
    if isinstance(val, (int, float, np.number)):
        return 1 if float(val) >= 0.5 else 0
    s = str(val).strip().lower()
    if s in ("1", "ldos", "attack", "ls", "true", "malicious", "abnormal"):
        return 1
    if s in ("0", "normal", "ns", "false", "benign", "legitimate"):
        return 0
    return -1
