"""
 fraud-detection-agent.py
 Real-time fraud detection agent integrating statistical, ML, rules, and behavioral analysis
 for payments on Stacks via the backend API.

 Requirements:
  pip install -r backend/requirements.txt

 Env:
  - API_BASE (backend API base, e.g., http://localhost:3000/api)
  - WS_URL  (optional WebSocket URL for real-time stream)
  - FRAUD_MODEL_PATH (path to joblib model file)
  - RISK_THRESHOLD (float 0..1 for alert threshold)

 CLI:
  python3 fraud-detection-agent.py --owner SP_OWNER --mode listen
  python3 fraud-detection-agent.py --owner SP_OWNER --mode score --tx '{...}'
"""

from __future__ import annotations

import argparse
import json
import logging
import math
import os
import time
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

import joblib
import numpy as np
import pandas as pd
import requests
from sklearn.ensemble import IsolationForest
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler

try:
    import websockets  # type: ignore
except Exception:  # pragma: no cover
    websockets = None

logger = logging.getLogger("fraud-agent")
logger.setLevel(logging.INFO)
_handler = logging.StreamHandler()
_handler.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(message)s"))
logger.addHandler(_handler)


MODEL_DEFAULT = os.getenv("FRAUD_MODEL_PATH", os.path.join(os.path.dirname(__file__), "models", "fraud_model.joblib"))
API_BASE = os.getenv("API_BASE", "http://localhost:3000/api").rstrip("/")
WS_URL = os.getenv("WS_URL")
RISK_THRESHOLD = float(os.getenv("RISK_THRESHOLD", "0.7"))


def _safe_num(x: Any) -> float:
    try:
        return float(x)
    except Exception:
        return 0.0


def _extract_features(tx: Dict[str, Any]) -> Dict[str, float]:
    # Basic numeric and temporal features; extend as needed
    ts = tx.get("ts") or int(time.time() * 1000)
    hour = (int(ts // 1000) % 86400) // 3600
    amount = _safe_num(tx.get("amount", 0))
    status = str(tx.get("status", "")).lower()
    is_retry = 1.0 if tx.get("retry", False) else 0.0
    memo_len = float(len((tx.get("memo") or "")))
    # Status one-hot lite
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


@dataclass
class FraudModel:
    scaler: Optional[StandardScaler]
    clf: Any  # LogisticRegression or Pipeline-like
    iso: Optional[IsolationForest]

    @staticmethod
    def load(path: str = MODEL_DEFAULT) -> "FraudModel":
        try:
            obj = joblib.load(path)
            return FraudModel(**obj)
        except Exception:
            logger.warning("No trained model found; using defaults")
            # Defaults: identity scaler, simple logistic (bias only), isolation forest
            return FraudModel(scaler=None, clf=LogisticRegression(), iso=IsolationForest(n_estimators=50, contamination=0.05, random_state=42))

    def save(self, path: str = MODEL_DEFAULT) -> None:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        joblib.dump({"scaler": self.scaler, "clf": self.clf, "iso": self.iso}, path)


class FraudDetectionAgent:
    def __init__(self, owner: str, api_base: str = API_BASE, model_path: str = MODEL_DEFAULT, risk_threshold: float = RISK_THRESHOLD):
        self.owner = owner
        self.api_base = api_base
        self.model = FraudModel.load(model_path)
        self.model_path = model_path
        self.threshold = risk_threshold

    def features(self, tx: Dict[str, Any]) -> Tuple[np.ndarray, List[str]]:
        feats = _extract_features(tx)
        cols = sorted(feats.keys())
        X = np.array([[feats[c] for c in cols]], dtype=float)
        if self.model.scaler is not None:
            X = self.model.scaler.transform(X)
        return X, cols

    def score(self, tx: Dict[str, Any]) -> float:
        X, _ = self.features(tx)
        # ML model probability
        p = 0.5
        if hasattr(self.model.clf, "predict_proba"):
            try:
                p = float(self.model.clf.predict_proba(X)[0, 1])
            except Exception:
                p = 0.5
        # IsolationForest anomaly score -> [0,1]
        if self.model.iso is not None:
            try:
                # anomaly score: higher means more normal in sklearn's API (negative score is anomaly)
                s = -float(self.model.iso.score_samples(X)[0])
                s = 1.0 / (1.0 + math.exp(-s))  # squash
                p = 0.5 * p + 0.5 * s
            except Exception:
                pass
        return min(max(p, 0.0), 1.0)

    def classify(self, p: float) -> str:
        if p >= max(self.threshold, 0.9):
            return "critical"
        if p >= self.threshold:
            return "high"
        if p >= 0.4:
            return "medium"
        return "low"

    def alert(self, tx: Dict[str, Any], p: float, level: str) -> None:
        try:
            payload = {"tx": tx, "risk": p, "level": level}
            requests.post(f"{self.api_base}/alerts", json=payload, timeout=5)
        except Exception:
            pass
        logger.warning("FRAUD ALERT", extra={"level": level, "risk": round(p, 3), "tx": tx})

    def feedback(self, tx_id: str, label: int) -> None:
        """Label: 1 = fraud, 0 = legit. Append to local feedback store for periodic retraining."""
        path = os.path.join(os.path.dirname(self.model_path), "feedback.jsonl")
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "a", encoding="utf-8") as f:
            f.write(json.dumps({"txId": tx_id, "label": int(label)}) + "\n")

    def process_tx(self, tx: Dict[str, Any]) -> Dict[str, Any]:
        p = self.score(tx)
        level = self.classify(p)
        result = {"risk": p, "level": level}
        if level in ("high", "critical"):
            self.alert(tx, p, level)
        return result

    async def listen_ws(self) -> None:
        if not websockets:
            raise RuntimeError("websockets library not available")
        url = WS_URL or (API_BASE.replace("http", "ws") + "/")
        async with websockets.connect(url) as ws:
            logger.info("Listening for payment:* events at %s", url)
            while True:
                raw = await ws.recv()
                try:
                    msg = json.loads(raw)
                except Exception:
                    continue
                event = msg.get("event")
                payload = msg.get("payload")
                if not event or not isinstance(payload, dict):
                    continue
                if event.startswith("payment:"):
                    out = self.process_tx(payload)
                    logger.info("tx scored", extra={"risk": round(out["risk"],3), "level": out["level"]})


def main() -> None:
    parser = argparse.ArgumentParser(description="Fraud Detection Agent")
    parser.add_argument("--owner", required=True, help="Owner principal")
    parser.add_argument("--mode", choices=["listen", "score"], default="listen")
    parser.add_argument("--tx", help="JSON transaction for score mode")
    parser.add_argument("--threshold", type=float, default=RISK_THRESHOLD)
    args = parser.parse_args()

    agent = FraudDetectionAgent(owner=args.owner, risk_threshold=args.threshold)

    if args.mode == "score":
        if not args.tx:
            raise SystemExit("--tx required in score mode")
        tx = json.loads(args.tx)
        out = agent.process_tx(tx)
        print(json.dumps(out, indent=2))
        return

    # Listen mode
    if not websockets:
        raise SystemExit("Install websockets or set WS_URL for listening mode")
    import asyncio
    asyncio.run(agent.listen_ws())


if __name__ == "__main__":
    main()
