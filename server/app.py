"""
app.py — Entry point. Run this to start the ThreatLens backend server.

Usage:
    python -m server.app
"""

from server import create_app, socketio

app = create_app()

if __name__ == "__main__":
    print("[*] ThreatLens backend starting on http://0.0.0.0:5000")
    print("[*] WebSocket ready for dashboard connections")
    socketio.run(app, host="0.0.0.0", port=5000, debug=True)
