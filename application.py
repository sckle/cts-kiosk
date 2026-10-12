"""WSGI entry point for running the kiosk site on AWS Elastic Beanstalk.

Serves the HTML pages and public conf/*.json files. Files under /static are
served directly by nginx (see .ebextensions/01_static.config).
"""
import mimetypes
import os
from wsgiref.util import FileWrapper

ROOT = os.path.dirname(os.path.abspath(__file__))
ALLOWED_EXTENSIONS = {
    ".html", ".json", ".js", ".css", ".png", ".jpg", ".jpeg", ".gif",
    ".svg", ".ico", ".mp4", ".webm",
}
BLOCKED_FILES = {os.path.join(ROOT, "conf", "settings.json")}


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


def application(environ, start_response):
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
    from wsgiref.simple_server import make_server

    port = int(os.environ.get("PORT", 8000))
    print(f"Serving on http://0.0.0.0:{port}")
    make_server("", port, application).serve_forever()
