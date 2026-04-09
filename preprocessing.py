import pandas as pd
import numpy as np
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.model_selection import train_test_split
import joblib
import os

INPUT_FILE  = "dataset.csv"
OUTPUT_DIR  = "preprocessed"
LABEL_COL   = "Label"
TEST_SIZE   = 0.2
RANDOM_SEED = 42

os.makedirs(OUTPUT_DIR, exist_ok=True)

print("[1] Loading dataset...")
df = pd.read_csv(INPUT_FILE, low_memory=False)
df.columns = df.columns.str.strip()
print(f"    Shape: {df.shape}")

print("\n[2] Removing useless columns...")
df.replace([np.inf, -np.inf], np.nan, inplace=True)

id_cols = ["Flow ID", "Source IP", "Destination IP", "Src IP", "Dst IP", "Timestamp", "src_ip", "dst_ip"]
df.drop(columns=[c for c in id_cols if c in df.columns], inplace=True)

before = df.shape[1]
df.dropna(axis=1, thresh=int(0.5 * len(df)), inplace=True)
print(f"    Dropped {before - df.shape[1]} high-NaN columns")

before = df.shape[1]
df.drop(columns=[c for c in df.columns if c != LABEL_COL and df[c].nunique() <= 1], inplace=True)
print(f"    Dropped {before - df.shape[1]} zero-variance columns")

df.fillna(df.median(numeric_only=True), inplace=True)
print(f"    Shape after cleanup: {df.shape}")

print("\n[3] Encoding labels...")
df[LABEL_COL] = df[LABEL_COL].astype(str).str.strip()

df["label_binary"] = df[LABEL_COL].apply(lambda x: 0 if x.upper() == "BENIGN" else 1)

le = LabelEncoder()
df["label_encoded"] = le.fit_transform(df[LABEL_COL])

print(f"    Classes found ({len(le.classes_)}):")
for i, cls in enumerate(le.classes_):
    count = (df["label_encoded"] == i).sum()
    print(f"      [{i}] {cls:<35} {count:,} rows")

benign  = (df["label_binary"] == 0).sum()
attacks = (df["label_binary"] == 1).sum()
print(f"\n    Binary → BENIGN: {benign:,}  |  ATTACK: {attacks:,}")

df.drop(columns=[LABEL_COL], inplace=True)

print("\n[4] Scaling features...")
label_cols   = ["label_binary", "label_encoded"]
feature_cols = [c for c in df.columns if c not in label_cols]

X = df[feature_cols]
y = df[label_cols]

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=TEST_SIZE, random_state=RANDOM_SEED, stratify=df["label_binary"]
)

scaler = StandardScaler()
X_train_scaled = pd.DataFrame(scaler.fit_transform(X_train), columns=feature_cols)
X_test_scaled  = pd.DataFrame(scaler.transform(X_test),      columns=feature_cols)
print(f"    Train: {X_train_scaled.shape}  |  Test: {X_test_scaled.shape}")

print("\n[5] Saving outputs...")
train_df = pd.concat([X_train_scaled, y_train.reset_index(drop=True)], axis=1)
test_df  = pd.concat([X_test_scaled,  y_test.reset_index(drop=True)],  axis=1)

train_df.to_csv(f"{OUTPUT_DIR}/train.csv", index=False)
test_df.to_csv( f"{OUTPUT_DIR}/test.csv",  index=False)
joblib.dump(scaler, f"{OUTPUT_DIR}/scaler.pkl")
joblib.dump(le,     f"{OUTPUT_DIR}/label_encoder.pkl")

print(f"    train.csv         → {OUTPUT_DIR}/train.csv")
print(f"    test.csv          → {OUTPUT_DIR}/test.csv")
print(f"    scaler.pkl        → {OUTPUT_DIR}/scaler.pkl")
print(f"    label_encoder.pkl → {OUTPUT_DIR}/label_encoder.pkl")
print("\n Done!")
