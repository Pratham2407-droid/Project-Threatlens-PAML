import requests
import time
import random

SERVER_URL = "http://localhost:5500/ingest"


def generate_normal():
    return {
        "node_id": "sim-node",
        "packets_per_sec": random.randint(20, 80),
        "unique_ports": random.randint(1, 5),
        "avg_packet_size": random.randint(200, 500),
        "connection_count": random.randint(5, 30)
    }


def generate_attack():
    return {
        "node_id": "sim-node",
        "packets_per_sec": random.randint(200, 500),
        "unique_ports": random.randint(20, 60),
        "avg_packet_size": random.randint(800, 1400),
        "connection_count": random.randint(100, 300)
    }


def run_simulation():
    print("Starting Threat Simulation...\n")

    while True:
        # 70% normal, 30% attack
        if random.random() < 0.7:
            data = generate_normal()
            print("Normal traffic:", data)
        else:
            data = generate_attack()
            print(" ATTACK traffic:", data)

        try:
            response = requests.post(SERVER_URL, json=data)
            print("Response:", response.json())
        except Exception as e:
            print("Error sending data:", e)

        print("-" * 50)
        time.sleep(1)


if __name__ == "__main__":
    run_simulation()
