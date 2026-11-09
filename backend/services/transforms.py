"""
Time-Frequency Signal Transforms Service (FSWT, STFT, CWT)
==========================================================
Implements Section 4.1 of Wang et al. (2024):
Frequency Slice Wavelet Transform (FSWT):
    W(t, i) = lambda * F^{-1} { F{X} .* P_i },  i = 0, 1, ..., N-1   (Eq. 1)
where:
- F is the Fourier Transform and F^{-1} is the Inverse Fourier Transform
- P_i is the i-th Frequency Slicing Sequence (FSC) discretized from the
  Frequency Slice Function (FSF): p_hat(omega) = exp(-0.5 * omega^2)
- Default parameters in paper:
    lambda = 1.0
    eta = 0.05 (frequency resolution ratio)
    upsilon = 0.5 (expected response ratio of FSWT amplitude)
    kappa = 23.5482

Also provides comparative transforms:
- STFT (Short-Time Fourier Transform)
- CWT (Continuous Wavelet Transform with Morlet wavelet basis)

[INTEGRATION POINT]:
You can drop your existing `fswt()`, `stft_transform()`, or `cwt_transform()` functions
directly into this module.
"""

from typing import Tuple
import numpy as np
from scipy import signal as sp_signal


def compute_fswt(
    x: np.ndarray,
    sampling_rate: float = 10.0,
    lam: float = 1.0,
    eta: float = 0.05,
    upsilon: float = 0.5,
    kappa: float = 23.5482,
) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    """
    Computes the Frequency Slice Wavelet Transform (FSWT) time-frequency energy
    distribution matrix M_ij for a discrete window sequence X of length N.

    Returns:
        M: 2D numpy array of shape (N_time, N_freq) representing |W(t, f)|
        times: 1D array of time points (seconds)
        freqs: 1D array of positive observation frequencies (Hz)
    """
    N = len(x)
    X_fft = np.fft.fft(x)

    # Positive frequency bins up to Nyquist (N // 2)
    n_freq = max(8, N // 2)
    freqs = np.linspace(0, sampling_rate / 2.0, n_freq)
    times = np.arange(N) / sampling_rate

    W = np.zeros((N, n_freq), dtype=float)
    freq_indices = np.arange(N)

    for i in range(n_freq):
        # Scale parameter sigma_i proportional to frequency slice width
        # Following Yan et al. (2009) & Wang et al. (2024) Eq. (1)-(2)
        scale_sigma = max(1.0, (i + 1) / (kappa * eta))
        dist = freq_indices - i
        # Wrap around periodic FFT indices
        dist = np.minimum(np.abs(dist), N - np.abs(dist))
        omega = dist / scale_sigma
        # Gaussian Frequency Slice Function: p_hat(omega) = exp(-0.5 * omega^2)
        P_i = np.exp(-0.5 * (omega ** 2))
        slice_time = lam * np.fft.ifft(X_fft * P_i)
        W[:, i] = np.abs(slice_time)

    return W, times, freqs


def compute_stft(
    x: np.ndarray,
    sampling_rate: float = 10.0,
) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    """
    Computes the Short-Time Fourier Transform (STFT) spectrogram distribution M_ij.
    """
    N = len(x)
    nperseg = min(32, max(8, N // 4))
    noverlap = nperseg // 2
    f, t, Zxx = sp_signal.stft(x, fs=sampling_rate, window="hamming", nperseg=nperseg, noverlap=noverlap)
    # Transpose so shape is (time_bins, freq_bins) matching M_ij convention
    M = np.abs(Zxx).T
    return M, t, f


def compute_cwt(
    x: np.ndarray,
    sampling_rate: float = 10.0,
) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    """
    Computes the Continuous Wavelet Transform (CWT) scalogram distribution M_ij
    using a Morlet wavelet basis across frequency scales.
    """
    N = len(x)
    n_scales = max(8, min(32, N // 2))
    freqs = np.linspace(sampling_rate / n_scales, sampling_rate / 2.0, n_scales)
    times = np.arange(N) / sampling_rate

    M = np.zeros((N, n_scales), dtype=float)
    for idx, freq in enumerate(freqs):
        # Construct Morlet wavelet kernel at target frequency
        sigma_t = 1.0 / (2.0 * np.pi * max(freq, 0.1) / 3.0)
        half_len = min(N // 2, max(4, int(3 * sigma_t * sampling_rate)))
        t_wav = np.arange(-half_len, half_len + 1) / sampling_rate
        morlet = np.exp(2j * np.pi * freq * t_wav) * np.exp(-(t_wav ** 2) / (2 * (sigma_t ** 2)))
        morlet /= np.sqrt(np.sum(np.abs(morlet) ** 2)) + 1e-12
        conv = np.convolve(x, morlet, mode="same")
        M[:, idx] = np.abs(conv)

    return M, times, freqs


def apply_transform(
    x: np.ndarray,
    transform_type: str = "FSWT",
    sampling_rate: float = 10.0,
) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Dispatcher for FSWT, STFT, and CWT transforms."""
    t_upper = transform_type.upper()
    if t_upper == "STFT":
        return compute_stft(x, sampling_rate)
    if t_upper == "CWT":
        return compute_cwt(x, sampling_rate)
    return compute_fswt(x, sampling_rate)
