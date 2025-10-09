"""Runtime utilities for Isolation Forest hybrid anomaly detection.

Provides lazy training/loading, scoring with optional boosting patterns retrieved
from the database using the existing schema. Keeps dependencies isolated so the
main API file stays lean.
"""
from __future__ import annotations
import json
import os
import pickle
import hashlib
from typing import Any, Dict, List
from decimal import Decimal
import numpy as np
from datetime import datetime, timezone

import mysql.connector
from mysql.connector import Error

from anomaly_features import feature_vector, extract_features
from config import MYSQL_CONFIG as DB_CONFIG

try:
    from sklearn.ensemble import IsolationForest
except ImportError:  # pragma: no cover
    IsolationForest = None  # type: ignore

MODELS_DIR = os.path.join(os.path.dirname(__file__), "models")
MODEL_PATH = os.path.join(MODELS_DIR, "isolation_forest.pkl")
META_PATH = os.path.join(MODELS_DIR, "model_meta.json")

_RUNTIME_CACHE: Dict[str, Any] = {
    "model": None,
    "meta": None,
    "version": None,
}


def _connect():
    return mysql.connector.connect(**DB_CONFIG)


def _get_active_config():
    try:
        conn = _connect()
        cur = conn.cursor(dictionary=True)
        cur.execute(
            "SELECT * FROM isolation_forest_config WHERE is_active = TRUE ORDER BY updated_at DESC LIMIT 1"
        )
        row = cur.fetchone()
        cur.close()
        conn.close()
        return row or {}
    except Error as e:  # pragma: no cover
        print(f"[IF] Config fetch error: {e}")
        return {}


def _get_training_rows():
    try:
        conn = _connect()
        cur = conn.cursor(dictionary=True)
        cur.execute("SELECT command_pattern FROM isolation_forest_training_data")
        rows = cur.fetchall()
        cur.close()
        conn.close()
        return rows
    except Error as e:  # pragma: no cover
        print(f"[IF] Training data fetch error: {e}")
        return []


def _get_feature_patterns():
    try:
        conn = _connect()
        cur = conn.cursor(dictionary=True)
        cur.execute(
            """
            SELECT pattern_name, pattern_regex, boost_value, severity
            FROM anomaly_feature_patterns
            WHERE is_active = TRUE
            ORDER BY boost_value DESC
            """
        )
        rows = cur.fetchall()
        cur.close()
        conn.close()
        return rows
    except Error as e:  # pragma: no cover
        print(f"[IF] Pattern fetch error: {e}")
        return []


def _coerce_primitive(v: Any) -> Any:
    # Convert Decimals or other numeric-like objects to float/int for hashing
    try:
        if hasattr(v, 'quantize') or v.__class__.__name__ == 'Decimal':
            # Prefer float; precision not critical for versioning
            return float(v)
    except Exception:
        pass
    return v


def _hash_config(config: Dict[str, Any], feature_names: List[str], sample_count: int) -> str:
    h = hashlib.sha256()
    cfg_subset = {k: _coerce_primitive(config.get(k)) for k in ["n_trees", "contamination", "sample_size", "max_depth", "threshold"]}
    payload = json.dumps({
        "config": cfg_subset,
        "features": feature_names,
        "samples": sample_count,
    }, sort_keys=True)
    h.update(payload.encode())
    return h.hexdigest()[:8]


