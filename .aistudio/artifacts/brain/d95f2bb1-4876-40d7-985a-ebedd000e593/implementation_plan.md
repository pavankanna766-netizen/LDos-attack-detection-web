# LDoS Attack Detector — Signal Processing & Machine Learning Research Platform

An interactive academic web application for detecting stealthy Low-Rate Denial-of-Service (LDoS) attacks using Frequency Slice Wavelet Transform (FSWT), comparative time-frequency methods (STFT, CWT), statistical feature extraction, and supervised machine learning classification, directly implementing the research methodology of Wang et al. (2024).

## User Review & Critical Decisions

> [!IMPORTANT]
> The following product and scientific workflow decisions incorporate your confirmed preferences and the mathematical formulations from the reference paper (*An LDoS attack detection method based on FSWT time–frequency distribution*, Expert Systems With Applications, 2024).

- **Confirmed Decision 1 — Built-in Benchmark Datasets + Custom CSV Upload**: The Dataset Upload stage will support full custom CSV uploads (both Mode A: Single Labelled CSV and Mode B: Dual Normal + LDoS CSVs with dynamic column selectors) alongside one-click loading of pre-configured benchmark traffic datasets modeled on the paper's NS2 ($T \in \{1,2,3\}\text{ s}$, $L \in \{0.1,0.2,0.3\}\text{ s}$, $R \in \{20,25,30\}\text{ Mbps}$) and physical testbed ($R \in \{15,25\}\text{ Mbps}$) bottleneck link captures.
- **Confirmed Decision 2 — Interactive 2D Time-Frequency Heatmaps & 1D Signal Plots**: The Visualizations section will feature interactive 1D time-domain traffic waveforms (highlighting Normal Status `NS=0` vs. LDoS Attack Status `LS=1` windows), interactive 2D time-frequency energy distribution heatmaps (FSWT distribution, STFT spectrogram, and CWT scalogram with low-frequency $0\text{–}10\text{ Hz}$ vs. mid-high band markers), extracted feature trajectories, a confusion matrix breakdown, and a per-window classification table.
- **Confirmed Decision 3 — Printable Academic PDF/HTML Summary Report & Artifact Downloads**: The Download section will generate a formatted, print-ready academic HTML/PDF report containing the run configuration, mathematical pipeline summary, confusion matrix, evaluation metrics, and embedded figures, alongside individual downloads for Prediction Results CSV, Feature Dataset CSV, Metrics CSV, and high-resolution chart exports.
- **Modular Python Integration Architecture**: A complete, modular Python FastAPI backend structure (`backend/`) with clean interfaces for Dataset Loading, Preprocessing, Transforms (FSWT, STFT, CWT), Feature Extraction (4-feature paper baseline & 6-feature extended set), ML Models (Decision Tree, Random Forest), and Evaluation will be provided alongside the live full-stack server so your existing Python LDoS codebase can be dropped into clearly documented hook points, while the live web preview executes genuine mathematical transforms and classifiers on every uploaded dataset without any mocked metrics.

---

## 1. Overview & Core Concept

- **What It Does**: Transforms raw network traffic time-series into fixed-duration signal windows, removes DC bias, computes 2D time-frequency energy distributions ($M_{ij}$) via FSWT, STFT, or CWT, extracts time-frequency structural features, trains and evaluates Decision Tree or Random Forest classifiers, and presents empirical evaluation metrics and scientific visualizations.
- **Target Audience / Persona**: University Signals & Systems researchers, network security students, and academic evaluators examining time-frequency LDoS detection performance.
- **Key Value**: Bridges theoretical signal processing (FSWT frequency slicing and Heisenberg uncertainty trade-offs) with reproducible machine learning experiments, allowing side-by-side comparison of transforms and feature sets on real or benchmark CSV datasets with zero fabricated metrics.

---

## 2. User Experience & Visual Design

### Key User Flows

