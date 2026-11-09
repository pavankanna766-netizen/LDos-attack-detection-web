"""
Scientific Visualization & Artifact Export Service
==================================================
Generates matplotlib figures and downloadable CSV artifacts for:
- Time-domain traffic signal (Normal Status NS vs LDoS Attack Status LS)
- 2D Time-Frequency distributions (FSWT, STFT Spectrogram, CWT Scalogram)
- Extracted feature trajectories (Entropy, Energy Ratio, Contrast, Correlation, Spectral Centroid, Kurtosis)
- Confusion matrix & classification results CSV

[INTEGRATION POINT]:
Replace or extend `save_time_frequency_plot` to use your existing matplotlib plotting scripts.
"""

import os
from typing import Dict, Any, List
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt


def save_time_frequency_plot(
    M: np.ndarray,
    times: np.ndarray,
    freqs: np.ndarray,
    title: str,
    output_path: str,
) -> str:
    """Renders and saves a 2D time-frequency energy distribution heatmap using matplotlib."""
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    fig, ax = plt.subplots(figsize=(8, 4.5), dpi=150)
    im = ax.imshow(
        M.T,
        aspect="auto",
        origin="lower",
        extent=[float(times[0]), float(times[-1]), float(freqs[0]), float(freqs[-1])],
        cmap="viridis",
    )
    ax.set_title(title, fontsize=11, fontweight="bold")
    ax.set_xlabel("Time (Sec.)")
    ax.set_ylabel("Frequency (Hz)")
    fig.colorbar(im, ax=ax, label="Amplitude")
    fig.tight_layout()
    fig.savefig(output_path)
    plt.close(fig)
    return output_path


def export_predictions_csv(windows: List[Dict[str, Any]], output_path: str) -> str:
    """Saves per-window predictions, true labels, confidences, and extracted features to CSV."""
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    rows = []
    for w in windows:
        row = {
            "window_index": w["window_index"],
            "start_time_s": w["start_time"],
            "end_time_s": w["end_time"],
            "prediction": w.get("prediction", 0),
            "predicted_class": "LDoS Attack (1)" if w.get("prediction", 0) == 1 else "Normal Traffic (0)",
            "true_label": w.get("label", ""),
            "confidence": w.get("confidence", 1.0),
        }
        if "features" in w:
            row.update(w["features"])
        rows.append(row)
    pd.DataFrame(rows).to_csv(output_path, index=False)
    return output_path
