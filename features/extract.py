import json
import requests

from features.config import SERVER_URL, NODE_ID, BATCH_SIZE
from features.utils import compute_features

packet_buffer = []


def send_features(features):
    payload = {
        "node_id": NODE_ID,
        **features
    }

    try:
        res = requests.post(SERVER_URL, json=payload)
        print("Sent:", payload)
        print("Response:", res.json())
    except Exception as e:
        print("Error sending data:", e)


def process_batch():
    global packet_buffer

    features = compute_features(packet_buffer)

    if features:
        send_features(features)

    packet_buffer = []


def read_packets():
    global packet_buffer

    try:
        with open("packets.jsonl", "r") as f:
            for line in f:
                packet = json.loads(line)
                packet_buffer.append(packet)

                if len(packet_buffer) >= BATCH_SIZE:
                    process_batch()

    except FileNotFoundError:
        print("packets.jsonl not found. Make sure capture module is running.")


if __name__ == "__main__":
    read_packets()