1. **Home & Methodology Overview**: Introduces the LDoS threat model $(T, L, R)$ where short periodic bursts ($L < T$) evade volume-based detectors by targeting TCP RTO and AIMD mechanisms. Displays an interactive visual diagram of the 6-stage scientific pipeline and a prominent **"Start Detection"** action. Also offers direct access to the **Reference Paper (Wang et al., 2024)** PDF viewer modal.
2. **Dataset Upload & Validation**:
   - Users choose between **Mode A (Single Labelled CSV)**, **Mode B (Separate Normal & LDoS CSVs)**, or **Load Paper Benchmark Dataset** (NS2 Set 1/2/3 or Testbed Group captures).
   - Upon file selection, the system parses and validates the CSV(s), populates dynamic dropdowns for the **Traffic/Signal Column** and **Label Column**, and exposes signal windowing parameters (**Sampling Rate** default $10\text{ Hz}$, **Window Size** default $100\text{ samples}$ / $10\text{ s}$ duration, **Window Stride** default $100\text{ samples}$).
   - Displays a real-time **Dataset Summary Panel** (Filename, total rows, column count, selected signal/label columns, missing value count, and class distribution bar for Normal `0` vs. LDoS `1`) with clear validation diagnostics.
3. **Detection Configuration**:
   - Users select the **Time-Frequency Transform** (`FSWT` with $\lambda=1, \eta=0.05, \upsilon=0.5, \hat{p}(\omega)=e^{-0.5\omega^2}, \kappa=23.5482$; `STFT` with configurable window; or `CWT` wavelet scalogram), **Feature Set** (`Original 4 Features`: Entropy, Energy Ratio, Contrast, Correlation; or `Extended 6 Features`: adding Spectral Centroid and Kurtosis), **ML Classifier** (`Decision Tree` or `Random Forest`), and **Split Strategy** (`Temporal Split` or `Stratified Random Split`, default $30\%$ test size, random state $42$).
   - Features a one-click **★ Research Paper Baseline** preset button (`FSWT + Original 4 Features + Decision Tree`) and a **"Run All 5 Comparative Experiments"** batch option.
4. **Live Step-by-Step Processing View**:
   - Displays real-time stage progression driven by actual backend pipeline execution: Dataset Uploaded $\rightarrow$ Dataset Validated $\rightarrow$ Preprocessing Traffic Signal (DC component removal & normalization) $\rightarrow$ Segmenting Signal Windows $\rightarrow$ Applying Time-Frequency Transform $\rightarrow$ Extracting Features $\rightarrow$ Training Classifier $\rightarrow$ Evaluating Results.
5. **Results Dashboard & Scientific Visualizations**:
   - **Top Metric Cards**: Detection Accuracy, Precision, Recall (Sensitivity/TPR), F1 Score, False Positive Rate ($1 - \text{TNR}$), and Total Windows Analysed in tabular monospace numerals.
   - **Primary Detection Banner**: Prominent status readout (`LDoS ATTACK DETECTED` or `NORMAL TRAFFIC`) with window breakdown (Normal windows count, LDoS windows count, percentage classified as LDoS, and mean prediction confidence).
   - **Visualizations Suite**:
     - *A. Time-Domain Signal*: Interactive waveform plot of traffic amplitude vs. time (seconds), color-coded by Normal (`0`) and LDoS (`1`) intervals.
     - *B. Time-Frequency Representation*: Interactive 2D canvas heatmap of $M_{ij}$ (FSWT distribution, STFT spectrogram, or CWT scalogram) with window selector, frequency band annotations (Low-frequency $0\text{–}1/5\text{ }f_s$ band where periodic LDoS energy concentrates vs. Mid-High $1/5\text{–}1\text{ }f_s$ band), and side-by-side Normal vs. LDoS window comparison.
     - *C. Feature Visualization*: Multi-panel trajectory and class-distribution comparison across windows for the selected features (`Entropy`, `Energy Ratio`, `Contrast`, `Correlation`, plus `Spectral Centroid` and `Kurtosis` when 6-feature mode is active).
     - *D. Confusion Matrix*: 2x2 visual matrix displaying True Negative (TN), False Positive (FP), False Negative (FN), and True Positive (TP) counts and percentages, alongside Specificity (TNR) and Sensitivity (TPR).
     - *E. Classification Results Table*: Paginated, filterable per-window table showing `Window #`, `Time Range (s)`, `Prediction (Normal / LDoS)`, `True Label`, `Confidence`, and status match indicator.
