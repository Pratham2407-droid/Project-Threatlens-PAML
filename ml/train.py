import pandas as pd
import numpy as np
import pickle
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report

DATASET_PATH = "mock_network_traffic.csv"  # Replace with real dataset (KDD / CICIDS)
FEATURES = ["packets_per_sec", "unique_ports", "avg_packet_size", "connection_count"]
LABEL_COL = "label"
MODEL_OUTPUT = "model.pkl"


def generate_mock_data(n=1000):
    np.random.seed(42)
    normal = pd.DataFrame({
        "packets_per_sec": np.random.uniform(10, 100, int(n * 0.8)),
        "unique_ports": np.random.randint(1, 10, int(n * 0.8)),
        "avg_packet_size": np.random.uniform(100, 600, int(n * 0.8)),
        "connection_count": np.random.randint(5, 50, int(n * 0.8)),
        "label": 0,
    })
    attack = pd.DataFrame({
        "packets_per_sec": np.random.uniform(200, 500, int(n * 0.2)),
        "unique_ports": np.random.randint(20, 60, int(n * 0.2)),
        "avg_packet_size": np.random.uniform(700, 1400, int(n * 0.2)),
        "connection_count": np.random.randint(100, 300, int(n * 0.2)),
        "label": 1,
    })
    df = pd.concat([normal, attack]).sample(frac=1, random_state=42).reset_index(drop=True)
    df.to_csv(DATASET_PATH, index=False)
    return df


def load_data():
    try:
        return pd.read_csv(DATASET_PATH)
    except FileNotFoundError:
        return generate_mock_data()


def train():
    df = load_data()
    X = df[FEATURES]
    y = df[LABEL_COL]

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    model = RandomForestClassifier(n_estimators=100, random_state=42)
    model.fit(X_train, y_train)

    print(classification_report(y_test, model.predict(X_test)))

    with open(MODEL_OUTPUT, "wb") as f:
        pickle.dump(model, f)

    print(f"Saved: {MODEL_OUTPUT}")


if __name__ == "__main__":
    train()