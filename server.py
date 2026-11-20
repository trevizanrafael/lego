#!/usr/bin/env python3
"""
Servidor HTTP Multithread do Jogo + Painel Público /configs + API de Rádios & YouTube->MP3.
Porta padrão: 5173 (http://localhost:5173/ para o jogo e http://localhost:5173/configs para configurações).
Suporta HTTP Range (206 Partial Content) para seek instantâneo em MP3 da transmissão ao vivo estilo GTA 6.
"""

from __future__ import annotations

import base64
import glob
import json
import mimetypes
import os
import re
import shutil
import subprocess
import sys
import threading
import time
import urllib.request
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse

ROOT_DIR = Path(__file__).resolve().parent
DATA_DIR = ROOT_DIR / "data" / "radio"
MEDIA_DIR = DATA_DIR / "media"
STATE_FILE = DATA_DIR / "radio_state.json"
STATE_LOCK = threading.Lock()

DATA_DIR.mkdir(parents=True, exist_ok=True)
MEDIA_DIR.mkdir(parents=True, exist_ok=True)


def find_executable(name: str, extra_patterns: list[str]) -> str | None:
    found = shutil.which(name)
    if found:
        return found
    for pat in extra_patterns:
        matches = glob.glob(os.path.expandvars(pat))
        if matches:
            matches.sort(reverse=True)
            return matches[0]
    return None


YT_DLP_BIN = find_executable(
    "yt-dlp",
    [
        r"%LOCALAPPDATA%\Programs\Python\Python*\Scripts\yt-dlp.exe",
        r"%APPDATA%\Python\Python*\Scripts\yt-dlp.exe",
    ],
)

FFMPEG_BIN = find_executable(
    "ffmpeg",
    [
        r"%LOCALAPPDATA%\Microsoft\WinGet\Packages\*FFmpeg*\**\bin\ffmpeg.exe",
        r"C:\ffmpeg\bin\ffmpeg.exe",
    ],
)


def load_radio_state() -> dict:
    with STATE_LOCK:
        if not STATE_FILE.exists():
            return {"initialized": False, "stations": [], "tracks": [], "updatedAt": 0}
        try:
            data = json.loads(STATE_FILE.read_text(encoding="utf-8"))
            if isinstance(data, dict):
                data.setdefault("initialized", True)
                data.setdefault("stations", [])
                data.setdefault("tracks", [])
                return data
        except Exception:
            pass
        return {"initialized": False, "stations": [], "tracks": [], "updatedAt": 0}


def save_radio_state(state: dict) -> dict:
    with STATE_LOCK:
        clean = {
            "initialized": bool(state.get("initialized", True)),
            "stations": state.get("stations") if isinstance(state.get("stations"), list) else [],
            "tracks": state.get("tracks") if isinstance(state.get("tracks"), list) else [],
            "updatedAt": int(time.time() * 1000),
        }
        tmp_path = STATE_FILE.with_suffix(".tmp")
        tmp_path.write_text(json.dumps(clean, ensure_ascii=False, indent=2), encoding="utf-8")
        tmp_path.replace(STATE_FILE)
        return clean


def sanitize_id(raw: str, prefix: str = "trk") -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9_-]+", "_", str(raw or "")).strip("_")
    return cleaned[:64] if cleaned else f"{prefix}_{int(time.time() * 1000)}"


def decode_data_url(data_url: str) -> tuple[bytes, str] | None:
    if not data_url or not isinstance(data_url, str):
        return None
    if data_url.startswith("data:"):
        parts = data_url.split(",", 1)
        if len(parts) != 2:
            return None
        header, b64 = parts
        mime = "application/octet-stream"
        m = re.match(r"data:([^;]+)", header)
        if m:
            mime = m.group(1).lower()
        try:
            return base64.b64decode(b64), mime
        except Exception:
            return None
    try:
        return base64.b64decode(data_url), "audio/mpeg"
    except Exception:
        return None


