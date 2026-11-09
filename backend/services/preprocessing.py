"""
Signal Preprocessing & Window Segmentation Service
==================================================
Implements Step 2 & Step 3 of the scientific pipeline:
- Missing value interpolation
- DC component removal per window: x'[n] = x[n] - mean(x) (Wang et al., 2024, Section 4.1 Step 1)
- Sliding window segmentation with configurable sampling rate, window size, and stride.

[INTEGRATION POINT]:
Replace `preprocess_and_segment_signal` with your existing Python windowing function
if your repository uses custom window labeling or filtering rules.
"""

from typing import List, Dict, Any, Optional, Tuple
import numpy as np
import pandas as pd


def preprocess_and_segment_signal(
    signal: np.ndarray,
    labels: Optional[np.ndarray] = None,
    sampling_rate: float = 10.0,
    window_size: int = 100,
    window_stride: int = 100,
) -> List[Dict[str, Any]]:
    """
    Segments a 1D network traffic signal into windows and removes the DC part
    from each window prior to time-frequency transformation.

    Default research configuration:
    - sampling_rate: 10 Hz
    - window_size: 100 samples (10 seconds duration)
    - window_stride: 100 samples (non-overlapping windows)
    """
    # 1. Clean NaN / Inf values via linear interpolation
    s = pd.Series(signal, dtype=float).interpolate(method="linear").bfill().ffill().fillna(0.0).to_numpy()

    n_samples = len(s)
    if n_samples < window_size:
        raise ValueError(
            f"Signal length ({n_samples} samples) is shorter than the configured window size ({window_size})."
        )

    windows: List[Dict[str, Any]] = []
    win_idx = 0

    for start in range(0, n_samples - window_size + 1, window_stride):
        end = start + window_size
        raw_segment = s[start:end]

        # Wang et al. (2024) Section 4.1 (1):
        # "Preprocess the network traffic to remove the DC part in the traffic."
        dc_removed = raw_segment - np.mean(raw_segment)

        # Determine window label if ground-truth sample labels are provided
        win_label: Optional[int] = None
        if labels is not None:
            seg_labels = labels[start:end]
            valid_labels = seg_labels[seg_labels >= 0]
            if len(valid_labels) > 0:
                # If LDoS burst samples are present in the window (majority or pulse threshold >= 20%)
                ldos_ratio = float(np.mean(valid_labels == 1))
                win_label = 1 if ldos_ratio >= 0.25 else 0

        windows.append(
            {
                "window_index": win_idx,
                "start_sample": int(start),
                "end_sample": int(end),
                "start_time": round(start / sampling_rate, 2),
                "end_time": round(end / sampling_rate, 2),
                "raw_signal": raw_segment,
                "preprocessed_signal": dc_removed,
                "label": win_label,
            }
        )
        win_idx += 1

    return windows
