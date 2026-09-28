"""
Local Development Server for Opportunity Culture Goals Heatmap.
Uses only Python Standard Library (no pip dependencies required).
"""

import os
import sys
import json
import mimetypes
from http.server import HTTPServer, BaseHTTPRequestHandler
from pathlib import Path
import urllib.parse
import webbrowser

# Directories
BASE_DIR = Path(__file__).resolve().parent
PUBLIC_DIR = BASE_DIR / "public"
DATA_DIR = BASE_DIR / "data"
MOCK_FILE = DATA_DIR / "mock_data.json"
CACHE_FILE = DATA_DIR / "asana_cache.json"
ENV_FILE = BASE_DIR / ".env"

PORT = 8080


class HeatmapRequestHandler(BaseHTTPRequestHandler):
    def end_headers(self):
        # Enable CORS for local testing
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        # REST API: GET /api/matrix
        if path == "/api/matrix":
            self.send_matrix_data()
            return

        # Static Files from public/
        if path == "/" or path == "":
            file_path = PUBLIC_DIR / "index.html"
        else:
            clean_path = path.lstrip("/")
            file_path = PUBLIC_DIR / clean_path

        if file_path.exists() and file_path.is_file():
            self.send_static_file(file_path)
        else:
            # 404
            self.send_response(404)
            self.send_header("Content-Type", "text/plain")
            self.end_headers()
            self.wfile.write(b"404 Not Found")

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length) if content_length > 0 else b""

        # REST API: POST /api/settings
        if path == "/api/settings":
            try:
                payload = json.loads(body.decode("utf-8"))
                token = payload.get("asana_token", "").strip()
                workspace = payload.get("workspace_gid", "").strip()

                # Write to .env
                with open(ENV_FILE, "w", encoding="utf-8") as f:
                    f.write(f"ASANA_ACCESS_TOKEN={token}\n")
                    if workspace:
                        f.write(f"ASANA_WORKSPACE_GID={workspace}\n")

                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"status": "success", "message": "Credentials saved"}).encode("utf-8"))
            except Exception as e:
                self.send_response(500)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"status": "error", "message": str(e)}).encode("utf-8"))
            return

        # REST API: POST /api/sync
        if path == "/api/sync":
            try:
                import sync_asana
                data = sync_asana.sync()
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps(data).encode("utf-8"))
            except Exception as e:
                self.send_response(500)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"status": "error", "message": str(e)}).encode("utf-8"))
            return

        self.send_response(404)
        self.end_headers()

    def send_matrix_data(self):
        # Serve cache if exists, otherwise mock
        target_file = CACHE_FILE if CACHE_FILE.exists() else MOCK_FILE
        if target_file.exists():
            with open(target_file, "rb") as f:
                content = f.read()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(content)))
            self.end_headers()
            self.wfile.write(content)
        else:
            self.send_response(404)
            self.end_headers()

    def send_static_file(self, file_path):
        mime_type, _ = mimetypes.guess_type(str(file_path))
        if not mime_type:
            mime_type = "application/octet-stream"

        with open(file_path, "rb") as f:
            content = f.read()

        self.send_response(200)
        self.send_header("Content-Type", mime_type)
        self.send_header("Content-Length", str(len(content)))
        self.end_headers()
        self.wfile.write(content)

    def log_message(self, format, *args):
        # Clean logging
        sys.stderr.write(f"[{self.log_date_time_string()}] {format % args}\n")


def run_server():
    server_address = ("", PORT)
    httpd = HTTPServer(server_address, HeatmapRequestHandler)
    url = f"http://localhost:{PORT}"
    print("=" * 60)
    print(f" Opportunity Culture - Asana Goals Heatmap Server Running")
    print(f" Local URL: {url}")
    print(" Press Ctrl+C to stop the server")
    print("=" * 60)

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping server...")
        httpd.server_close()


if __name__ == "__main__":
    run_server()