def download_youtube_mp3_and_thumb(url: str) -> dict:
    if not url or not isinstance(url, str):
        raise ValueError("Informe um link válido do YouTube.")
    if not YT_DLP_BIN:
        raise RuntimeError("yt-dlp não encontrado no sistema. Instale com: pip install yt-dlp")

    stamp = f"yt_{int(time.time() * 1000)}"
    out_template = str(MEDIA_DIR / f"{stamp}_%(id)s.%(ext)s")

    cmd = [
        YT_DLP_BIN,
        "--no-playlist",
        "--no-warnings",
        "-x",
        "--audio-format",
        "mp3",
        "--audio-quality",
        "192K",
        "--write-thumbnail",
        "--convert-thumbnails",
        "jpg",
        "--print-json",
        "-o",
        out_template,
    ]
    if FFMPEG_BIN:
        cmd.extend(["--ffmpeg-location", str(Path(FFMPEG_BIN).parent)])
    cmd.append(url.strip())

    proc = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=240,
    )
    if proc.returncode != 0:
        err_msg = (proc.stderr or proc.stdout or "Falha ao baixar vídeo do YouTube.").strip()
        last_line = [ln for ln in err_msg.splitlines() if ln.strip()][-1] if err_msg else "Erro no yt-dlp"
        raise RuntimeError(last_line)

    info = {}
    for line in reversed(proc.stdout.splitlines()):
        line_s = line.strip()
        if line_s.startswith("{") and line_s.endswith("}"):
            try:
                info = json.loads(line_s)
                break
            except Exception:
                continue

    vid_id = sanitize_id(info.get("id") or "video", "yt")
    mp3_candidates = sorted(MEDIA_DIR.glob(f"{stamp}_*.mp3"))
    if not mp3_candidates:
        raise RuntimeError("O áudio MP3 não pôde ser extraído (verifique o link ou ffmpeg).")
    mp3_path = mp3_candidates[0]

    thumb_url_rel = ""
    img_candidates = sorted(
        list(MEDIA_DIR.glob(f"{stamp}_*.jpg"))
        + list(MEDIA_DIR.glob(f"{stamp}_*.jpeg"))
        + list(MEDIA_DIR.glob(f"{stamp}_*.png"))
        + list(MEDIA_DIR.glob(f"{stamp}_*.webp"))
    )
    if img_candidates:
        thumb_url_rel = f"/data/radio/media/{img_candidates[0].name}"
    else:
        remote_thumb = info.get("thumbnail") or (
            f"https://i.ytimg.com/vi/{info.get('id')}/hqdefault.jpg" if info.get("id") else ""
        )
        if remote_thumb:
            try:
                jpg_target = MEDIA_DIR / f"{stamp}_{vid_id}.jpg"
                urllib.request.urlretrieve(remote_thumb, str(jpg_target))
                thumb_url_rel = f"/data/radio/media/{jpg_target.name}"
            except Exception:
                thumb_url_rel = remote_thumb

    raw_title = str(info.get("track") or info.get("title") or mp3_path.stem).strip()
    raw_artist = str(
        info.get("artist")
        or info.get("creator")
        or info.get("uploader")
        or info.get("channel")
        or "YOUTUBE RADIO"
    ).strip()
    duration_sec = float(info.get("duration") or 180.0)

    return {
        "id": f"yt_{vid_id}_{int(time.time() * 1000) % 100000}",
        "title": raw_title,
        "artist": raw_artist,
        "durationSec": max(8.0, round(duration_sec, 2)),
        "src": f"/data/radio/media/{mp3_path.name}",
        "coverUrl": thumb_url_rel,
        "coverDataUrl": thumb_url_rel,
        "source": "youtube",
        "youtubeUrl": url.strip(),
        "isCustomFile": True,
    }


