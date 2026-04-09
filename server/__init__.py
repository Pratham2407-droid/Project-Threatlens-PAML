"""
server/__init__.py — Creates the Flask app and SocketIO instance.
Import `socketio` here so other modules share the same instance.
"""

from flask import Flask
from flask_socketio import SocketIO
from flask_cors import CORS

socketio = SocketIO(cors_allowed_origins="*")


def create_app():
    app = Flask(__name__)
    CORS(app)

    # Register REST routes
    from .routes import bp
    app.register_blueprint(bp)

    # Register WebSocket events (side-effect: decorators bind to socketio)
    from . import socket_events  # noqa: F401

    socketio.init_app(app)

    return app