6. **Experiment Comparison Page**:
   - Tracks all actually executed runs in the current session and maps them against the 5 structured academic experiments (`Exp 1: FSWT + 4 Features + DT`, `Exp 2: FSWT + 6 Features + DT`, `Exp 3: STFT + 6 Features + DT`, `Exp 4: CWT + 6 Features + DT`, `Exp 5: Best Transform + 6 Features + RF`).
   - Users can trigger any unexecuted experiment directly from the table using the currently loaded dataset so every row and bar chart reflects real computed values.
7. **Downloads & Academic Report Center**:
   - Instant one-click downloads for **Prediction Results CSV**, **Feature Dataset CSV**, **Evaluation Metrics CSV**, **High-Resolution Visualization PNGs**, and the **Printable Academic Summary Report (HTML/PDF)**.
   - Includes an **Integration Guide Drawer** detailing how to drop existing Python functions into the modular `backend/services/` files.

### Visual Identity & Theme

- **Aesthetic Direction**: Calibrated Scientific Telemetry & Academic Cybersecurity Console — evoking precision laboratory instrumentation, IEEE/Elsevier publication rigor, and high-contrast signal inspection.
- **Color Palette & Mood (60-30-10 Discipline with Dual Light/Dark Support)**:
  - *60% Dominant Canvas*: Crisp Clinical Lab Slate (`#F8FAFC`) in Light Mode; Deep Obsidian Slate (`#0B0F17`) in Dark Mode.
  - *30% Structural Panels & Coordinate Grids*: Flat Slate Panels (`#FFFFFF` / `#111827`) with crisp `1px` hairline borders (`#E2E8F0` / `#1E293B`).
  - *10% Telemetry & Semantic Accents*: Calibrated Laser Cyan (`#06B6D4`) and Cobalt (`#2563EB`) for primary signal traces and active controls; Emerald (`#10B981`) for Normal Traffic (`NS=0`); Crimson (`#EF4444`) for LDoS Attack bursts (`LS=1`); Amber (`#F59E0B`) for Research Baseline highlights.
- **Typography & Hierarchy (2+1 Rule)**:
  - *Display & Section Headings*: `Plus Jakarta Sans` (SemiBold/Bold 600–700, tight tracking).
  - *Body & Academic Prose*: `Public Sans` (Regular/Medium 400–500 for high legibility in dense tables and mathematical explanations).
  - *Telemetry, Equations & Tabular Data*: `JetBrains Mono` with `tabular-nums` for all evaluation metrics, window coordinates, frequencies ($\text{Hz}$), and confusion matrix readouts.
- **Layout & Anti-Slop Discipline**:
  - Follows the 3-zone Top Bar Contract: Brand wordmark (`LDoS Attack Detector`) on the left, concise single-line navigation tabs (`Home`, `Dataset`, `Configure`, `Results & Visuals`, `Experiments`) in the center, and primary action button (`Load Benchmark` / `Export Report`) + theme toggle on the right.
  - Zero decorative pulsing dots, zero code-comment headers (`//`), zero nested cards-within-cards, and unboxed metadata separated by `·`.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1 — Exact Mathematical Implementation of Wang et al. (2024) Equations**:
  - *Chosen Approach*: Implement the exact equations from Section 4 of the attached paper:
    - **DC Removal**: $x'[n] = x[n] - \frac{1}{N}\sum_{k=0}^{N-1} x[k]$
    - **FSWT Transformation (Eq. 1 & 2)**: $W(t, \omega_i) = \lambda \mathcal{F}^{-1}\{ \mathcal{F}\{X\} \cdot P_i \}$ using the Gaussian Frequency Slice Function $\hat{p}(\omega) = e^{-0.5\omega^2}$ with $\lambda=1, \eta=0.05, \upsilon=0.5, \kappa = \frac{\sqrt{2\ln 2}}{\eta} \approx 23.5482$, yielding the 2D time-frequency energy distribution matrix $M_{ij}$.
    - **Four Core Features (Eq. 3–6)**:
      1. *Entropy ($En$)*: $En = -\sum_i \sum_j \tilde{M}_{ij} \log \tilde{M}_{ij}$ (measuring time-frequency dispersion; higher in steady NS, lower in periodic LS).
      2. *Energy Ratio ($RE$)*: $RE = \frac{\sum_i \sum_{j=1}^{\lfloor K/5 \rfloor} M_{ij}^2}{\sum_i \sum_{j=1}^K M_{ij}^2}$ (ratio of energy in the low-frequency $1/5$ observation band $[0, f_s/10]$ to total energy; higher in LS due to periodic attack pulses).
      3. *Contrast ($Con$)*: $Con = \sum_i \sum_j (i - j)^2 M_{ij}$ (measuring visual stripe intensity across time-frequency bins).
      4. *Correlation ($Cor$)*: $Cor = \frac{\sum_i \sum_j i j M_{ij} - \mu_1 \mu_2}{\sigma_1^2 \sigma_2^2}$ (measuring row-column structural regularity).
    - **Extended Features (6-Feature Mode)**: Adds *Spectral Centroid* ($\frac{\sum_k f_k S(f_k)}{\sum_k S(f_k)}$) and *Kurtosis* ($\frac{\frac{1}{N}\sum (x - \mu)^4}{(\frac{1}{N}\sum (x - \mu)^2)^2}$) to evaluate whether additional spectral/statistical descriptors improve tree splits.
  - *Why*: Guarantees scientific authenticity so all visualizations and classification metrics behave consistently with the paper's theoretical findings.