class LegoGameRequestHandler(SimpleHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT_DIR), **kwargs)

    def log_message(self, fmt: str, *args) -> None:
        # Mantém terminal limpo para chamadas frequentes de assets
        if self.path.startswith("/api/"):
            sys.stderr.write(f"[API] {self.command} {self.path}\n")

    def _send_json(self, payload: dict, status: int = 200) -> None:
        raw = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(raw)

    def _read_json_body(self) -> dict:
        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0:
            return {}
        raw = self.rfile.read(length)
        return json.loads(raw.decode("utf-8"))

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        clean_path = unquote(parsed.path)

        if clean_path == "/api/health":
            self._send_json(
                {
                    "ok": True,
                    "ytDlpAvailable": bool(YT_DLP_BIN),
                    "ffmpegAvailable": bool(FFMPEG_BIN),
                }
            )
            return

        if clean_path == "/api/radio/state":
            self._send_json(load_radio_state())
            return

        # Rota pública independente /configs -> configs/index.html
        if clean_path in ("/configs", "/configs/"):
            self.path = "/configs/index.html"
            return super().do_GET()

        # Suporte HTTP Range (206 Partial Content) para arquivos de áudio/mídia (seek instantâneo!)
        range_header = self.headers.get("Range")
        if range_header and clean_path.lower().endswith((".mp3", ".wav", ".ogg", ".m4a", ".webm")):
            fs_path = Path(self.translate_path(self.path))
            if fs_path.is_file():
                self._serve_range_file(fs_path, range_header)
                return

        super().do_GET()

    def _serve_range_file(self, fs_path: Path, range_header: str) -> None:
        file_size = fs_path.stat().st_size
        m = re.match(r"bytes=(\d*)-(\d*)", range_header)
        if not m:
            return super().do_GET()

        start_s, end_s = m.groups()
        start = int(start_s) if start_s else 0
        end = int(end_s) if end_s else file_size - 1
        start = max(0, min(start, file_size - 1))
        end = max(start, min(end, file_size - 1))
        chunk_len = end - start + 1

        ctype = mimetypes.guess_type(str(fs_path))[0] or "audio/mpeg"
        self.send_response(HTTPStatus.PARTIAL_CONTENT)
        self.send_header("Content-Type", ctype)
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Content-Range", f"bytes {start}-{end}/{file_size}")
        self.send_header("Content-Length", str(chunk_len))
        self.send_header("Cache-Control", "public, max-age=3600")
        self.end_headers()

        with fs_path.open("rb") as f:
            f.seek(start)
            remaining = chunk_len
            while remaining > 0:
                buf = f.read(min(65536, remaining))
                if not buf:
                    break
                try:
                    self.wfile.write(buf)
                except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError, OSError):
                    break
                remaining -= len(buf)

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        clean_path = unquote(parsed.path)

        try:
            if clean_path == "/api/radio/state":
                body = self._read_json_body()
                saved = save_radio_state(body)
                self._send_json({"ok": True, "state": saved})
                return

            if clean_path == "/api/radio/upload-track":
                body = self._read_json_body()
                track_id = sanitize_id(body.get("id") or f"mp3_{int(time.time() * 1000)}", "mp3")
                audio_data = decode_data_url(body.get("audioDataUrl") or "")
                src_url = str(body.get("src") or "")
                if audio_data:
                    raw_bytes, mime = audio_data
                    ext = ".wav" if "wav" in mime else ".ogg" if "ogg" in mime else ".mp3"
                    audio_file = MEDIA_DIR / f"{track_id}{ext}"
                    audio_file.write_bytes(raw_bytes)
                    src_url = f"/data/radio/media/{audio_file.name}"

                cover_url = str(body.get("coverDataUrl") or body.get("coverUrl") or "")
                if cover_url.startswith("data:image/") and "svg+xml" not in cover_url:
                    img_decoded = decode_data_url(cover_url)
                    if img_decoded:
                        img_bytes, img_mime = img_decoded
                        iext = ".png" if "png" in img_mime else ".webp" if "webp" in img_mime else ".jpg"
                        img_file = MEDIA_DIR / f"{track_id}_cover{iext}"
                        img_file.write_bytes(img_bytes)
                        cover_url = f"/data/radio/media/{img_file.name}"

                track_obj = {
                    "id": track_id,
                    "title": str(body.get("title") or "FAIXA IMPORTADA").strip(),
                    "artist": str(body.get("artist") or "ACERVO PESSOAL").strip(),
                    "durationSec": max(5.0, float(body.get("durationSec") or 150.0)),
                    "src": src_url,
                    "coverUrl": cover_url,
                    "coverDataUrl": cover_url or None,
                    "source": str(body.get("source") or "upload"),
                    "isCustomFile": True,
                }

                station_id = body.get("stationId")
                state = load_radio_state()
                if state.get("initialized") and station_id:
                    existing_ids = {t.get("id") for t in state["tracks"]}
                    if track_id not in existing_ids:
                        state["tracks"].append(track_obj)
                    else:
                        state["tracks"] = [track_obj if t.get("id") == track_id else t for t in state["tracks"]]
                    for st in state["stations"]:
                        if st.get("id") == station_id and track_id not in st.setdefault("trackIds", []):
                            st["trackIds"].append(track_id)
                    state = save_radio_state(state)

                self._send_json({"ok": True, "track": track_obj, "state": state})
                return

            if clean_path == "/api/radio/youtube":
                body = self._read_json_body()
                yt_url = str(body.get("url") or "").strip()
                station_id = body.get("stationId")
                track_obj = download_youtube_mp3_and_thumb(yt_url)

                state = load_radio_state()
                if not state.get("initialized") or not state.get("stations"):
                    state = {
                        "initialized": True,
                        "stations": [
                            {
                                "id": "station_padrao",
                                "name": "RÁDIO PADRÃO",
                                "freq": "101.5 FM",
                                "genre": "PROGRAMAÇÃO GERAL",
                                "color": "#facc15",
                                "icon": "antenna",
                                "trackIds": [track_obj["id"]],
                            }
                        ],
                        "tracks": [track_obj],
                    }
                else:
                    state["tracks"].append(track_obj)
                    placed = False
                    if station_id:
                        for st in state["stations"]:
                            if st.get("id") == station_id:
                                st.setdefault("trackIds", []).append(track_obj["id"])
                                placed = True
                                break
                    if not placed and state["stations"]:
                        state["stations"][0].setdefault("trackIds", []).append(track_obj["id"])

                saved = save_radio_state(state)
                self._send_json({"ok": True, "track": track_obj, "state": saved})
                return

            if clean_path == "/api/radio/delete-track":
                body = self._read_json_body()
                track_id = str(body.get("trackId") or "")
                state = load_radio_state()
                target = next((t for t in state.get("tracks", []) if t.get("id") == track_id), None)
                state["tracks"] = [t for t in state.get("tracks", []) if t.get("id") != track_id]
                for st in state.get("stations", []):
                    st["trackIds"] = [tid for tid in st.get("trackIds", []) if tid != track_id]
                saved = save_radio_state(state)

                # Remove mídia órfã em data/radio/media se existir
                if target:
                    for key in ("src", "coverUrl"):
                        rel = str(target.get(key) or "")
                        if rel.startswith("/data/radio/media/"):
                            fpath = ROOT_DIR / rel.lstrip("/")
                            if fpath.is_file():
                                try:
                                    fpath.unlink()
                                except Exception:
                                    pass
                self._send_json({"ok": True, "state": saved})
                return

            self._send_json({"ok": False, "error": f"Rota desconhecida: {clean_path}"}, 404)
        except Exception as exc:
            self._send_json({"ok": False, "error": str(exc)}, 400)


class QuietThreadingHTTPServer(ThreadingHTTPServer):
    daemon_threads = True

    def handle_error(self, request, client_address) -> None:
        exc = sys.exc_info()[1]
        if isinstance(exc, (BrokenPipeError, ConnectionResetError, ConnectionAbortedError)):
            return
        super().handle_error(request, client_address)


def main() -> None:
    port = int(os.environ.get("PORT", "5173"))
    server = QuietThreadingHTTPServer(("0.0.0.0", port), LegoGameRequestHandler)
    print(f"[LEGO Server] Jogo 3D:  http://localhost:{port}/")
    print(f"[LEGO Server] Configs:  http://localhost:{port}/configs")
    print(f"[LEGO Server] yt-dlp:   {YT_DLP_BIN or 'NÃO ENCONTRADO'}")
    print(f"[LEGO Server] ffmpeg:   {FFMPEG_BIN or 'NÃO ENCONTRADO'}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[LEGO Server] Encerrado.")
        server.server_close()


if __name__ == "__main__":
    main()
