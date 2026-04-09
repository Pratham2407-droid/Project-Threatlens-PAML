"""
socket_events.py — WebSocket event handlers (Flask-SocketIO).

The dashboard connects here to receive live alerts without polling.
"""

from flask_socketio import emit
from . import socketio


@socketio.on("connect")
def on_connect():
    print("[WS] Dashboard client connected")
    emit("connected", {"message": "Connected to ThreatLens server"})


@socketio.on("disconnect")
def on_disconnect():
    print("[WS] Dashboard client disconnected")


def emit_alert(alert: dict):
    """
    Called by routes.py whenever the ML model flags an attack.
    Pushes the alert to all connected dashboard clients.
    """
    socketio.emit("alert", alert)
