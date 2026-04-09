"""
server/__init__.py — Creates the Flask app and SocketIO instance.
Import `socketio` here so other modules share the same instance.
Also serves the dashboard UI as static files at /dashboard/.
"""

import os
from flask import Flask, send_from_directory, redirect
from flask_socketio import SocketIO
from flask_cors import CORS

socketio = SocketIO(cors_allowed_origins="*")

# Path to the dashboard folder (relative to repo root)
_DASHBOARD_DIR = os.path.join(os.path.dirname(__file__), "..", "dashboard")


def create_app():
    app = Flask(__name__)
    CORS(app)

    # Register REST routes
    from .routes import bp
    app.register_blueprint(bp)

    # Register WebSocket events (side-effect: decorators bind to socketio)
    from . import socket_events  # noqa: F401

    # ── Serve Dashboard UI ─────────────────────────────────────────────────
    @app.route("/dashboard/")
    def dashboard_index():
        return send_from_directory(os.path.abspath(_DASHBOARD_DIR), "index.html")

    @app.route("/dashboard/<path:filename>")
    def dashboard_static(filename):
        return send_from_directory(os.path.abspath(_DASHBOARD_DIR), filename)

    @app.route("/")
    def root_redirect():
        return redirect("/dashboard/")

    socketio.init_app(app)

    return app