def _train_model():
    if IsolationForest is None:
        raise RuntimeError("scikit-learn not installed; cannot train model")

    config = _get_active_config()
    rows = _get_training_rows()

    feature_rows: List[List[float]] = []
    feature_names: List[str] = []
    for r in rows:
        names, vec = feature_vector(r["command_pattern"])
        if not feature_names:
            feature_names = names
        feature_rows.append(vec)

    if not feature_rows:
        # Fallback: train on a trivial benign baseline of empty command to avoid crashes.
        names, vec = feature_vector("")
        feature_names = names
        feature_rows.append(vec)

    contamination = float(config.get("contamination") or 0.1)
    n_estimators = int(config.get("n_trees") or 100)
    max_samples = config.get("sample_size") or min(256, len(feature_rows))

    model = IsolationForest(
        n_estimators=n_estimators,
        contamination=contamination,
        max_samples=max_samples,
        random_state=42,
    )
    model.fit(feature_rows)

    # Collect decision function distribution for normalization
    decision_vals = model.decision_function(feature_rows)
    min_df = float(min(decision_vals))
    max_df = float(max(decision_vals))

    version = _hash_config(config, feature_names, len(feature_rows))
    meta = {
        "feature_names": feature_names,
        "min_df": min_df,
        "max_df": max_df,
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "version": version,
        "config": {k: _coerce_primitive(v) for k, v in (config or {}).items()},
    }

    os.makedirs(MODELS_DIR, exist_ok=True)
    with open(MODEL_PATH, "wb") as f:
        pickle.dump(model, f)
    with open(META_PATH, "w") as f:
        json.dump(meta, f, indent=2, default=str)

    _RUNTIME_CACHE.update({"model": model, "meta": meta, "version": version})
    return model, meta


def _load_if_exists():
    if not (os.path.exists(MODEL_PATH) and os.path.exists(META_PATH)):
        return None, None
    try:
        with open(MODEL_PATH, "rb") as f:
            model = pickle.load(f)
        with open(META_PATH) as f:
            meta = json.load(f)
        return model, meta
    except Exception as e:  # pragma: no cover
        print(f"[IF] Failed to load existing model: {e}")
        return None, None


def ensure_model_loaded():
    if _RUNTIME_CACHE["model"] is not None:
        return _RUNTIME_CACHE["model"], _RUNTIME_CACHE["meta"]
    model, meta = _load_if_exists()
    if model is None:
        model, meta = _train_model()
    _RUNTIME_CACHE.update({"model": model, "meta": meta, "version": meta.get("version")})
    return model, meta


def _normalize_score(df_val: float, meta: Dict[str, Any]) -> float:
    # Higher decision_function -> more normal; invert & normalize to [0,1]
    min_df = meta["min_df"]
    max_df = meta["max_df"]
    inverted = max_df - df_val
    denom = (max_df - min_df) or 1.0
    return max(0.0, min(1.0, inverted / denom))


def score_command(command: str) -> Dict[str, Any]:
    model, meta = ensure_model_loaded()
    feature_names = meta["feature_names"]

    _, vec = feature_vector(command)
    df_val = model.decision_function([vec])[0]
    base_score = _normalize_score(df_val, meta)

    # Boosting patterns
    patterns = _get_feature_patterns()
    matched = []
    total_boost = 0.0
    for p in patterns:
        try:
            import re
            if re.search(p["pattern_regex"], command):
                matched.append({
                    "name": p["pattern_name"],
                    "severity": p["severity"],
                    "boost_value": p["boost_value"],
                })
                total_boost += float(p["boost_value"] or 0.0)
        except re.error:
            continue

    boost_component = min(0.25, 0.02 * total_boost)
    boosted_score = min(1.0, base_score + boost_component)

    threshold = float(meta.get("config", {}).get("threshold") or 0.7)
    label = "ANOMALY" if boosted_score >= threshold else "NORMAL"

    features = extract_features(command)
    explanation_parts = []
    if boost_component > 0 and matched:
        explanation_parts.append("patterns: " + ", ".join(m["name"] for m in matched))
    if features["special_chars_count"] > 4:
        explanation_parts.append("high special char density")
    if features["entropy"] > 4.0:
        explanation_parts.append("elevated entropy")
    explanation = ", ".join(explanation_parts) or "baseline characteristics"

    def _pure(v):
        if isinstance(v, (np.floating,)):
            return float(v)
        if isinstance(v, (np.integer,)):
            return int(v)
        if isinstance(v, Decimal):
            return float(v)
        return v

    # Clean matched pattern boost values
    for m in matched:
        m['boost_value'] = _pure(m.get('boost_value'))

    clean_features = {k: _pure(v) for k, v in features.items()}

    return {
        "label": label,
        "base_score": _pure(base_score),
        "boosted_score": _pure(boosted_score),
        "threshold": _pure(threshold),
        "model_version": meta.get("version"),
        "matched_patterns": matched,
        "features": clean_features,
        "explanation": explanation,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


__all__ = ["score_command", "ensure_model_loaded"]