- **Decision 2 — Dual Backend Architecture (Live Express/Python Execution + Modular FastAPI Repository)**:
  - *Chosen Approach*: Provide the complete, modular Python FastAPI backend under `backend/` (with `main.py`, `routers/`, `services/`, `requirements.txt`, and documented integration points for your existing Python code) AND wire the port-3000 full-stack server (`server.ts`) to execute the scientific pipeline and expose the exact REST endpoints (`POST /api/upload`, `POST /api/validate-dataset`, `POST /api/run-detection`, `GET /api/results/:job_id`, `GET /api/results/:job_id/metrics`, `GET /api/results/:job_id/visualizations`, `GET /api/download/:job_id/:file`).
  - *Why*: Ensures the live AI Studio web preview works out-of-the-box with zero configuration while giving you a clean, standalone Python FastAPI codebase ready for local execution or drop-in replacement with your existing Python repository.

---

## 4. Technical Architecture & Data Strategy

### Architecture & Component Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React 19 + TypeScript + Vite)                      │
│                                                                                     │
│  ┌───────────────────────────────────────────────────────────────────────────────┐  │
│  │ Top Navigation Bar: Brand Wordmark  |  5 Stage Nav Links  |  Primary Action   │  │
│  └───────────────────────────────────────────────────────────────────────────────┘  │
│          │                    │                   │                    │            │
│          ▼                    ▼                   ▼                    ▼            │
│  ┌──────────────┐    ┌────────────────┐   ┌──────────────┐    ┌──────────────────┐  │
│  │  Home &      │    │ Dataset Upload │   │  Detection   │    │ Results, Visuals │  │
│  │  Paper Modal │───▶│  & Validation  │──▶│ Configurator │───▶│  & Experiments   │  │
│  │ (T,L,R Model)│    │ (Mode A/B/NS2) │   │ (FSWT/DT/RF) │    │  + Report Export │  │
│  └──────────────┘    └────────────────┘   └──────────────┘    └──────────────────┘  │
└─────────────────────────────────────────┬───────────────────────────────────────────┘
                                          │ REST API (/api/*)
                                          ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                    BACKEND API LAYER (Port 3000 Server & FastAPI)                   │
│                                                                                     │
│   POST /api/upload            POST /api/validate-dataset   POST /api/run-detection  │
│   GET  /api/results/{job_id}  GET  /api/results/{job_id}/visualizations             │
│   GET  /api/download/{job_id}/{file}                       POST /api/run-experiment │
└─────────────────────────────────────────┬───────────────────────────────────────────┘
                                          │
                                          ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                         MODULAR SCIENTIFIC DETECTION PIPELINE                       │
│                                                                                     │
│  ┌────────────────┐   ┌────────────────┐   ┌────────────────┐   ┌────────────────┐  │
│  │ 1. Dataset     │   │ 2. Signal      │   │ 3. Time-Freq   │   │ 4. Feature     │  │
│  │ Loader &       │──▶│ Preprocessing  │──▶│ Transforms     │──▶│ Extractor      │  │
│  │ Validator      │   │ & Windowing    │   │ (FSWT/STFT/CWT)│   │ (4 or 6 Feats) │  │
│  └────────────────┘   └────────────────┘   └────────────────┘   └───────┬────────┘  │
│                                                                         │           │
│  ┌──────────────────────────────────────────────────────────────────────▼────────┐  │
│  │ 5. ML Classifier (CART Decision Tree / Random Forest Ensemble) & Evaluation   │  │
│  │    Computes: Confusion Matrix (TP,TN,FP,FN), Accuracy, Precision, Recall,     │  │
│  │    F1 Score, Specificity (TNR), FPR, Window Predictions & Artifact CSVs       │  │
│  └───────────────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

### Data Model & State

- **`DatasetSession`**: Stores uploaded CSV raw rows, detected column headers, selected `signalColumn` and `labelColumn`, upload mode (`single` vs `dual`), validation summary (`rowCount`, `colCount`, `missingValues`, `normalCount`, `ldosCount`), and sampling parameters (`samplingRate`, `windowSize`, `windowStride`).
- **`DetectionConfig`**: Stores `transform` (`FSWT` | `STFT` | `CWT`), `featureSet` (`original_4` | `extended_6`), `model` (`decision_tree` | `random_forest`), `splitStrategy` (`temporal` | `stratified`), `testSize` (default `0.30`), `randomState` (default `42`), and FSWT parameters ($\lambda, \eta, \upsilon, \kappa$).
- **`DetectionJobResult` (`job_id`)**:
  - `status` & `steps`: Real-time completion timestamps for all 8 pipeline stages.
  - `metrics`: `accuracy`, `precision`, `recall`, `specificity`, `f1Score`, `fpr`, `fnr`, `confusionMatrix` (`tp`, `tn`, `fp`, `fn`), `totalWindows`, `normalWindows`, `ldosWindows`, `overallVerdict`.
  - `visualizations`: Downsampled time-domain signal points, representative Normal and LDoS 2D time-frequency matrices ($M_{ij}$ with time and frequency axes), per-window feature vectors, and trained decision tree structure / feature importances.
  - `windowPredictions`: Array of `{ windowIndex, startTime, endTime, trueLabel, predictedLabel, confidence, features }`.
- **`ExperimentRecord`**: Stores actually executed experiment runs (`id`, `name`, `transform`, `featureSet`, `model`, `metrics`, `jobId`, `timestamp`) for the Experiment Comparison table and grouped bar charts.

### Interactive Component & State Mapping

- **CSV Upload & Benchmark Loader**: Selecting a CSV file (or clicking a built-in NS2/Testbed benchmark preset) immediately sends the payload to `/api/upload` and `/api/validate-dataset`, populating column selectors and rendering the class balance and missing-value diagnostics. Changing the selected signal/label column dynamically re-validates the dataset summary.
- **Configuration & Baseline Preset**: Clicking **★ Research Paper Baseline** resets the configuration state to `FSWT + Original 4 Features + Decision Tree + 10 Hz / 100 samples`.
- **Pipeline Execution & Progress Tracker**: Clicking **Run Detection** invokes `/api/run-detection`, transitioning to the Processing view where each pipeline stage updates as the backend completes windowing, transform computation, feature extraction, and tree training, before automatically opening the Results Dashboard.
- **Interactive Canvas Heatmaps & Window Inspector**: In the Visualizations view, users can toggle between Normal (`NS`) and LDoS (`LS`) windows or scrub through individual window indices to inspect how low-frequency energy ($0\text{–}2\text{ Hz}$) concentrates during periodic LDoS bursts in the 2D time-frequency distribution.
- **Experiment Runner & Report Generator**: Users can add any completed run to the Experiment Comparison matrix or run the 5 comparative experiments in batch on the active dataset, and click **Download Final Report** to open a formatted, print-ready academic report view or download CSV artifacts directly from `/api/download/:job_id/:file`.
