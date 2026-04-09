import pickle

MODEL_PATH = "model.pkl"
FEATURES = ["packets_per_sec", "unique_ports", "avg_packet_size", "connection_count"]

_model = None


def load_model():
    global _model
    if _model is None:
        with open(MODEL_PATH, "rb") as f:
            _model = pickle.load(f)
    return _model


def predict(feature_dict: dict) -> dict:
    model = load_model()
    values = [[feature_dict[f] for f in FEATURES]]
    prediction = int(model.predict(values)[0])
    confidence = None
    if hasattr(model, "predict_proba"):
        proba = model.predict_proba(values)[0]
        confidence = round(float(max(proba)), 4)
    return {
        "prediction": "attack" if prediction == 1 else "normal",
        "confidence": confidence,
        "alert": prediction == 1,
    }