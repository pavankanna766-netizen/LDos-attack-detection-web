"""
Evaluation Metrics & Confusion Matrix Service
=============================================
Implements Section 4.3.2 of Wang et al. (2024):
- Table 1: TN, FP, FN, TP definitions for Normal Status (NS=0) and LDoS Attack Status (LS=1)
- Eq. (7): Accuracy (Accu)
- Eq. (8): Sensitivity / Recall / Detection Rate (TPR)
- Eq. (9): Specificity (TNR)
- Eq. (10): Precision (Pre)
- False Positive Rate (FPR = 1 - TNR) and False Negative Rate (FNR = 1 - TPR)

[INTEGRATION POINT]:
Import `evaluate_predictions` in your evaluation pipeline or replace with custom metric loggers.
"""

from typing import Dict, Any
import numpy as np
from backend.services.ml_classifier import compute_detection_metrics


def evaluate_predictions(y_true: np.ndarray, y_pred: np.ndarray) -> Dict[str, Any]:
    """Wrapper returning full evaluation metrics and confusion matrix."""
    return compute_detection_metrics(y_true, y_pred)
