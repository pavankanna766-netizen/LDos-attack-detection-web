"""
Time-Frequency Feature Extraction Service
=========================================
Implements Section 4.2.3 of Wang et al. (2024):
Extracts features from the 2D time-frequency distribution matrix M_ij:
1. Entropy (En)         — Eq. (3): En = - sum_i sum_j M_ij * log(M_ij)
2. Energy Ratio (RE)    — Eq. (4): Ratio of low-frequency (first 1/5 band) energy to total energy
3. Contrast (Con)       — Eq. (5): Con = sum_i sum_j (i - j)^2 * M_ij
4. Correlation (Cor)    — Eq. (6): (sum_i sum_j i*j*M_ij - mu_1*mu_2) / (sigma_1^2 * sigma_2^2)

Extended 6-feature set adds:
5. Spectral Centroid    — Center of mass of the frequency spectrum
6. Kurtosis             — Fourth standardized moment measuring impulsive burstiness

[INTEGRATION POINT]:
Replace or extend `extract_window_features` with your existing Python feature extraction code.
"""

from typing import Dict
import numpy as np
from scipy.stats import kurtosis as sp_kurtosis


def extract_window_features(
    M: np.ndarray,
    raw_signal: np.ndarray,
    freqs: np.ndarray,
    feature_set: str = "original_4",
) -> Dict[str, float]:
    """
    Computes the 4 research paper features (or 6 extended features) from M_ij.
    """
    eps = 1e-12
    M_abs = np.abs(M)
    total_sum = float(np.sum(M_abs)) + eps
    P = M_abs / total_sum  # Normalized distribution for stable entropy & moments

    n_rows, n_cols = M_abs.shape

    # 1. Entropy (Eq. 3): En = - sum_i sum_j P_ij log(P_ij)
    P_safe = np.clip(P, eps, None)
    entropy = float(-np.sum(P_safe * np.log(P_safe)))

    # 2. Ratio of Energy (Eq. 4):
    # Low-frequency part refers to the first 1/5 of the observation frequency
    low_freq_bins = max(1, n_cols // 5)
    M_sq = M_abs ** 2
    low_freq_energy = float(np.sum(M_sq[:, :low_freq_bins]))
    total_energy = float(np.sum(M_sq)) + eps
    energy_ratio = low_freq_energy / total_energy

    # 3. Contrast (Eq. 5): Con = sum_i sum_j (i - j)^2 M_ij
    # Normalized indices to keep scale consistent across window sizes
    i_idx = np.arange(n_rows, dtype=float)[:, None]
    j_idx = np.arange(n_cols, dtype=float)[None, :]
    contrast = float(np.sum(((i_idx - j_idx) ** 2) * P))

    # 4. Correlation (Eq. 6):
    # mu_1 = sum_i i sum_j M_ij,  mu_2 = sum_j j sum_i M_ij
    row_marginal = np.sum(P, axis=1)
    col_marginal = np.sum(P, axis=0)
    i_vec = np.arange(n_rows, dtype=float)
    j_vec = np.arange(n_cols, dtype=float)

    mu_1 = float(np.sum(i_vec * row_marginal))
    mu_2 = float(np.sum(j_vec * col_marginal))
    sigma_1_sq = float(np.sum(((i_vec - mu_1) ** 2) * row_marginal)) + eps
    sigma_2_sq = float(np.sum(((j_vec - mu_2) ** 2) * col_marginal)) + eps

    ij_sum = float(np.sum((i_idx * j_idx) * P))
    correlation = (ij_sum - mu_1 * mu_2) / (np.sqrt(sigma_1_sq * sigma_2_sq) + eps)

    features: Dict[str, float] = {
        "entropy": round(entropy, 6),
        "energy_ratio": round(energy_ratio, 6),
        "contrast": round(contrast, 6),
        "correlation": round(correlation, 6),
    }

    if feature_set == "extended_6":
        # 5. Spectral Centroid
        spec_profile = np.mean(M_abs, axis=0)
        freq_axis = freqs if len(freqs) == n_cols else np.linspace(0, 5.0, n_cols)
        spectral_centroid = float(np.sum(freq_axis * spec_profile) / (np.sum(spec_profile) + eps))

        # 6. Kurtosis of the window signal
        kurt_val = float(sp_kurtosis(raw_signal, fisher=False, bias=False)) if len(raw_signal) > 3 else 3.0

        features["spectral_centroid"] = round(spectral_centroid, 6)
        features["kurtosis"] = round(kurt_val, 6)

    return features
