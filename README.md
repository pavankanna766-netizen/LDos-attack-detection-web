# LDoS Attack Detector

**Low-Rate Denial-of-Service Attack Detection Using Signal Processing and Machine Learning**

An academic full-stack web application implementing the research methodology of **Wang et al. (2024)** (*"An LDoS attack detection method based on FSWT time–frequency distribution"*, Expert Systems With Applications, Vol. 256, 125006).

---

## Core Scientific Pipeline

1. **Dataset Upload & Validation**: Supports Mode A (Single Labelled CSV) and Mode B (Dual Separate Normal + LDoS CSVs), plus built-in NS2 and Physical Testbed benchmark datasets modeled on the paper's $(T, L, R)$ pulse parameters.
2. **Signal Preprocessing & Windowing**: Interpolates missing values, segments traffic into fixed windows (default: $f_s = 10\text{ Hz}$, $N = 100\text{ samples}$, $10\text{ s}$ duration), and removes the DC component ($x'[n] = x[n] - \bar{x}$).
3. **Time-Frequency Transformation**:
   - **FSWT (Frequency Slice Wavelet Transform — Research Paper Method)**:
     $$W(t, i) = \lambda \mathcal{F}^{-1}\{\mathcal{F}\{X\} \cdot P_i\}, \quad \hat{p}(\omega) = e^{-0.5\omega^2}, \quad \lambda=1, \eta=0.05, \upsilon=0.5, \kappa=23.5482$$
   - **STFT (Short-Time Fourier Transform)**: Sliding window Fourier spectrogram.
   - **CWT (Continuous Wavelet Transform)**: Multi-scale Morlet wavelet scalogram.
4. **Feature Extraction**:
   - **Original 4 Paper Features**:
     - *Entropy ($En$)*: $En = -\sum_i \sum_j M_{ij} \log M_{ij}$
     - *Energy Ratio ($RE$)*: Ratio of low-frequency band ($[0, f_s/5]$) energy to total time-frequency energy
     - *Contrast ($Con$)*: $\sum_i \sum_j (i - j)^2 M_{ij}$
     - *Correlation ($Cor$)*: $\frac{\sum_i \sum_j i j M_{ij} - \mu_1 \mu_2}{\sigma_1^2 \sigma_2^2}$
   - **Extended 6 Features**: Adds *Spectral Centroid* and *Kurtosis*.
5. **Machine Learning Classification & Evaluation**:
   - **Models**: Decision Tree Classifier (Research Paper Baseline) and Random Forest Classifier.
   - **Split Strategies**: Temporal Split and Stratified Random Split (`test_size = 0.30`, `random_state = 42`).
   - **Metrics**: Accuracy, Precision, Recall (Sensitivity/TPR), Specificity (TNR), F1 Score, False Positive Rate ($\text{FPR} = 1 - \text{TNR}$), and Confusion Matrix ($\text{TP}, \text{TN}, \text{FP}, \text{FN}$).

---

## Integrating Your Existing Python LDoS Codebase

The Python backend in `backend/` is structured with clean, modular interfaces so you can drop in functions from your existing Python repository:

| Pipeline Stage | File Location | Function to Replace / Hook |
| :--- | :--- | :--- |
| **1. Dataset Loader** | `backend/services/dataset_loader.py` | `validate_dataset()`, `merge_dual_datasets()` |
| **2. Signal Preprocessing** | `backend/services/preprocessing.py` | `preprocess_and_segment_signal()` |
| **3. Time-Frequency Transforms** | `backend/services/transforms.py` | `compute_fswt()`, `compute_stft()`, `compute_cwt()` |
| **4. Feature Extraction** | `backend/services/feature_extraction.py` | `extract_window_features()` |
| **5. Machine Learning** | `backend/services/ml_classifier.py` | `train_and_evaluate_classifier()` |
| **6. Evaluation Metrics** | `backend/services/evaluation.py` | `evaluate_predictions()` |
| **7. Visualizations & Exports** | `backend/services/visualization.py` | `save_time_frequency_plot()`, `export_predictions_csv()` |
