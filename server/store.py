"""
store.py — Thread-safe in-memory store for alerts and recent packet logs.
Teammates can read from this; swap out for a DB later if needed.
"""

import threading
from collections import deque

_lock = threading.Lock()

# Circular buffers — keeps memory bounded
_alerts = deque(maxlen=500)
_logs   = deque(maxlen=1000)


def add_log(entry: dict):
    """Store a raw ingested feature entry."""
    with _lock:
        _logs.append(entry)


def add_alert(alert: dict):
    """Store a threat alert."""
    with _lock:
        _alerts.append(alert)


def get_alerts(limit: int = 50) -> list:
    with _lock:
        return list(_alerts)[-limit:]


def get_logs(limit: int = 100) -> list:
    with _lock:
        return list(_logs)[-limit:]
