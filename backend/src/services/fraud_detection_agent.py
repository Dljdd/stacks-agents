"""
 fraud_detection_agent.py
 Importable helpers mirrored from fraud-detection-agent.py for training and reuse.
 Exposes _extract_features and FraudModel.
"""
from __future__ import annotations

import json
import os
from dataclasses import dataclass
from typing import Any, Dict, Optional

import joblib
import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler

# Keep this logic in sync with fraud-detection-agent.py

def _safe_num(x: Any) -> float:
    try:
        return float(x)
    except Exception:
        return 0.0


def _extract_features(tx: Dict[str, Any]) -> Dict[str, float]:
    import time

    ts = tx.get("ts") or int(time.time() * 1000)
    hour = (int(ts // 1000) % 86400) // 3600
    amount = _safe_num(tx.get("amount", 0))
    status = str(tx.get("status", "")).lower()
    is_retry = 1.0 if (tx.get("retry", False) in (True, 1, "1", "true", "True")) else 0.0
    memo_len = float(len((tx.get("memo") or "")))
    st_success = 1.0 if "success" in status else 0.0
    st_failed = 1.0 if "fail" in status else 0.0
    st_queued = 1.0 if "queue" in status else 0.0
    return {
        "amount": amount,
        "hour": float(hour),
        "is_retry": is_retry,
        "memo_len": memo_len,
        "st_success": st_success,
        "st_failed": st_failed,
        "st_queued": st_queued,
    }


MODEL_DEFAULT = os.path.join(os.path.dirname(__file__), "models", "fraud_model.joblib")


@dataclass
class FraudModel:
    scaler: Optional[StandardScaler]
    clf: Any
    iso: Optional[IsolationForest]

    @staticmethod
    def load(path: str = MODEL_DEFAULT) -> "FraudModel":
        try:
            obj = joblib.load(path)
            return FraudModel(**obj)
        except Exception:
            # Provide a usable default for development
            return FraudModel(scaler=None, clf=LogisticRegression(), iso=IsolationForest(n_estimators=50, contamination=0.05, random_state=42))

    def save(self, path: str = MODEL_DEFAULT) -> None:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        joblib.dump({"scaler": self.scaler, "clf": self.clf, "iso": self.iso}, path)
