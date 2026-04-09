# ThreatLens - ML-Based Distributed Intrusion Detection System

## Repo Structure

```
threatlens/
├── capture/        # Packet Capture Lead (Vishwas)
├── features/       # Feature Engineering Lead (Pratham)
├── ml/             # ML Model Lead (Vishruta)
├── server/         # Backend + Communication Lead (Pranav)
├── dashboard/      # Dashboard + Visualization Lead (Ibraheem)
├── simulation/     # Attack Simulation + Testing Lead (Tarun)
└── requirements.txt
```

Each team member works in their own folder. Drop your files there and open a PR.

---

## How the Pipeline Works

```
[capture/] --> [features/] --> POST /ingest --> [server/] --> ML predict --> WebSocket emit --> [dashboard/]
                                                                   ^
                                                              [ml/model.pkl]
```

1. `capture/capture.py` sniffs live packets and writes to `packets.jsonl`
2. Feature Engineering lead reads `packets.jsonl`, computes flow features, POSTs to `/ingest`
3. Backend server runs the ML model and stores alerts
4. Dashboard connects via WebSocket and receives live alerts

---

## Running the Backend Server

```bash
pip install -r requirements.txt
python -m server.app
```

Server starts at `http://0.0.0.0:5500`

---

## API Reference

### GET /status

Health check.

```json
{ "status": "ok", "time": "2025-01-01T00:00:00+00:00" }
```

---

### POST /ingest

**Called by: Feature Engineering lead**

Send computed flow features for ML classification.

**Request body:**

```json
{
  "node_id": "node-1",
  "packets_per_sec": 120,
  "unique_ports": 5,
  "avg_packet_size": 400,
  "connection_count": 30
}
```

**Response:**

```json
{
  "node_id": "node-1",
  "received_at": "2025-01-01T00:00:00+00:00",
  "prediction": "normal",
  "confidence": 0.97,
  "alert": false
}
```

`prediction` is either `"normal"` or `"attack"`. `alert: true` means an alert was stored and emitted via WebSocket.

---

### GET /alerts?limit=50

**Called by: Dashboard lead**

Returns the most recent alerts (default 50).

```json
[
  {
    "node_id": "node-1",
    "prediction": "attack",
    "confidence": 0.91,
    "alert": true,
    "received_at": "...",
    "features": { }
  }
]
```

---

### GET /logs?limit=100

Returns raw ingested feature logs (no ML result), useful for debugging.

---

## WebSocket (Dashboard lead)

Connect to `http://<server-ip>:5500` using Socket.IO.

**Events emitted by server:**

| Event | When | Payload |
|-------|------|---------|
| `connected` | On connect | `{ "message": "Connected to ThreatLens server" }` |
| `alert` | Attack detected | Same shape as `/alerts` response items |

**Example (JavaScript):**

```js
const socket = io("http://<server-ip>:5500");
socket.on("alert", (data) => {
  console.log("ATTACK DETECTED", data);
});
```

**Example (Python):**

```python
import socketio
sio = socketio.Client()

@sio.on("alert")
def on_alert(data):
    print("ATTACK DETECTED", data)

sio.connect("http://<server-ip>:5500")
```

---

## ML Model Integration (ML lead)

Drop your trained model at the **repo root** as `model.pkl`. The server auto-loads it on the first `/ingest` request — no restart needed.

**Model must support:**

```python
model.predict([[packets_per_sec, unique_ports, avg_packet_size, connection_count]])
# Returns: [0] for normal, [1] for attack
```

`predict_proba` is optional but used for confidence scores (Random Forest supports this).

---

## Packet Capture Output (Capture lead)

`capture/capture.py` writes to `packets.jsonl` in this format:

```json
{
  "src_ip": "192.168.1.5",
  "dst_ip": "142.250.182.14",
  "port": 443,
  "protocol": "TCP",
  "flags": "PA",
  "size": 512,
  "ttl": 64,
  "time": "2025-01-01T00:00:00"
}
```

Feature Engineering lead reads this file and produces the feature dict for `/ingest`.

---

## Quick Test

```bash
# Health check
curl http://localhost:5500/status

# Simulate normal traffic
curl -X POST http://localhost:5500/ingest -H "Content-Type: application/json" -d "{"node_id": "test", "packets_per_sec": 50, "unique_ports": 3, "avg_packet_size": 300, "connection_count": 10}"

# Simulate attack traffic (pps > 200 triggers alert in stub mode)
curl -X POST http://localhost:5500/ingest -H "Content-Type: application/json" -d "{"node_id": "test", "packets_per_sec": 250, "unique_ports": 40, "avg_packet_size": 900, "connection_count": 200}"

# Check stored alerts
curl http://localhost:5500/alerts
```

---

## Dependencies

```
scapy
flask
flask-socketio
flask-cors
```

Install: `pip install -r requirements.txt`
