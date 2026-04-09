"""
routes.py — REST API endpoints.

POST /ingest   → receive features from a node, run ML, store + emit alert
GET  /alerts   → fetch recent alerts (for dashboard polling)
GET  /logs     → fetch recent raw feature logs
GET  /status   → health check
"""

from datetime import datetime, timezone
from flask import Blueprint, request, jsonify
from . import store, ml_interface

bp = Blueprint("routes", __name__)


@bp.route("/status", methods=["GET"])
def status():
    return jsonify({"status": "ok", "time": _now()})


@bp.route("/ingest", methods=["POST"])
def ingest():
    """
    Called by each node (Feature Engineering lead's output).
    Expected JSON body:
        {
            "node_id": "node-1",          # optional, identifies the sender
            "packets_per_sec": 120,
            "unique_ports": 5,
            "avg_packet_size": 400,
            "connection_count": 30
        }
    """
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Invalid or missing JSON body"}), 400

    # Stamp when we received it
    data.setdefault("node_id", "unknown")
    data["received_at"] = _now()

    store.add_log(data)

    # Run prediction
    result = ml_interface.predict(data)

    response = {
        "node_id":    data["node_id"],
        "received_at": data["received_at"],
        **result,
    }

    # Only store + emit if it's flagged as an attack
    if result["alert"]:
        alert = {**response, "features": data}
        store.add_alert(alert)

        # Emit to dashboard via WebSocket (imported here to avoid circular import)
        from .socket_events import emit_alert
        emit_alert(alert)

    return jsonify(response), 200


@bp.route("/alerts", methods=["GET"])
def alerts():
    limit = request.args.get("limit", 50, type=int)
    return jsonify(store.get_alerts(limit=limit))


@bp.route("/logs", methods=["GET"])
def logs():
    limit = request.args.get("limit", 100, type=int)
    return jsonify(store.get_logs(limit=limit))


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()
