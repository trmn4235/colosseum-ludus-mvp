"""Verify the exact production backup bytes, CORS and immutable model URL. Read-only."""
import hashlib
import json
from pathlib import Path
import re
import time
import urllib.request

root = Path(__file__).resolve().parents[1]
source = (root / "arena.html").read_text()
mirrors = json.loads(re.search(r"var ARENA_MODEL_MIRRORS=Object.freeze\((\{[^\n]+\})\);", source)[1])
for asset, expected in mirrors.items():
    local = (root / asset).read_bytes()
    assert len(local) == expected["bytes"]
    assert hashlib.sha256(local).hexdigest() == expected["sha256"]
    assert re.fullmatch(r"https://raw\.githubusercontent\.com/trmn4235/colosseum-ludus-mvp/[a-f0-9]{40}/" + re.escape(asset), expected["url"])
    for attempt in range(3):
        try:
            request = urllib.request.Request(expected["url"], headers={"User-Agent": "ColosseumModelCheck/222", "Origin": "https://trmn4235.github.io"})
            with urllib.request.urlopen(request, timeout=25) as response:
                assert response.status == 200
                assert response.headers.get("Access-Control-Allow-Origin") in ("*", "https://trmn4235.github.io"), "mirror must allow browser fetch"
                data = response.read(expected["bytes"] + 1)
            assert len(data) == expected["bytes"], "mirror size mismatch"
            assert hashlib.sha256(data).hexdigest() == expected["sha256"], "mirror version mismatch"
            print(f"PASS {asset}: {len(data)} bytes, exact SHA-256, browser CORS")
            break
        except Exception:
            if attempt == 2:
                raise
            time.sleep(2 * (attempt + 1))
