"""WSGI entry point for running the kiosk site on AWS Elastic Beanstalk.

Serves the HTML pages and public conf/*.json files. Files under /static are
served directly by nginx (see .ebextensions/01_static.config).

POST /api/upload/github-copilot-image replaces the chart shown on
github-copilot.html (upload form shown with github-copilot.html?upload).
"""
import json
import mimetypes
import os
import tempfile
import xml.etree.ElementTree as ET
from urllib.parse import unquote
from wsgiref.util import FileWrapper

ROOT = os.path.dirname(os.path.abspath(__file__))
ALLOWED_EXTENSIONS = {
    ".html", ".json", ".js", ".css", ".png", ".jpg", ".jpeg", ".gif",
    ".svg", ".ico", ".mp4", ".webm",
}
BLOCKED_FILES = {os.path.join(ROOT, "conf", "settings.json")}

UPLOAD_PATH = "/api/upload/github-copilot-image"
UPLOAD_FILENAME = "all-models-cost-vs-intelligence.svg"
UPLOAD_DIR = os.path.join(ROOT, "static", "image")
# Matches nginx's default client_max_body_size on Elastic Beanstalk.
UPLOAD_MAX_BYTES = 1024 * 1024
SVG_FORBIDDEN_TAGS = {"script", "foreignobject", "iframe", "embed", "object"}


def _resolve(path_info):
    rel = path_info.lstrip("/") or "index.html"
    full = os.path.realpath(os.path.join(ROOT, rel))
    if os.path.isdir(full):
        full = os.path.join(full, "index.html")
    if not full.startswith(ROOT + os.sep):
        return None
    if any(part.startswith(".") for part in os.path.relpath(full, ROOT).split(os.sep)):
        return None
    if full in BLOCKED_FILES or os.path.splitext(full)[1].lower() not in ALLOWED_EXTENSIONS:
        return None
    return full if os.path.isfile(full) else None


def _json_response(start_response, status, message, ok=False):
    body = json.dumps({"ok": ok, "message": message}).encode()
    start_response(status, [("Content-Type", "application/json"), ("Content-Length", str(len(body)))])
    return [body]


def _svg_problem(data):
    """Return a reason the data is not a safe SVG, or None if it is acceptable."""
    try:
        root = ET.fromstring(data)
    except ET.ParseError as exc:
        return f"File is not valid XML/SVG ({exc})."
    if root.tag.rsplit("}", 1)[-1].lower() != "svg":
        return "File is not an SVG image."
    for el in root.iter():
        if not isinstance(el.tag, str):
            continue
        if el.tag.rsplit("}", 1)[-1].lower() in SVG_FORBIDDEN_TAGS:
            return "SVG must not contain scripts or embedded content."
        for name, value in el.attrib.items():
            local = name.rsplit("}", 1)[-1].lower()
            if local.startswith("on"):
                return "SVG must not contain event handler attributes."
            if local == "href" and value.strip().lower().startswith(("javascript:", "data:text/html")):
                return "SVG must not contain script links."
    return None


def _handle_upload(environ, start_response):
    # The client URL-encodes the name so non-ASCII file names survive the header.
    filename = unquote(environ.get("HTTP_X_FILENAME", "")).strip()
    if not filename.lower().endswith(".svg"):
        return _json_response(
            start_response, "400 Bad Request",
            f'"{filename}" is not an .svg file.',
        )

    try:
        length = int(environ.get("CONTENT_LENGTH") or 0)
    except ValueError:
        length = 0
    if length <= 0:
        return _json_response(start_response, "400 Bad Request", "The file is empty.")
    if length > UPLOAD_MAX_BYTES:
        return _json_response(
            start_response, "413 Payload Too Large",
            f"File is too large (max {UPLOAD_MAX_BYTES // 1024} KB).",
        )

    data = environ["wsgi.input"].read(length)
    if len(data) != length:
        return _json_response(start_response, "400 Bad Request", "Upload was incomplete.")

    problem = _svg_problem(data)
    if problem:
        return _json_response(start_response, "400 Bad Request", problem)

    os.makedirs(UPLOAD_DIR, exist_ok=True)
    fd, tmp_path = tempfile.mkstemp(dir=UPLOAD_DIR, prefix=".upload-", suffix=".svg")
    try:
        with os.fdopen(fd, "wb") as f:
            f.write(data)
        # mkstemp creates 0600; nginx serves /static and must be able to read it.
        os.chmod(tmp_path, 0o644)
        os.replace(tmp_path, os.path.join(UPLOAD_DIR, UPLOAD_FILENAME))
    except OSError as exc:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
        return _json_response(start_response, "500 Internal Server Error", f"Could not save file ({exc.strerror}).")

    return _json_response(start_response, "200 OK", f"Saved static/image/{UPLOAD_FILENAME}.", ok=True)


def application(environ, start_response):
    if environ.get("PATH_INFO") == UPLOAD_PATH:
        if environ.get("REQUEST_METHOD") != "POST":
            start_response("405 Method Not Allowed", [("Content-Type", "text/plain"), ("Allow", "POST")])
            return [b"Method Not Allowed"]
        return _handle_upload(environ, start_response)

    if environ.get("REQUEST_METHOD") not in ("GET", "HEAD"):
        start_response("405 Method Not Allowed", [("Content-Type", "text/plain"), ("Allow", "GET, HEAD")])
        return [b"Method Not Allowed"]

    full = _resolve(environ.get("PATH_INFO", "/"))
    if full is None:
        start_response("404 Not Found", [("Content-Type", "text/plain")])
        return [b"Not Found"]

    content_type = mimetypes.guess_type(full)[0] or "application/octet-stream"
    headers = [
        ("Content-Type", content_type),
        ("Content-Length", str(os.path.getsize(full))),
        ("Cache-Control", "no-cache"),
    ]
    start_response("200 OK", headers)
    if environ["REQUEST_METHOD"] == "HEAD":
        return [b""]
    return FileWrapper(open(full, "rb"))


if __name__ == "__main__":
    from socketserver import ThreadingMixIn
    from wsgiref.simple_server import WSGIServer, make_server

    class ThreadingWSGIServer(ThreadingMixIn, WSGIServer):
        daemon_threads = True

    port = int(os.environ.get("PORT", 8000))
    print(f"Serving on http://0.0.0.0:{port}", flush=True)
    make_server("", port, application, server_class=ThreadingWSGIServer).serve_forever()
