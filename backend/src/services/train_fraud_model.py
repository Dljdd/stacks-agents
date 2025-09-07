"""
 train_fraud_model.py
 Offline training script for fraud model: builds scaler+logistic model and isolation forest, evaluates, and persists via joblib.

 Usage:
   python3 train_fraud_model.py --data data.csv --out models/fraud_model.joblib
 Data columns expected (CSV):
   amount, ts(ms), status, retry(bool), memo, label(0/1), [optional additional columns]
"""

from __future__ import annotations

import argparse
import json
import os
from typing import Any, Dict, List

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report, roc_auc_score
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

from fraud_detection_agent import _extract_features, FraudModel


def load_dataset(path: str) -> pd.DataFrame:
    df = pd.read_csv(path)
    # Normalize/rename common fields
    df.rename(columns={"ts(ms)": "ts"}, inplace=True)
    return df


def featurize(df: pd.DataFrame) -> (np.ndarray, np.ndarray, List[str]):
    feats: List[Dict[str, float]] = []
    labels: List[int] = []
    for _, row in df.iterrows():
        f = _extract_features(row.to_dict())
        feats.append(f)
        labels.append(int(row.get("label", 0)))
    cols = sorted(feats[0].keys()) if feats else []
    X = np.array([[fi[c] for c in cols] for fi in feats], dtype=float)
    y = np.array(labels, dtype=int)
    return X, y, cols


def train(X: np.ndarray, y: np.ndarray) -> FraudModel:
    scaler = StandardScaler()
    Xs = scaler.fit_transform(X)

    clf = LogisticRegression(max_iter=1000, class_weight="balanced")
    clf.fit(Xs, y)

    iso = IsolationForest(n_estimators=100, contamination=0.05, random_state=42)
    iso.fit(Xs)

    return FraudModel(scaler=scaler, clf=clf, iso=iso)


def evaluate(model: FraudModel, X: np.ndarray, y: np.ndarray) -> Dict[str, Any]:
    Xs = model.scaler.transform(X) if model.scaler is not None else X
    proba = model.clf.predict_proba(Xs)[:, 1] if hasattr(model.clf, "predict_proba") else np.full_like(y, 0.5, dtype=float)
    preds = (proba >= 0.5).astype(int)
    report = classification_report(y, preds, output_dict=True)
    auc = roc_auc_score(y, proba) if len(np.unique(y)) > 1 else float("nan")
    return {"auc": auc, "report": report}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", required=True)
    ap.add_argument("--out", default=os.path.join(os.path.dirname(__file__), "models", "fraud_model.joblib"))
    args = ap.parse_args()

    df = load_dataset(args.data)
    X, y, cols = featurize(df)
    if len(X) == 0:
        raise SystemExit("No data rows")
    X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.25, random_state=42, stratify=y)

    model = train(X_tr, y_tr)
    metrics = evaluate(model, X_te, y_te)

    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    model.save(args.out)

    print(json.dumps({"metrics": metrics, "path": args.out}, indent=2))


if __name__ == "__main__":
    main()
