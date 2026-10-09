"""Serve working-copy experiment files; cache unchanged public game assets locally."""
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from urllib.request import urlopen
from urllib.parse import urlsplit
import mimetypes
import threading
import tempfile

ROOT = Path(__file__).resolve().parent.parent
CACHE = Path(tempfile.gettempdir()) / 'colosseum-training-cache'
CACHE.mkdir(exist_ok=True)
locks = {}
guard = threading.Lock()


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def do_GET(self):
        name = urlsplit(self.path).path.lstrip('/') or 'training-test-v50.html'
        if '..' in Path(name).parts:
            self.send_error(400)
            return
        try:
            target = ROOT / name
            if not target.is_file():
                target = CACHE / name
                with guard:
                    lock = locks.setdefault(name, threading.Lock())
                with lock:
                    if not target.is_file():
                        with urlopen('https://trmn4235.github.io/colosseum-ludus-mvp/' + name, timeout=60) as response:
                            content = response.read()
                        target.parent.mkdir(parents=True, exist_ok=True)
                        target.write_bytes(content)
            content = target.read_bytes()
            self.send_response(200)
            self.send_header('Content-Type', mimetypes.guess_type(name)[0] or 'application/octet-stream')
            self.send_header('Content-Length', str(len(content)))
            self.send_header('Cache-Control', 'public, max-age=3600')
            self.end_headers()
            self.wfile.write(content)
        except Exception as error:
            print(name, type(error).__name__, str(error), flush=True)
            self.send_error(404)


if __name__ == '__main__':
    server = ThreadingHTTPServer(('127.0.0.1', 9033), Handler)
    print('training test server ready', flush=True)
    server.serve_forever()
