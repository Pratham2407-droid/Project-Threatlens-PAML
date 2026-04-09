"""
ml_interface.py — Wraps the ML model.
Loads model.pkl from the ML lead when it's ready.
Until then, returns a stub prediction so the rest of the pipeline works.
"""

import os
import pickle

_model = None
MODEL_PATH = os.path.join(os.path.dirname(__file__), "..", "model.pkl")


def _load_model():
    global _model
    if os.path.exists(MODEL_PATH):
        with open(MODEL_PATH, "rb") as f:
            _model = pickle.load(f)
        print(f"[ML] Loaded model from {MODEL_PATH}")
    else:
        print("[ML] model.pkl not found — running in stub mode")


def predict(features: dict) -> dict:
    """
    Takes a feature dict from the Feature Engineering lead and returns a prediction.

    Expected input keys (at minimum):
        packets_per_sec, unique_ports, avg_packet_size, connection_count

    Returns:
        { "prediction": "normal"|"attack", "confidence": float, "alert": bool }
    """
    if _model is None:
        _load_model()

    if _model is not None:
        # Real model path — build feature vector in the order the model expects
        feature_order = [
            "packets_per_sec",
            "unique_ports",
            "avg_packet_size",
            "connection_count",
        ]
        vector = [[features.get(k, 0) for k in feature_order]]
        label = _model.predict(vector)[0]
        # Confidence if model supports it (Random Forest does)
        if hasattr(_model, "predict_proba"):
            proba = _model.predict_proba(vector)[0]
            confidence = float(max(proba))
        else:
            confidence = 1.0
        prediction = "attack" if label == 1 else "normal"
    else:
        # Stub: flag as attack if packets_per_sec looks abnormal (>200)
        pps = features.get("packets_per_sec", 0)
        prediction = "attack" if pps > 200 else "normal"
        confidence = 0.0  # signals stub mode to callers

    return {
        "prediction": prediction,
        "confidence": confidence,
        "alert": prediction == "attack",
    }
