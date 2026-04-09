"""
serve.py — Standalone lightweight HTTP server for the ThreatLens dashboard.

Usage (from project root):
    python dashboard/serve.py

Opens the dashboard at http://localhost:8080
The dashboard will connect to the Flask backend at the URL specified in the UI.
"""

import http.server
import os
import webbrowser
import functools

PORT = 8080
DASHBOARD_DIR = os.path.dirname(os.path.abspath(__file__))


def main():
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=DASHBOARD_DIR)
    with http.server.HTTPServer(("0.0.0.0", PORT), handler) as httpd:
        url = f"http://localhost:{PORT}"
        print(f"[*] ThreatLens Dashboard running at {url}")
        print(f"[*] Serving files from: {DASHBOARD_DIR}")
        print("[*] Press Ctrl+C to stop\n")
        try:
            webbrowser.open(url)
        except Exception:
            pass
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n[!] Dashboard server stopped.")


if __name__ == "__main__":
    main()
