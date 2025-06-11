import logging
import os
import re
from typing import Any, Dict, Optional

import requests
import socketio
import yt_dlp
from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

load_dotenv()

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s"
)
logger = logging.getLogger(__name__)

SPOTIFY_CLIENT_ID = os.getenv("SPOTIFY_CLIENT_ID")
SPOTIFY_CLIENT_SECRET = os.getenv("SPOTIFY_CLIENT_SECRET")

app = FastAPI()
sio = socketio.AsyncServer(
    async_mode="asgi", cors_allowed_origins=["https://dismusic.distools.dev", "http://localhost:3000"]
)
asgi_app = socketio.ASGIApp(sio, app)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

user_queues: Dict[Any, list] = {}


def get_spotify_token() -> str:
    resp = requests.post(
        "https://accounts.spotify.com/api/token",
        data={"grant_type": "client_credentials"},
        auth=(SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET),
    )
    resp.raise_for_status()
    token = resp.json()["access_token"]
    logger.info("Spotify token obtained.")
    return token


spotify_token = get_spotify_token()
headers = {"Authorization": f"Bearer {spotify_token}"}


def extract_spotify_track_id(url: str) -> Optional[str]:
    match = re.search(r"track/([a-zA-Z0-9]+)", url)
    return match.group(1) if match else None


def extract_spotify_playlist_id(url: str) -> Optional[str]:
    match = re.search(r"playlist/([a-zA-Z0-9]+)", url)
    return match.group(1) if match else None


async def emit_queue_update(sid: Any) -> None:
    queue = user_queues.get(sid, [])
    await sio.emit(
        "queueUpdate",
        {
            "queue": [
                {
                    "title": f"{t['name']} - {t['artists'][0]['name']}",
                    "albumCover": t.get("album", {})
                    .get("images", [{}])[0]
                    .get("url", ""),
                }
                for t in queue
            ]
        },
        to=sid,
    )


async def find_youtube_url(search_string: str) -> Optional[str]:
    ydl_opts = {
        "quiet": True,
        "skip_download": True,
        "extract_flat": "in_playlist",
        "format": "bestaudio/best",
    }
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        search_query = f"ytsearch1:{search_string}"
        info = ydl.extract_info(search_query, download=False)
        if "entries" in info and info["entries"]:
            entry = info["entries"][0]
            url = entry.get("webpage_url") or entry.get("url")
            if url:
                logger.info(f"Found YouTube URL: {url}")
            else:
                logger.warning("No YouTube URL found.")
            return url
    logger.warning("No YouTube URL found.")
    return None


@sio.event
async def connect(sid: Any, environ: Any) -> None:
    logger.info(f"Client connected: {sid}")
    user_queues[sid] = []
    await emit_queue_update(sid)


@sio.event
async def disconnect(sid: Any) -> None:
    logger.info(f"Client disconnected: {sid}")
    user_queues.pop(sid, None)


@sio.event
async def play(sid: Any, data: Dict[str, Any]) -> None:
    query = data.get("query", "")
    logger.info(f"Received play event from {sid} with query: {query}")
    try:
        playlist_id = extract_spotify_playlist_id(query)
        if playlist_id:
            res = requests.get(
                f"https://api.spotify.com/v1/playlists/{playlist_id}",
                headers=headers,
            )
            tracks = [
                item["track"]
                for item in res.json()["tracks"]["items"]
                if item.get("track")
            ]
            user_queues[sid] = tracks
            await emit_queue_update(sid)
            if user_queues[sid]:
                track = user_queues[sid][0]
                search_string = (
                    f"{track['name']} {track['artists'][0]['name']}"
                )
                yt_url = await find_youtube_url(search_string)
                if yt_url:
                    await sio.emit("playYouTube", {"url": yt_url}, to=sid)
            return

        track_id = extract_spotify_track_id(query)
        if track_id:
            res = requests.get(
                f"https://api.spotify.com/v1/tracks/{track_id}",
                headers=headers,
            )
            track = res.json()
            user_queues[sid] = [track]
            await emit_queue_update(sid)
        else:
            res = requests.get(
                "https://api.spotify.com/v1/search",
                params={"q": query, "type": "track", "limit": 1},
                headers=headers,
            )
            items = res.json()["tracks"]["items"]
            if not items:
                logger.warning("No tracks found in Spotify search.")
                return
            track = items[0]
            user_queues[sid] = [track]
            await emit_queue_update(sid)

        search_string = f"{track['name']} {track['artists'][0]['name']}"
        yt_url = await find_youtube_url(search_string)
        if yt_url:
            await sio.emit("playYouTube", {"url": yt_url}, to=sid)
        else:
            logger.warning("No YouTube URL found for track.")
    except Exception as e:
        logger.error(f"Error in play event: {e}", exc_info=True)


@sio.event
async def next(sid: Any) -> None:
    logger.info(f"Received next event from {sid}")
    queue = user_queues.get(sid, [])
    if len(queue) > 1:
        queue.pop(0)
        await emit_queue_update(sid)
        track = queue[0]
        search_string = f"{track['name']} {track['artists'][0]['name']}"
        yt_url = await find_youtube_url(search_string)
        if yt_url:
            await sio.emit("playYouTube", {"url": yt_url}, to=sid)
        else:
            logger.warning("No YouTube URL found for next track.")
    else:
        user_queues[sid] = []
        await emit_queue_update(sid)
        await sio.emit("queueEnded", to=sid)
        logger.info("Queue ended.")


@app.post("/api/spotify")
async def api_spotify(request: Request) -> Any:
    body = await request.json()
    url = body.get("url")
    track_id = extract_spotify_track_id(url)
    if not track_id:
        logger.warning("Invalid Spotify track URL received.")
        return JSONResponse(
            {"error": "Invalid Spotify track URL"}, status_code=400
        )
    try:
        res = requests.get(
            f"https://api.spotify.com/v1/tracks/{track_id}", headers=headers
        )
        track = res.json()
        return {
            **track,
            "albumCover": track.get("album", {})
            .get("images", [{}])[0]
            .get("url", ""),
        }
    except Exception as e:
        logger.error(f"Failed to fetch track data: {e}", exc_info=True)
        return JSONResponse(
            {"error": "Failed to fetch track data"}, status_code=500
        )


if __name__ == "__main__":
    import uvicorn

    logger.info("Starting server on port 3001...")
    uvicorn.run("backend:asgi_app", host="0.0.0.0", port=3001, reload=True)