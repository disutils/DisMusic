const express = require("express");
const http = require("http");
const SpotifyWebApi = require("spotify-web-api-node");
const ytSearch = require("yt-search");
const cors = require("cors");
const { Pool, Client } = require("pg");
require("dotenv").config({ path: require('path').resolve(__dirname, '../.env') });
const fetch = require("node-fetch");
const crypto = require("crypto");
const axios = require("axios");
const ytpl = require("ytpl");
const { getAppleMusicToken } = require("./appleMusicToken");
const APPLE_MUSIC_TRACK_REGEX = /music\.apple\.com\/(?:[a-zA-Z-]+\/)?(?:album|song)\/(?:[\w-]+)\/(\d+)(?:\?i=(\d+))?/;
const APPLE_MUSIC_PLAYLIST_REGEX = /music\.apple\.com\/(?:[a-zA-Z-]+\/)?playlist\/(?:[\w-]+)\/(pl\.[\w-]+)/;
const APPLE_MUSIC_API_BASE = "https://amp-api.music.apple.com/v1/catalog";
// Use Apple Music web API endpoints instead of amp-api.music.apple.com
const APPLE_MUSIC_WEB_API_BASE = "https://music.apple.com/api/v1/catalog";

const app = express();
const server = http.createServer(app);

const io = require("socket.io")(server, {
    cors: {
        origin: process.env.CORS_ORIGIN || "https://dismusic.distools.dev",
        methods: ["GET", "POST"]
    }
});

// CORS: allow credentials and only allow frontend origin
app.use(cors({
  origin: (origin, callback) => {
    const allowedOrigins = [
      process.env.CORS_ORIGIN || "https://dismusic.distools.dev"
    ];
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, origin);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true
}));


app.use(express.json());
app.use(express.static("public"));

const spotifyApi = new SpotifyWebApi({
    clientId: process.env.SPOTIFY_CLIENT_ID,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET
});

let cachedQueue = [];
const userQueues = {};

async function getSpotifyToken() {
    const data = await spotifyApi.clientCredentialsGrant();
    spotifyApi.setAccessToken(data.body['access_token']);
}
getSpotifyToken();

function extractSpotifyTrackId(url) {
    const match = url.match(/track\/([a-zA-Z0-9]+)/);
    return match ? match[1] : null;
}

function extractSpotifyPlaylistId(url) {
    const match = url.match(/playlist\/([a-zA-Z0-9]+)/);
    return match ? match[1] : null;
}

function extractYouTubeVideoId(url) {
    const match = url.match(/(?:v=|youtu\.be\/)([\w-]{11})/);
    return match ? match[1] : null;
}

function extractYouTubePlaylistId(url) {
    const match = url.match(/[?&]list=([\w-]+)/);
    return match ? match[1] : null;
}

function extractAppleMusicTrackId(url) {
    const match = url.match(APPLE_MUSIC_TRACK_REGEX);
    // For /album/ URLs with ?i=, match[2] is the trackId; for /song/ URLs, match[1] is the trackId
    if (match && match[2]) return match[2];
    if (match && match[1]) return match[1];
    return null;
}
function extractAppleMusicPlaylistId(url) {
    const match = url.match(APPLE_MUSIC_PLAYLIST_REGEX);
    return match ? match[1] : null;
}

function formatDuration(seconds) {
    if (!seconds || isNaN(seconds)) return "-";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function emitQueueUpdate(socket) {
    const queue = userQueues[socket.id] || [];
    socket.emit("queueUpdate", {
        queue: queue.map(t => {
            let duration = "-";
            if (t.duration) {
                if (typeof t.duration === "number") duration = formatDuration(t.duration);
                else if (typeof t.duration === "string") duration = t.duration;
            } else if (t.duration_ms) {
                duration = formatDuration(Math.round(t.duration_ms / 1000));
            }
            return {
                title: `${t.name || t.title || "Unknown Track"}`,
                artist: t.artists && t.artists[0]?.name ? t.artists[0].name : (t.artist || "Unknown Artist"),
                albumCover: t.album?.images?.[0]?.url || t.albumCover || "",
                duration
            };
        })
    });
}

async function findYouTubeUrl(searchString) {
    const result = await ytSearch(searchString);
    if (result && result.videos && result.videos.length > 0) {
        const video = result.videos[0];
        return { url: video.url, duration: video.duration.seconds };
    }
    return null;
}

async function fetchAppleMusicTrack(trackId, storefront = "us") {
    const token = await getAppleMusicToken();
    const res = await axios.get(`${APPLE_MUSIC_WEB_API_BASE}/${storefront}/songs/${trackId}`, {
        headers: {
            Authorization: `Bearer ${token}`,
            Origin: "https://music.apple.com"
        }
    });
    console.log("[APPLE MUSIC TRACK RAW DATA]", JSON.stringify(res.data, null, 2));
    return res.data.data[0];
}
async function fetchAppleMusicPlaylist(playlistId, storefront = "us") {
    const token = await getAppleMusicToken();
    const res = await axios.get(`${APPLE_MUSIC_WEB_API_BASE}/${storefront}/playlists/${playlistId}`, {
        headers: {
            Authorization: `Bearer ${token}`,
            Origin: "https://music.apple.com"
        }
    });
    return res.data.data[0];
}

io.on("connection", (socket) => {
    userQueues[socket.id] = [];
    emitQueueUpdate(socket);

    socket.on("disconnect", () => {
        delete userQueues[socket.id];
    });

    socket.on("play", async ({ query }) => {
        try {
            // Handle in-house playlist (object with tracks)
            if (query && typeof query === "object" && query.inhouse && Array.isArray(query.tracks)) {
                // Fetch metadata for each track URL
                const tracksWithMeta = await Promise.all(query.tracks.map(async (trackUrl) => {
                    // YouTube
                    const ytVideoId = extractYouTubeVideoId(trackUrl);
                    if (ytVideoId) {
                        const result = await ytSearch({ videoId: ytVideoId });
                        if (result && result.title) {
                            return {
                                name: result.title,
                                artists: [{ name: result.author.name }],
                                albumCover: result.thumbnail,
                                duration: result.seconds,
                                youtubeUrl: result.url
                            };
                        }
                    }
                    // Spotify
                    const spotifyTrackId = extractSpotifyTrackId(trackUrl);
                    if (spotifyTrackId) {
                        try {
                            const trackRes = await spotifyApi.getTrack(spotifyTrackId);
                            const track = trackRes.body;
                            // Find YouTube URL for this track
                            const searchString = `${track.name} ${track.artists[0]?.name || ''}`;
                            const ytUrl = await findYouTubeUrl(searchString);
                            return {
                                ...track,
                                youtubeUrl: ytUrl?.url || null
                            };
                        } catch (e) {
                            // fallback: just return url
                            return { name: trackUrl };
                        }
                    }
                    // Fallback: try to search YouTube by URL as string (for generic/unknown links)
                    const ytResult = await findYouTubeUrl(trackUrl);
                    if (ytResult) {
                        return {
                            name: trackUrl,
                            youtubeUrl: ytResult.url,
                            duration: ytResult.duration
                        };
                    }
                    // Fallback: just return url as name
                    return { name: trackUrl };
                }));
                userQueues[socket.id] = tracksWithMeta;
                emitQueueUpdate(socket);
                // Optionally, emit a custom event or just play the first track if you want
                if (tracksWithMeta[0]?.youtubeUrl) {
                    socket.emit("playYouTube", { url: tracksWithMeta[0].youtubeUrl });
                }
                return;
            }
            // --- YOUTUBE PLAYLIST ---
            const ytPlaylistId = extractYouTubePlaylistId(query);
            if (ytPlaylistId) {
                try {
                    // Try to use ytpl with options that might help with token issues
                    const playlist = await ytpl(ytPlaylistId, {
                        limit: 100,
                        requestOptions: {
                            headers: {
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                            }
                        }
                    });

                    userQueues[socket.id] = playlist.items.map(item => ({
                        name: item.title,
                        artists: [{ name: item.author.name }],
                        albumCover: item.bestThumbnail.url,
                        duration: item.durationSec ? parseInt(item.durationSec) : null,
                        youtubeUrl: item.shortUrl || item.url
                    }));

                    emitQueueUpdate(socket);
                    if (userQueues[socket.id].length > 0) {
                        socket.emit("playYouTube", { url: userQueues[socket.id][0].youtubeUrl });
                    }
                } catch (err) {
                    console.error("YouTube playlist fetch error:", err);
                    // Fallback: Extract the first video ID from playlist URL and play it
                    const videoId = extractYouTubeVideoId(query);
                    if (videoId) {
                        try {
                            const result = await ytSearch({ videoId });
                            if (result && result.title) {
                                userQueues[socket.id] = [{
                                    name: result.title,
                                    artists: [{ name: result.author.name }],
                                    albumCover: result.thumbnail,
                                    duration: result.seconds,
                                    youtubeUrl: result.url
                                }];
                                emitQueueUpdate(socket);
                                socket.emit("playYouTube", { url: result.url });
                            } else {
                                // Last resort: just return a generic error message to the client
                                socket.emit("error", { message: "Could not play this YouTube playlist. Try using a direct video link instead." });
                            }
                        } catch (innerErr) {
                            console.error("YouTube video fallback error:", innerErr);
                            socket.emit("error", { message: "Could not play this YouTube playlist or extract videos from it." });
                        }
                    } else {
                        socket.emit("error", { message: "Invalid YouTube playlist. Please check the URL and try again." });
                    }
                }
                return;
            }
            // --- YOUTUBE SINGLE VIDEO ---
            const ytVideoId = extractYouTubeVideoId(query);
            if (ytVideoId) {
                const result = await ytSearch({ videoId: ytVideoId });
                if (result && result.title) {
                    userQueues[socket.id] = [{
                        name: result.title,
                        artists: [{ name: result.author.name }],
                        albumCover: result.thumbnail,
                        duration: result.seconds,
                        youtubeUrl: result.url
                    }];
                    emitQueueUpdate(socket);
                    socket.emit("playYouTube", { url: result.url });
                    return;
                }
            }
            // --- SPOTIFY PLAYLIST ---
            const playlistId = extractSpotifyPlaylistId(query);
            if (playlistId) {
                const playlistRes = await spotifyApi.getPlaylist(playlistId);
                const tracks = playlistRes.body.tracks.items.map(item => item.track);
                userQueues[socket.id] = tracks.filter(Boolean);
                emitQueueUpdate(socket);
                if (userQueues[socket.id].length > 0) {
                    const track = userQueues[socket.id][0];
                    const searchString = `${track.name} ${track.artists[0].name}`;
                    const ytUrl = await findYouTubeUrl(searchString);
                    if (ytUrl) {
                        socket.emit("playYouTube", { url: ytUrl });
                    }
                }
                return;
            }

            // --- APPLE MUSIC PLAYLIST ---
            const applePlaylistId = extractAppleMusicPlaylistId(query);
            if (applePlaylistId) {
                const playlist = await fetchAppleMusicPlaylist(applePlaylistId);
                const tracks = (playlist.relationships.tracks.data || []);
                userQueues[socket.id] = tracks.map(track => ({
                    name: track.attributes.name,
                    artists: [{ name: track.attributes.artistName }],
                    albumCover: track.attributes.artwork?.url?.replace('{w}x{h}bb', '300x300bb') || "",
                    duration: Math.round(track.attributes.durationInMillis / 1000),
                    appleMusicUrl: track.attributes.url
                }));
                emitQueueUpdate(socket);
                if (userQueues[socket.id].length > 0) {
                    socket.emit("playAppleMusic", { url: userQueues[socket.id][0].appleMusicUrl });
                }
                return;
            }
            // --- APPLE MUSIC TRACK ---
            const appleTrackId = extractAppleMusicTrackId(query);
            if (appleTrackId) {
                const track = await fetchAppleMusicTrack(appleTrackId);
                userQueues[socket.id] = [{
                    name: track.attributes.name,
                    artists: [{ name: track.attributes.artistName }],
                    albumCover: track.attributes.artwork?.url?.replace('{w}x{h}bb', '300x300bb') || "",
                    duration: Math.round(track.attributes.durationInMillis / 1000),
                    appleMusicUrl: track.attributes.url
                }];
                emitQueueUpdate(socket);
                socket.emit("playAppleMusic", { url: track.attributes.url });
                return;
            }
            // --- SPOTIFY TRACK BY ID ---
            const trackId = extractSpotifyTrackId(query);
            if (trackId) {
                const spotifyRes = await spotifyApi.getTrack(trackId);
                track = spotifyRes.body;
                userQueues[socket.id] = [track];
                emitQueueUpdate(socket);
            } else {
                // --- SPOTIFY SEARCH TRACK ---
                const spotifyRes = await spotifyApi.searchTracks(query, { limit: 1 });
                if (!spotifyRes.body.tracks.items.length) return;
                track = spotifyRes.body.tracks.items[0];
                userQueues[socket.id] = [track];
                emitQueueUpdate(socket);
            }

            const searchString = `${track.name} ${track.artists[0].name}`;
            const ytUrl = await findYouTubeUrl(searchString);
            if (ytUrl) {
                socket.emit("playYouTube", { url: ytUrl });
            }
        } catch (err) {
            console.error("Error in play event:", err);
            if (
                err &&
                (err.body?.error?.message === 'The access token expired' ||
                 (typeof err.message === 'string' && err.message.includes('The access token expired')))
            ) {
                console.error("Access token expired. Refreshing token...");
                await getSpotifyToken();
            }
        }
    });

    socket.on("next", async () => {
        const queue = userQueues[socket.id] || [];
        if (queue.length > 1) {
            queue.shift();
            emitQueueUpdate(socket);
            const track = queue[0];
            const searchString = `${track.name} ${track.artists[0].name}`;
            const ytUrl = await findYouTubeUrl(searchString);
            if (ytUrl) {
                socket.emit("playYouTube", { url: ytUrl });
            }
        } else {
            userQueues[socket.id] = [];
            emitQueueUpdate(socket);
            socket.emit("queueEnded");
        }
    });

    socket.on("playNext", async (index) => {
        const queue = userQueues[socket.id] || [];
        if (index > 0 && index < queue.length) {
            // Move the selected track to the position after current track
            const track = queue.splice(index, 1)[0];
            queue.splice(1, 0, track);
            userQueues[socket.id] = queue;
            emitQueueUpdate(socket);
        }
    });

    socket.on("removeFromQueue", (index) => {
        const queue = userQueues[socket.id] || [];
        if (index >= 0 && index < queue.length) {
            // Don't allow removing currently playing track (index 0)
            if (index === 0) return;
            queue.splice(index, 1);
            userQueues[socket.id] = queue;
            emitQueueUpdate(socket);
        }
    });

    socket.on("moveTrack", async (fromIndex, toIndex) => {
        console.log("[SOCKET] moveTrack event received", { fromIndex, toIndex });
        const queue = userQueues[socket.id] || [];
        if (fromIndex > 0 && fromIndex < queue.length && toIndex >= 0 && toIndex < queue.length) {
            // Move the selected track to the target position
            const track = queue.splice(fromIndex, 1)[0];
            queue.splice(toIndex, 0, track);
            userQueues[socket.id] = queue;
            emitQueueUpdate(socket);
        }
    });

    socket.on("remove", (index) => {
        console.log("[SOCKET] remove event received", { index });
        const queue = userQueues[socket.id] || [];
        if (index >= 0 && index < queue.length) {
            // Don't allow removing currently playing track (index 0)
            if (index === 0) return;
            queue.splice(index, 1);
            userQueues[socket.id] = queue;
            emitQueueUpdate(socket);
        }
    });

    socket.on("addToQueue", async ({ query }) => {
        try {
            // --- YOUTUBE PLAYLIST ---
            const ytPlaylistId = extractYouTubePlaylistId(query);
            if (ytPlaylistId) {
                try {
                    // Try to use ytpl with options that might help with token issues
                    const playlist = await ytpl(ytPlaylistId, {
                        limit: 100,
                        requestOptions: {
                            headers: {
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                            }
                        }
                    });
                    userQueues[socket.id] = [...(userQueues[socket.id] || []), ...playlist.items.map(item => ({
                        name: item.title,
                        artists: [{ name: item.author.name }],
                        albumCover: item.bestThumbnail.url,
                        duration: item.durationSec ? parseInt(item.durationSec) : null,
                        youtubeUrl: item.shortUrl || item.url
                    }))];
                    emitQueueUpdate(socket);
                    return;
                } catch (err) {
                    console.error("YouTube playlist fetch error in addToQueue:", err);
                    // Alternative approach: use ytsearch to search for the playlist and get some videos
                    try {
                        // For playlists, extract just the playlist name/ID for search
                        const searchQuery = query.includes('list=')
                            ? `playlist ${query.split('list=')[1].split('&')[0]}`
                            : query;
                        const searchResults = await ytSearch(searchQuery);

                        if (searchResults && searchResults.videos && searchResults.videos.length > 0) {
                            // Just add the first video as a fallback
                            const video = searchResults.videos[0];
                            userQueues[socket.id].push({
                                name: video.title,
                                artists: [{ name: video.author.name }],
                                albumCover: video.thumbnail,
                                duration: video.seconds,
                                youtubeUrl: video.url
                            });
                            emitQueueUpdate(socket);
                            socket.emit("message", {
                                type: "warning",
                                content: "Could not load full playlist, but added first video from search results."
                            });
                            return;
                        }
                    } catch (innerErr) {
                        console.error("Fallback YouTube search error:", innerErr);
                    }
                    socket.emit("error", { message: "Could not add YouTube playlist to queue. Try using a direct video link instead." });
                    return;
                }
            }
            // --- YOUTUBE SINGLE VIDEO ---
            const ytVideoId = extractYouTubeVideoId(query);
            if (ytVideoId) {
                const result = await ytSearch({ videoId: ytVideoId });
                if (result && result.title) {
                    userQueues[socket.id].push({
                        name: result.title,
                        artists: [{ name: result.author.name }],
                        albumCover: result.thumbnail,
                        duration: result.seconds,
                        youtubeUrl: result.url
                    });
                    emitQueueUpdate(socket);
                    return;
                }
            }
            // --- SPOTIFY PLAYLIST ---
            const playlistId = extractSpotifyPlaylistId(query);
            if (playlistId) {
                const playlistRes = await spotifyApi.getPlaylist(playlistId);
                const tracks = playlistRes.body.tracks.items.map(item => item.track);
                userQueues[socket.id] = [...(userQueues[socket.id] || []), ...tracks.filter(Boolean)];
                emitQueueUpdate(socket);
                return;
            }

            // --- APPLE MUSIC PLAYLIST ---
            const applePlaylistId = extractAppleMusicPlaylistId(query);
            if (applePlaylistId) {
                const playlist = await fetchAppleMusicPlaylist(applePlaylistId);
                const tracks = (playlist.relationships.tracks.data || []);
                userQueues[socket.id] = [...(userQueues[socket.id] || []), ...tracks.map(track => ({
                    name: track.attributes.name,
                    artists: [{ name: track.attributes.artistName }],
                    albumCover: track.attributes.artwork?.url?.replace('{w}x{h}bb', '300x300bb') || "",
                    duration: Math.round(track.attributes.durationInMillis / 1000),
                    appleMusicUrl: track.attributes.url
                }))];
                emitQueueUpdate(socket);
                return;
            }
            // --- APPLE MUSIC TRACK ---
            const appleTrackId = extractAppleMusicTrackId(query);
            if (appleTrackId) {
                const track = await fetchAppleMusicTrack(appleTrackId);
                userQueues[socket.id].push({
                    name: track.attributes.name,
                    artists: [{ name: track.attributes.artistName }],
                    albumCover: track.attributes.artwork?.url?.replace('{w}x{h}bb', '300x300bb') || "",
                    duration: Math.round(track.attributes.durationInMillis / 1000),
                    appleMusicUrl: track.attributes.url
                });
                emitQueueUpdate(socket);
                return;
            }

            let track;
            // --- SPOTIFY TRACK BY ID ---
            const trackId = extractSpotifyTrackId(query);
            if (trackId) {
                const spotifyRes = await spotifyApi.getTrack(trackId);
                track = spotifyRes.body;
                userQueues[socket.id].push(track);
            } else {
                // --- SPOTIFY SEARCH TRACK ---
                const spotifyRes = await spotifyApi.searchTracks(query, { limit: 1 });
                if (!spotifyRes.body.tracks.items.length) return;
                track = spotifyRes.body.tracks.items[0];
                userQueues[socket.id].push(track);
            }
            emitQueueUpdate(socket);
        } catch (err) {
            console.error("Error in addToQueue event:", err);
        }
    });

    emitQueueUpdate(socket);
});

app.post("/api/spotify", async (req, res) => {
    const { url } = req.body;
    try {
        const playlistId = extractSpotifyPlaylistId(url);
        if (playlistId) {
            if (!playlistId) {
                return res.status(400).json({ error: "Invalid or missing Spotify playlist ID" });
            }
            const playlistRes = await spotifyApi.getPlaylist(playlistId);
            const playlist = playlistRes.body;
            // Get unique album covers from all tracks
            const uniqueCovers = [...new Set(
                (playlist.tracks.items || [])
                .map(item => item.track?.album?.images?.[0]?.url || "")
                .filter(Boolean)
            )];
            // Take first 4 unique covers, if not enough unique covers, repeat the last one
            const covers = uniqueCovers.length >= 4
                ? uniqueCovers.slice(0, 4)
                : [...uniqueCovers, ...Array(4 - uniqueCovers.length).fill(uniqueCovers[uniqueCovers.length - 1] || "")];

            return res.json({
                name: playlist.name,
                covers,
                tracks: (playlist.tracks.items || []).map(item => ({
                    albumCover: item.track?.album?.images?.[0]?.url || "",
                    name: item.track?.name || "",
                }))
            });
        }
        const trackId = extractSpotifyTrackId(url);
        if (!trackId) return res.status(400).json({ error: "Invalid Spotify track or playlist URL" });
        try {
            const spotifyRes = await spotifyApi.getTrack(trackId);
            const track = spotifyRes.body;
            // Add the largest album cover as a top-level field
            res.json({
                ...track,
                albumCover: track.album?.images?.[0]?.url || ""
            });
        } catch (err) {
            if (err && err.body && err.body.error && err.body.error.status === 404) {
                return res.status(404).json({ error: "Spotify track not found" });
            }
            throw err;
        }
    } catch (err) {
        console.error("/api/spotify error:", err);
        if (err && err.body && err.body.error) {
            return res.status(500).json({ error: err.body.error.message, details: err.body });
        }
        res.status(500).json({ error: "Failed to fetch track or playlist data", details: err && err.message ? err.message : err });
    }
});

// --- APPLE MUSIC API: GET track or playlist info ---
app.post("/api/applemusic", async (req, res) => {
    const { url } = req.body;
    try {
        const playlistId = extractAppleMusicPlaylistId(url);
        if (playlistId) {
            const playlist = await fetchAppleMusicPlaylist(playlistId);
            const covers = (playlist.relationships.tracks.data || [])
                .slice(0, 4)
                .map(track => track.attributes.artwork?.url?.replace('{w}x{h}bb', '300x300bb') || "")
                .filter(Boolean);
            return res.json({
                name: playlist.attributes.name,
                covers,
                tracks: (playlist.relationships.tracks.data || []).map(track => ({
                    albumCover: track.attributes.artwork?.url?.replace('{w}x{h}bb', '300x300bb') || "",
                    name: track.attributes.name || "",
                }))
            });
        }
        const trackId = extractAppleMusicTrackId(url);
        if (!trackId) return res.status(400).json({ error: "Invalid Apple Music track or playlist URL" });
        const track = await fetchAppleMusicTrack(trackId);
        res.json({
            ...track.attributes,
            albumCover: track.attributes.artwork?.url?.replace('{w}x{h}bb', '300x300bb') || ""
        });
    } catch (err) {
        console.error("/api/applemusic error:", err);
        res.status(500).json({ error: "Failed to fetch Apple Music track or playlist data", details: err && err.message ? err.message : err });
    }
});

// --- YOUTUBE API: GET track or playlist info ---
app.post("/api/youtube", async (req, res) => {
    const { url } = req.body;
    try {
        // Extract playlist ID from YouTube or YouTube Music URL
        const playlistId = extractYouTubePlaylistId(url);
        if (!playlistId) {
            return res.status(400).json({ error: "Invalid YouTube playlist URL" });
        }

        try {
            // Use ytpl to fetch playlist information
            const playlist = await ytpl(playlistId, {
                limit: 50,
                requestOptions: {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                    }
                }
            });

            // Format the response to match what our frontend expects
            const formattedResponse = {
                title: playlist.title,
                name: playlist.title,
                thumbnail: playlist.bestThumbnail?.url,
                tracks: playlist.items.map(item => ({
                    name: item.title,
                    artist: item.author.name,
                    thumbnail: item.bestThumbnail?.url || null,
                    duration: item.durationSec || null
                }))
            };

            return res.json(formattedResponse);
        } catch (err) {
            console.error("YouTube playlist fetch error:", err);
            return res.status(500).json({ error: "Failed to fetch YouTube playlist", details: err.message });
        }
    } catch (err) {
        console.error("/api/youtube error:", err);
        res.status(500).json({ error: "Failed to fetch YouTube data", details: err.message });
    }
});


// Helper to upsert user in DB
async function upsertUser({ id, username, avatar, global_name, playlists = [], queue = [] }) {
  const pool = global.pgPool;
  const userpfpurl = avatar
    ? `https://cdn.discordapp.com/avatars/${id}/${avatar}.png`
    : null;
  // Generate a secure session token
  const sessionToken = crypto.randomBytes(32).toString("hex");
  await pool.query(
    `INSERT INTO users (userid, username, display_name, userpfpurl, userplaylists, userqueue)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (userid) DO UPDATE SET username = $2, display_name = $3, userpfpurl = $4`,
    [id, username, global_name, userpfpurl, JSON.stringify(playlists), JSON.stringify(queue)]
  );
  // Save session token to a new table or upsert to users (for simplicity, add to users)
  await pool.query(
    `UPDATE users SET sessiontoken = $2 WHERE userid = $1`,
    [id, sessionToken]
  );
  return sessionToken;
}

app.get("/discord/callback", async (req, res) => {
  const code = req.query.code;
  if (!code) return res.status(400).send("Missing code");

  const CLIENT_ID = process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID;
  const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
  const REDIRECT_URI = process.env.NEXT_PUBLIC_DISCORD_REDIRECT_URI;

  // Exchange code for access token
  const params = new URLSearchParams();
  params.append("client_id", CLIENT_ID);
  params.append("client_secret", CLIENT_SECRET);
  params.append("grant_type", "authorization_code");
  params.append("code", code);
  params.append("redirect_uri", REDIRECT_URI);
  params.append("scope", "identify email");

  try {
    const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      return res.status(400).json({ error: "Failed to get access token", details: tokenData });
    }

    // Fetch user info
    const userRes = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });
    const userData = await userRes.json();
    if (!userData.id) {
      return res.status(400).json({ error: "Failed to get user info", details: userData });
    }

    // Upsert user in DB and get session token
    const sessionToken = await upsertUser({ ...userData, global_name: userData.global_name });
    // Redirect to frontend login page with token as query param
    res.redirect(`${process.env.CORS_ORIGIN || "https://dismusic.distools.dev"}/login?token=${sessionToken}`);
  } catch (err) {
    res.status(500).json({ error: "Discord OAuth error", details: err.message });
  }
});

async function ensureDatabaseAndTable() {
    // Connect to the default 'postgres' database to create 'music' if it doesn't exist
    const adminClient = new Client({
        connectionString: process.env.DATABASE_URL.replace(/\/music(\"?)$/, "/postgres$1"),
        ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('sslmode=require') ? { rejectUnauthorized: false } : false
    });
    try {
        await adminClient.connect();
        await adminClient.query("CREATE DATABASE music");
        console.log("Database 'music' created.");
    } catch (err) {
        if (err.code === '42P04') {
            console.log("Database 'music' already exists.");
        } else if (err.code === '3D000') {
            console.error("Cannot create database: ", err);
        } else {
            console.error("Error creating database:", err);
        }
    } finally {
        await adminClient.end();
    }

    // Now connect to the 'music' database and create the tables if they don't exist
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('sslmode=require') ? { rejectUnauthorized: false } : false
    });
    try {
        // Users table (existing)
        await pool.query(`CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            userid TEXT UNIQUE,
            username TEXT,
            display_name TEXT,
            userpfpurl TEXT,
            userplaylists JSONB,
            userqueue JSONB,
            sessiontoken TEXT
        )`);
        // Ensure display_name column exists (for legacy tables)
        await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name TEXT`);
        // User playlists table (new)
        await pool.query(`CREATE TABLE IF NOT EXISTS user_playlists (
            id SERIAL PRIMARY KEY,
            userid TEXT REFERENCES users(userid) ON DELETE CASCADE,
            name TEXT NOT NULL,
            tracks JSONB DEFAULT '[]',
            created_at TIMESTAMP DEFAULT NOW()
        )`);
        // User favorite songs table (new)
        await pool.query(`CREATE TABLE IF NOT EXISTS user_favorites (
            id SERIAL PRIMARY KEY,
            userid TEXT REFERENCES users(userid) ON DELETE CASCADE,
            tracks JSONB DEFAULT '[]',
            updated_at TIMESTAMP DEFAULT NOW()
        )`);
        console.log("Tables 'users', 'user_playlists', and 'user_favorites' ensured.");
    } catch (err) {
        console.error("Error creating tables:", err);
    }
    return pool;
}

app.get("/test", (req, res) => {
    res.send("Backend is working!");
});

// --- PLAYLISTS API: GET and POST for user playlists by session token ---

// Middleware to get user by session token
async function getUserBySessionToken(sessionToken) {
  const pool = global.pgPool;
  const result = await pool.query(
    'SELECT * FROM users WHERE sessiontoken = $1',
    [sessionToken]
  );
  return result.rows[0];
}

// GET playlists for the user (by session token in Authorization header)
app.get("/api/user/playlists", async (req, res) => {
  const auth = req.headers["authorization"];
  if (!auth || !auth.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid Authorization header" });
  }
  const sessionToken = auth.replace("Bearer ", "");
  try {
    const user = await getUserBySessionToken(sessionToken);
    if (!user) return res.status(401).json({ error: "Invalid session token" });
    let playlists = [];
    // Get playlists from user.userplaylists (legacy)
    try {
      if (typeof user.userplaylists === "string") {
        playlists = JSON.parse(user.userplaylists);
      } else if (Array.isArray(user.userplaylists)) {
        playlists = user.userplaylists;
      } else if (user.userplaylists && typeof user.userplaylists === "object") {
        playlists = user.userplaylists;
      } else {
        playlists = [];
      }
    } catch (e) {
      playlists = [];
    }
    // Get playlists from user_playlists table (new)
    const pool = global.pgPool;
    const dbPlaylistsRes = await pool.query(
      'SELECT id, name, tracks, created_at FROM user_playlists WHERE userid = $1 ORDER BY created_at DESC',
      [user.userid]
    );
    const dbPlaylists = dbPlaylistsRes.rows.map(row => ({
      id: row.id,
      name: row.name,
      tracks: row.tracks,
      created_at: row.created_at
    }));
    // Merge both sources for now (legacy + new)
    res.json({ playlists: [...dbPlaylists, ...playlists] });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch playlists" });
  }
});

// POST playlists for the user (by session token in Authorization header)
app.post("/api/user/playlists", async (req, res) => {
  const auth = req.headers["authorization"];
  if (!auth || !auth.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid Authorization header" });
  }
  const sessionToken = auth.replace("Bearer ", "");
  const { playlists } = req.body;
  if (!Array.isArray(playlists)) {
    return res.status(400).json({ error: "Playlists must be an array" });
  }
  try {
    const user = await getUserBySessionToken(sessionToken);
    if (!user) return res.status(401).json({ error: "Invalid session token" });
    const pool = global.pgPool;
    await pool.query(
      'UPDATE users SET userplaylists = $1 WHERE sessiontoken = $2',
      [JSON.stringify(playlists), sessionToken]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to save playlists" });
  }
});

// DELETE playlist for the user (by session token in Authorization header)
app.delete("/api/user/playlists", async (req, res) => {
  const auth = req.headers["authorization"];
  if (!auth || !auth.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid Authorization header" });
  }
  const sessionToken = auth.replace("Bearer ", "");
  const { playlistIndex, playlistName, playlistId } = req.body;
  if (playlistIndex === undefined && !playlistName && !playlistId) {
    return res.status(400).json({ error: "Missing playlist identifier (index, name, or id)" });
  }
  try {
    const user = await getUserBySessionToken(sessionToken);
    if (!user) return res.status(401).json({ error: "Invalid session token" });
    let playlists = [];
    if (typeof user.userplaylists === "string") {
      playlists = JSON.parse(user.userplaylists);
    } else if (Array.isArray(user.userplaylists)) {
      playlists = user.userplaylists;
    } else if (user.userplaylists && typeof user.userplaylists === "object") {
      playlists = user.userplaylists;
    }
    const pool = global.pgPool;
    let legacyChanged = false;
    // Remove from legacy playlists by index or name
    if (playlistIndex !== undefined) {
      playlists.splice(playlistIndex, 1);
      legacyChanged = true;
    } else if (playlistName) {
      playlists = playlists.filter(p => p.name !== playlistName);
      legacyChanged = true;
    }
    // Remove from user_playlists table by id
    if (playlistId) {
      console.log("[DELETE PLAYLIST] Attempting to delete:", { playlistId, userId: user.userid });
      const delRes = await pool.query(
        'DELETE FROM user_playlists WHERE id = $1 AND userid = $2',
        [Number(playlistId), user.userid]
      );
      console.log("[DELETE PLAYLIST] Rows affected:", delRes.rowCount);
    }
    // Only update legacy playlists if changed
    if (legacyChanged) {
      await pool.query(
        'UPDATE users SET userplaylists = $1 WHERE sessiontoken = $2',
        [JSON.stringify(playlists), sessionToken]
      );
    }
    // Return updated playlists (from both sources)
    const dbPlaylistsRes = await pool.query(
      'SELECT id, name, tracks, created_at FROM user_playlists WHERE userid = $1 ORDER BY created_at DESC',
      [user.userid]
    );
    const dbPlaylists = dbPlaylistsRes.rows.map(row => ({
      id: row.id,
      name: row.name,
      tracks: row.tracks,
      created_at: row.created_at
    }));
    res.json({ success: true, playlists: [...dbPlaylists, ...playlists] });
  } catch (err) {
    console.error("[DELETE PLAYLIST ERROR]", err);
    res.status(500).json({ error: "Failed to delete playlist" });
  }
});

// --- CREATE PLAYLIST API: POST /api/user/playlist/create ---
app.post("/api/user/playlist/create", async (req, res) => {
  const auth = req.headers["authorization"];
  if (!auth || !auth.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid Authorization header" });
  }
  const sessionToken = auth.replace("Bearer ", "");
  const { name, tracks = [] } = req.body;
  if (!name || typeof name !== "string") {
    return res.status(400).json({ error: "Missing or invalid playlist name" });
  }
  try {
    const user = await getUserBySessionToken(sessionToken);
    if (!user) return res.status(401).json({ error: "Invalid session token" });
    const pool = global.pgPool;
    // Hydrate tracks with metadata before saving
    const hydratedTracks = await Promise.all(tracks.map(async (trackUrl) => {
      // YouTube
      const ytVideoId = extractYouTubeVideoId(trackUrl);
      if (ytVideoId) {
        const result = await ytSearch({ videoId: ytVideoId });
        if (result && result.title) {
          return {
            name: result.title,
            artists: [{ name: result.author.name }],
            albumCover: result.thumbnail,
            duration: result.seconds,
            youtubeUrl: result.url
          };
        }
      }
      // Spotify
      const spotifyTrackId = extractSpotifyTrackId(trackUrl);
      if (spotifyTrackId) {
        try {
          const trackRes = await spotifyApi.getTrack(spotifyTrackId);
          const track = trackRes.body;
          // Find YouTube URL for this track
          const searchString = `${track.name} ${track.artists[0]?.name || ''}`;
          const ytUrl = await findYouTubeUrl(searchString);
          return {
            ...track,
            youtubeUrl: ytUrl?.url || null
          };
        } catch (e) {
          return { name: trackUrl };
        }
      }
      // Fallback: try to search YouTube by URL as string (for generic/unknown links)
      const ytResult = await findYouTubeUrl(trackUrl);
      if (ytResult) {
        return {
          name: trackUrl,
          youtubeUrl: ytResult.url,
          duration: ytResult.duration
        };
      }
      // Fallback: just return url as name
      return { name: trackUrl };
    }));
    // Insert into user_playlists table
    await pool.query(
      'INSERT INTO user_playlists (userid, name, tracks) VALUES ($1, $2, $3)',
      [user.userid, name, JSON.stringify(hydratedTracks)]
    );
    res.json({ success: true });
  } catch (err) {
    console.error("[BACKEND] Error in /api/user/playlist/create POST:", err);
    res.status(500).json({ error: "Failed to create playlist" });
  }
});


app.get("/api/user/playlist/:id", async (req, res) => {
    const auth = req.headers["authorization"];
    if (!auth || !auth.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Missing or invalid Authorization header" });
    }
    const sessionToken = auth.replace("Bearer ", "");
    const playlistId = req.params.id;
    try {
        const user = await getUserBySessionToken(sessionToken);
        if (!user) return res.status(401).json({ error: "Invalid session token" });
        const pool = global.pgPool;
        // First, check if playlist exists at all
        const existsRes = await pool.query(
            'SELECT id, userid, name, tracks, created_at FROM user_playlists WHERE id = $1',
            [playlistId]
        );
        if (existsRes.rows.length === 0) {
            return res.status(404).json({ error: "Playlist not found" });
        }
        const playlist = existsRes.rows[0];
        if (playlist.userid !== user.userid) {
            return res.status(403).json({ error: "You do not have access to this playlist" });
        }
        // Only return if user owns it
        res.json({
            id: playlist.id,
            name: playlist.name,
            tracks: playlist.tracks,
            created_at: playlist.created_at
        });
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch playlist" });
    }
})




// --- USER INFO API: GET user info by session token ---
app.get("/api/user/info", async (req, res) => {
  const auth = req.headers["authorization"];
  if (!auth || !auth.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid Authorization header" });
  }
  const sessionToken = auth.replace("Bearer ", "");
  try {
    const user = await getUserBySessionToken(sessionToken);
    if (!user) return res.status(401).json({ error: "Invalid session token" });
    res.json({
      username: user.username || null,
      userpfpurl: user.userpfpurl || null,
      userid: user.userid || null,
      display_name: user.display_name || null
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch user info" });
  }
});

// --- LOGOUT API: Invalidate session token ---
app.post("/api/logout", async (req, res) => {
  const auth = req.headers["authorization"];
  if (!auth || !auth.startsWith("Bearer ")) {
    // Always clear the cookie, even if not authorized
    res.clearCookie("dismusic_session", { path: "/", httpOnly: false, sameSite: "lax" });
    return res.status(401).json({ error: "Missing or invalid Authorization header" });
  }
  const sessionToken = auth.replace("Bearer ", "");
  try {
    const pool = global.pgPool;
    // Remove the session token from the user (set to null)
    await pool.query(
      'UPDATE users SET sessiontoken = NULL WHERE sessiontoken = $1',
      [sessionToken]
    );
    // Clear the cookie on logout
    res.clearCookie("dismusic_session", { path: "/", httpOnly: false, sameSite: "lax" });
    res.json({ success: true });
  } catch (err) {
    res.clearCookie("dismusic_session", { path: "/", httpOnly: false, sameSite: "lax" });
    res.status(500).json({ error: "Failed to log out" });
  }
});

// --- FAVORITES API: Manage user's favorite tracks ---

// GET favorites for the user
app.get("/api/user/favorites", async (req, res) => {
  const auth = req.headers["authorization"];
  if (!auth || !auth.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid Authorization header" });
  }
  const sessionToken = auth.replace("Bearer ", "");
  try {
    const user = await getUserBySessionToken(sessionToken);
    if (!user) return res.status(401).json({ error: "Invalid session token" });

    const pool = global.pgPool;
    // Get favorites from user_favorites table
    const favoritesRes = await pool.query(
      'SELECT tracks FROM user_favorites WHERE userid = $1',
      [user.userid]
    );

    // If no favorites exist yet, create an empty entry
    if (favoritesRes.rows.length === 0) {
      await pool.query(
        'INSERT INTO user_favorites (userid, tracks) VALUES ($1, $2)',
        [user.userid, '[]']
      );
      return res.json({ favorites: [] });
    }

    res.json({ favorites: favoritesRes.rows[0].tracks || [] });
  } catch (err) {
    console.error("[GET FAVORITES ERROR]", err);
    res.status(500).json({ error: "Failed to fetch favorites" });
  }
});

// Toggle favorite track (add/remove)
app.post("/api/user/favorites/toggle", async (req, res) => {
  const auth = req.headers["authorization"];
  if (!auth || !auth.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid Authorization header" });
  }
  const sessionToken = auth.replace("Bearer ", "");
  const { track } = req.body;
  if (!track) {
    return res.status(400).json({ error: "Missing track data" });
  }

  try {
    const user = await getUserBySessionToken(sessionToken);
    if (!user) return res.status(401).json({ error: "Invalid session token" });

    const pool = global.pgPool;
    // Get current favorites
    let favoritesRes = await pool.query(
      'SELECT tracks FROM user_favorites WHERE userid = $1',
      [user.userid]
    );

    let favorites = [];
    if (favoritesRes.rows.length === 0) {
      // Create new favorites entry if it doesn't exist
      await pool.query(
        'INSERT INTO user_favorites (userid, tracks) VALUES ($1, $2)',
        [user.userid, '[]']
      );
    } else {
      favorites = favoritesRes.rows[0].tracks || [];
    }

    // Check if track already exists in favorites
    const trackExists = favorites.some(t =>
      (t.name === track.name && t.artist === track.artist) ||
      (t.youtubeUrl && t.youtubeUrl === track.youtubeUrl) ||
      (t.appleMusicUrl && t.appleMusicUrl === track.appleMusicUrl)
    );

    if (trackExists) {
      // Remove track
      favorites = favorites.filter(t =>
        !(t.name === track.name && t.artist === track.artist) &&
        !(t.youtubeUrl && t.youtubeUrl === track.youtubeUrl) &&
        !(t.appleMusicUrl && t.appleMusicUrl === track.appleMusicUrl)
      );
    } else {
      // Add track
      favorites.push({
        ...track,
        addedAt: new Date().toISOString()
      });
    }

    // Update favorites in database
    await pool.query(
      'UPDATE user_favorites SET tracks = $1, updated_at = NOW() WHERE userid = $2',
      [JSON.stringify(favorites), user.userid]
    );

    res.json({ favorites, added: !trackExists });
  } catch (err) {
    console.error("[TOGGLE FAVORITE ERROR]", err);
    res.status(500).json({ error: "Failed to toggle favorite" });
  }
});

// Log client logout events
app.post("/api/client-logout-log", (req, res) => {
  const { message } = req.body;
  console.log("[CLIENT LOGOUT]", message);
  res.json({ ok: true });
});

// --- ADD TRACK TO PLAYLIST API: POST /api/user/playlist/:id/add-track ---
app.post("/api/user/playlist/:id/add-track", async (req, res) => {
  const auth = req.headers["authorization"];
  if (!auth || !auth.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid Authorization header" });
  }
  const sessionToken = auth.replace("Bearer ", "");
  const playlistId = req.params.id;
  const { trackUrl } = req.body;
  if (!trackUrl || typeof trackUrl !== "string") {
    return res.status(400).json({ error: "Missing or invalid trackUrl" });
  }
  try {
    const user = await getUserBySessionToken(sessionToken);
    if (!user) return res.status(401).json({ error: "Invalid session token" });
    const pool = global.pgPool;
    // Fetch the playlist and check ownership
    const playlistRes = await pool.query(
      'SELECT id, tracks FROM user_playlists WHERE id = $1 AND userid = $2',
      [playlistId, user.userid]
    );
    if (playlistRes.rows.length === 0) {
      return res.status(404).json({ error: "Playlist not found" });
    }
    let tracks = playlistRes.rows[0].tracks || [];
    // Hydrate the new track
    let hydratedTrack = null;
    // YouTube
    const ytVideoId = extractYouTubeVideoId(trackUrl);
    if (ytVideoId) {
      const result = await ytSearch({ videoId: ytVideoId });
      if (result && result.title) {
        hydratedTrack = {
          name: result.title,
          artists: [{ name: result.author.name }],
          albumCover: result.thumbnail,
          duration: result.seconds,
          youtubeUrl: result.url
        };
      }
    }
    // Spotify
    if (!hydratedTrack) {
      const spotifyTrackId = extractSpotifyTrackId(trackUrl);
      if (spotifyTrackId) {
        try {
          const trackRes = await spotifyApi.getTrack(spotifyTrackId);
          const track = trackRes.body;
          // Find YouTube URL for this track
          const searchString = `${track.name} ${track.artists[0]?.name || ''}`;
          const ytUrl = await findYouTubeUrl(searchString);
          hydratedTrack = {
            ...track,
            youtubeUrl: ytUrl?.url || null
          };
        } catch (e) {
          hydratedTrack = { name: trackUrl };
        }
      }
    }
    // Fallback: try to search YouTube by URL as string (for generic/unknown links)
    if (!hydratedTrack) {
      const ytResult = await findYouTubeUrl(trackUrl);
      if (ytResult) {
        hydratedTrack = {
          name: trackUrl,
          youtubeUrl: ytResult.url,
          duration: ytResult.duration
        };
      }
    }
    // Fallback: just return url as name
    if (!hydratedTrack) {
      hydratedTrack = { name: trackUrl };
    }
    // Add the new track
    tracks.push(hydratedTrack);
    await pool.query(
      'UPDATE user_playlists SET tracks = $1 WHERE id = $2',
      [JSON.stringify(tracks), playlistId]
    );
    res.json({ success: true, track: hydratedTrack });
  } catch (err) {
    console.error("[BACKEND] Error in /api/user/playlist/:id/add-track POST:", err);
    res.status(500).json({ error: "Failed to add track to playlist" });
  }
});

// --- SEARCH API ENDPOINT ---
app.get("/api/search", async (req, res) => {
  const { query, type = "all" } = req.query;
  if (!query) {
    return res.status(400).json({ error: "Search query is required" });
  }

  try {
    if (!spotifyApi.getAccessToken()) {
      await getSpotifyToken();
    }

    let results = {};

    if (type === "all") {
      const [tracks, artists, albums, playlists] = await Promise.all([
        spotifyApi.searchTracks(query, { limit: 20 }),
        spotifyApi.searchArtists(query, { limit: 20 }),
        spotifyApi.searchAlbums(query, { limit: 20 }),
        spotifyApi.searchPlaylists(query, { limit: 20 })
      ]);

      results = {
        tracks: tracks.body.tracks,
        artists: artists.body.artists,
        albums: albums.body.albums,
        playlists: playlists.body.playlists
      };
    } else {
      const searchMethod = `search${type.charAt(0).toUpperCase() + type.slice(1)}s`;
      if (typeof spotifyApi[searchMethod] !== 'function') {
        return res.status(400).json({ error: "Invalid search type" });
      }
      const result = await spotifyApi[searchMethod](query, { limit: 20 });
      results = result.body;
    }

    res.json(results);
  } catch (error) {
    console.error("Search error:", error);
    if (error.statusCode === 401) {
      try {
        await getSpotifyToken();
        // Retry the search after token refresh
        if (type === "all") {
          const [tracks, artists, albums, playlists] = await Promise.all([
            spotifyApi.searchTracks(query, { limit: 20 }),
            spotifyApi.searchArtists(query, { limit: 20 }),
            spotifyApi.searchAlbums(query, { limit: 20 }),
            spotifyApi.searchPlaylists(query, { limit: 20 })
          ]);

          return res.json({
            tracks: tracks.body.tracks,
            artists: artists.body.artists,
            albums: albums.body.albums,
            playlists: playlists.body.playlists
          });
        } else {
          const searchMethod = `search${type.charAt(0).toUpperCase() + type.slice(1)}s`;
          const result = await spotifyApi[searchMethod](query, { limit: 20 });
          return res.json(result.body);
        }
      } catch (retryError) {
        return res.status(500).json({ error: "Failed to refresh token and retry search" });
      }
    }
    res.status(500).json({ error: "Failed to perform search" });
  }
});

// // --- RECOMMENDATIONS API: Suggest tracks based on user favorites and playlists ---
// app.get("/api/user/recommendations", async (req, res) => {
//     console.log("[RECOMMENDATIONS] endpoint hit");
//     const auth = req.headers["authorization"];
//     if (!auth || !auth.startsWith("Bearer ")) {
//         return res.status(401).json({ error: "Missing or invalid Authorization header" });
//     }
//     const sessionToken = auth.replace("Bearer ", "");
//     try {
//         const user = await getUserBySessionToken(sessionToken);
//         if (!user) {
//             console.log("[RECOMMENDATIONS] Invalid session token");
//             return res.status(401).json({ error: "Invalid session token" });
//         }
//         const pool = global.pgPool;
//         // Get favorites
//         const favoritesRes = await pool.query(
//             'SELECT tracks FROM user_favorites WHERE userid = $1',
//             [user.userid]
//         );
//         const favorites = (favoritesRes.rows[0]?.tracks || []);
//         // Get playlists
//         const playlistsRes = await pool.query(
//             'SELECT tracks FROM user_playlists WHERE userid = $1',
//             [user.userid]
//         );
//         let playlistTracks = [];
//         for (const row of playlistsRes.rows) {
//             if (Array.isArray(row.tracks)) playlistTracks.push(...row.tracks);
//         }
//         console.log('[RECOMMENDATIONS] favorites:', JSON.stringify(favorites, null, 2));
//         console.log('[RECOMMENDATIONS] playlistTracks:', JSON.stringify(playlistTracks, null, 2));
//         // Collect unique Spotify track IDs and artist IDs from favorites and playlists
//         const seedTrackIds = [];
//         const seedArtistIds = [];
//         const seedGenres = new Set(); // Add support for seed genres
//         const seenTracks = new Set();
//         const seenArtists = new Set();
//
//         console.log('[RECOMMENDATIONS] Processing tracks for seeds');
//
//         for (const t of [...favorites, ...playlistTracks]) {
//             try {
//                 // Make sure we only use Spotify IDs (not YouTube or other sources)
//                 if (t.id && t.type === 'track' && !seenTracks.has(t.id)) {
//                     console.log('[RECOMMENDATIONS] Adding track seed:', t.id);
//                     seedTrackIds.push(t.id);
//                     seenTracks.add(t.id);
//
//                     // Add genres from track if available
//                     if (t.genres && Array.isArray(t.genres)) {
//                         t.genres.forEach(genre => seedGenres.add(genre));
//                     }
//                 }
//
//                 if (t.artists && Array.isArray(t.artists)) {
//                     for (const a of t.artists) {
//                         // Ensure artist has a valid Spotify ID
//                         if (a.id && !seenArtists.has(a.id)) {
//                             console.log('[RECOMMENDATIONS] Adding artist seed:', a.id);
//                             seedArtistIds.push(a.id);
//                             seenArtists.add(a.id);
//                         }
//                     }
//                 }
//             } catch (err) {
//                 console.error('[RECOMMENDATIONS] Error processing track:', err);
//                 // Continue with next track
//             }
//         }
//
//         // Limit to 5 seeds total (Spotify API limit)
//         // Prioritize tracks, then artists, then genres
//         const seeds = {};
//         const MAX_TOTAL_SEEDS = 5;
//         let remainingSeeds = MAX_TOTAL_SEEDS;
//
//         // Add track seeds (up to 3)
//         if (seedTrackIds.length > 0) {
//             const trackSeedsToUse = seedTrackIds.slice(0, Math.min(3, remainingSeeds));
//             seeds.seed_tracks = trackSeedsToUse;
//             remainingSeeds -= trackSeedsToUse.length;
//             console.log('[RECOMMENDATIONS] Final track seeds:', seeds.seed_tracks);
//         }
//
//         // Add artist seeds with remaining slots (up to 2)
//         if (seedArtistIds.length > 0 && remainingSeeds > 0) {
//             const artistSeedsToUse = seedArtistIds.slice(0, remainingSeeds);
//             seeds.seed_artists = artistSeedsToUse;
//             remainingSeeds -= artistSeedsToUse.length;
//             console.log('[RECOMMENDATIONS] Final artist seeds:', seeds.seed_artists);
//         }
//
//         // Add genre seeds with any remaining slots
//         if (seedGenres.size > 0 && remainingSeeds > 0) {
//             const genreSeedsToUse = Array.from(seedGenres).slice(0, remainingSeeds);
//             seeds.seed_genres = genreSeedsToUse;
//             console.log('[RECOMMENDATIONS] Final genre seeds:', seeds.seed_genres);
//         }
//
//         if (!spotifyApi.getAccessToken()) {
//             console.log('[RECOMMENDATIONS] No Spotify token, getting one');
//             await getSpotifyToken();
//         }
//
//         // If no seeds, return empty
//         if ((!seeds.seed_tracks || !seeds.seed_tracks.length) &&
//             (!seeds.seed_artists || !seeds.seed_artists.length) &&
//             (!seeds.seed_genres || !seeds.seed_genres.length)) {
//             console.log('[RECOMMENDATIONS] No valid seeds found, returning empty array');
//             return res.json({ recommendations: [] });
//         }
//
//         try {
//             // Get recommendations from Spotify
//             console.log('[RECOMMENDATIONS] Calling Spotify API with seeds:', JSON.stringify(seeds));
//
//             // Validate seeds - Spotify requires at least one seed parameter
//             if ((!seeds.seed_tracks || seeds.seed_tracks.length === 0) &&
//                 (!seeds.seed_artists || seeds.seed_artists.length === 0) &&
//                 (!seeds.seed_genres || seeds.seed_genres.length === 0)) {
//                 console.log('[RECOMMENDATIONS] No valid seeds available');
//                 return res.json({ recommendations: [] });
//             }
//
//             // Add additional parameters to improve recommendation quality
//             const recommendationParams = {
//                 limit: 12,
//                 market: 'US',
//             };
//
//             // Add seed parameters only if they exist and have items
//             if (seeds.seed_tracks && seeds.seed_tracks.length > 0) {
//                 recommendationParams.seed_tracks = seeds.seed_tracks.join(',');
//             }
//
//             if (seeds.seed_artists && seeds.seed_artists.length > 0) {
//                 recommendationParams.seed_artists = seeds.seed_artists.join(',');
//             }
//
//             if (seeds.seed_genres && seeds.seed_genres.length > 0) {
//                 recommendationParams.seed_genres = seeds.seed_genres.join(',');
//             }
//
//             console.log('[RECOMMENDATIONS] Final parameters:', recommendationParams);
//
//             // Use direct fetch with proper URL construction instead of the library's getRecommendations
//             const accessToken = spotifyApi.getAccessToken();
//             const url = new URL('https://api.spotify.com/v1/recommendations');
//
//             // Add all parameters to URL
//             Object.keys(recommendationParams).forEach(key => {
//                 url.searchParams.append(key, recommendationParams[key]);
//             });
//
//             console.log('[RECOMMENDATIONS] Fetching from URL:', url.toString());
//
//             const response = await fetch(url.toString(), {
//                 method: 'GET',
//                 headers: {
//                     'Authorization': `Bearer ${accessToken}`,
//                     'Content-Type': 'application/json'
//                 }
//             });
//
//             if (!response.ok) {
//                 const errorData = await response.json().catch(() => ({}));
//                 console.error('[RECOMMENDATIONS] API Error:', response.status, errorData);
//                 throw new Error(`Spotify API error: ${response.status}`);
//             }
//
//             const data = await response.json();
//             console.log(`[RECOMMENDATIONS] Success! Found ${data.tracks?.length || 0} recommendations`);
//
//             const recommendations = (data.tracks || []).map(track => ({
//                 id: track.id,
//                 name: track.name,
//                 artists: track.artists.map(a => ({ name: a.name })),
//                 albumCover: track.album?.images?.[0]?.url || "",
//                 spotifyUrl: track.external_urls?.spotify || ""
//             }));
//
//             res.json({ recommendations });
//         } catch (err) {
//             console.error("[RECOMMENDATIONS ERROR]", err);
//
//             // Try different seed combinations if the first request fails
//             try {
//                 console.log('[RECOMMENDATIONS] Initial request failed. Trying alternative seed combinations...');
//                 const accessToken = spotifyApi.getAccessToken();
//
//                 // Create simpler URL with just one seed
//                 const url = new URL('https://api.spotify.com/v1/recommendations');
//                 url.searchParams.append('limit', '12');
//                 url.searchParams.append('market', 'US');
//
//                 // First try: Just use one track seed if available
//                 if (seeds.seed_tracks && seeds.seed_tracks.length > 0) {
//                     console.log('[RECOMMENDATIONS] Trying with single track seed');
//                     url.searchParams.append('seed_tracks', seeds.seed_tracks[0]);
//                 }
//                 // Second try: Just use one artist seed if available
//                 else if (seeds.seed_artists && seeds.seed_artists.length > 0) {
//                     console.log('[RECOMMENDATIONS] Trying with single artist seed');
//                     url.searchParams.append('seed_artists', seeds.seed_artists[0]);
//                 }
//                 // Third try: Just use one genre if available
//                 else if (seeds.seed_genres && seeds.seed_genres.length > 0) {
//                     console.log('[RECOMMENDATIONS] Trying with single genre seed');
//                     url.searchParams.append('seed_genres', seeds.seed_genres[0]);
//                 } else {
//                     // If no seeds at all, try with a popular genre
//                     console.log('[RECOMMENDATIONS] No seeds available, using "pop" genre');
//                     url.searchParams.append('seed_genres', 'pop');
//                 }
//
//                 console.log('[RECOMMENDATIONS] Retry URL:', url.toString());
//
//                 const response = await fetch(url.toString(), {
//                     method: 'GET',
//                     headers: {
//                         'Authorization': `Bearer ${accessToken}`,
//                         'Content-Type': 'application/json'
//                     }
//                 });
//
//                 if (!response.ok) {
//                     const errorData = await response.json().catch(() => ({}));
//                     console.error('[RECOMMENDATIONS] Retry API Error:', response.status, errorData);
//                     throw new Error(`Spotify API error: ${response.status}`);
//                 }
//
//                 const data = await response.json();
//
//                 const recommendations = (data.tracks || []).map(track => ({
//                     id: track.id,
//                     name: track.name,
//                     artists: track.artists.map(a => ({ name: a.name })),
//                     albumCover: track.album?.images?.[0]?.url || "",
//                     spotifyUrl: track.external_urls?.spotify || ""
//                 }));
//                 console.log(`[RECOMMENDATIONS] Retry success! Found ${recommendations.length} recommendations`);
//                 return res.json({ recommendations });
//             } catch (retryErr) {
//                 console.error("[RECOMMENDATIONS RETRY ERROR]", retryErr);
//
//                 // As a last resort, try to get new releases instead of recommendations
//                 try {
//                     console.log('[RECOMMENDATIONS] All recommendation attempts failed. Falling back to new releases');
//
//                     const response = await fetch('https://api.spotify.com/v1/browse/new-releases?limit=12&country=US', {
//                         method: 'GET',
//                         headers: {
//                             'Authorization': `Bearer ${spotifyApi.getAccessToken()}`,
//                             'Content-Type': 'application/json'
//                         }
//                     });
//
//                     if (!response.ok) {
//                         throw new Error(`Spotify API error: ${response.status}`);
//                     }
//
//                     const data = await response.json();
//
//                     const recommendations = (data.albums?.items || []).map(album => ({
//                         id: album.id,
//                         name: album.name,
//                         artists: album.artists.map(a => ({ name: a.name })),
//                         albumCover: album.images?.[0]?.url || "",
//                         spotifyUrl: album.external_urls?.spotify || ""
//                     }));
//
//                     console.log(`[RECOMMENDATIONS] Fallback success! Returning ${recommendations.length} new releases`);
//                     return res.json({ recommendations });
//                 } catch (fallbackErr) {
//                     console.error("[RECOMMENDATIONS FALLBACK ERROR]", fallbackErr);
//                     return res.json({ recommendations: [] }); // Return empty array as last resort
//                 }
//             }
//         } // end main try
//     } catch (err) {
//         console.error("[RECOMMENDATIONS MAIN ERROR]", err);
//         res.status(500).json({ error: "Failed to get recommendations" });
//     }
// });


// Simplified recommendations API with extensive debugging and album covers
app.get("/api/user/recommendations", async (req, res) => {
    console.log("[RECOMMENDATIONS] Starting recommendations endpoint");

    const auth = req.headers["authorization"];
    if (!auth || !auth.startsWith("Bearer ")) {
        console.log("[RECOMMENDATIONS] Missing or invalid auth header");
        return res.status(401).json({ error: "Missing or invalid Authorization header" });
    }

    const sessionToken = auth.replace("Bearer ", "");
    console.log("[RECOMMENDATIONS] Session token received:", sessionToken.substring(0, 10) + "...");

    try {
        console.log("[RECOMMENDATIONS] Getting user by session token...");
        const user = await getUserBySessionToken(sessionToken);
        if (!user) {
            console.log("[RECOMMENDATIONS] User not found for session token");
            return res.status(401).json({ error: "Invalid session token" });
        }

        console.log("[RECOMMENDATIONS] User found:", user.userid);

        // Check if we have a database connection
        if (!global.pgPool) {
            console.log("[RECOMMENDATIONS] No database connection!");
            return res.status(500).json({ error: "Database connection error" });
        }

        console.log("[RECOMMENDATIONS] Database connection exists");

        // Get user's favorites
        console.log("[RECOMMENDATIONS] Querying user favorites...");
        const favoritesRes = await global.pgPool.query(
            'SELECT tracks FROM user_favorites WHERE userid = $1',
            [user.userid]
        );

        console.log("[RECOMMENDATIONS] Favorites query result:", favoritesRes.rows);
        const favorites = favoritesRes.rows[0]?.tracks || [];
        console.log("[RECOMMENDATIONS] Found", favorites.length, "favorites");

        // Get user's playlists
        console.log("[RECOMMENDATIONS] Querying user playlists...");
        const playlistsRes = await global.pgPool.query(
            'SELECT tracks FROM user_playlists WHERE userid = $1',
            [user.userid]
        );

        console.log("[RECOMMENDATIONS] Playlists query result:", playlistsRes.rows);
        let playlistTracks = [];
        for (const row of playlistsRes.rows) {
            if (Array.isArray(row.tracks)) {
                playlistTracks.push(...row.tracks);
            }
        }
        console.log("[RECOMMENDATIONS] Found", playlistTracks.length, "playlist tracks");

        // If no favorites or playlists, return some fallback recommendations
        if (favorites.length === 0 && playlistTracks.length === 0) {
            console.log("[RECOMMENDATIONS] No user music data found, returning fallback recommendations");

            // Return some popular tracks as fallback
            const fallbackRecommendations = [
                {
                    id: "fallback1",
                    name: "Popular Song 1",
                    artists: [{ name: "Popular Artist 1" }],
                    albumCover: "",
                    spotifyUrl: "#"
                },
                {
                    id: "fallback2",
                    name: "Popular Song 2",
                    artists: [{ name: "Popular Artist 2" }],
                    albumCover: "",
                    spotifyUrl: "#"
                },
                {
                    id: "fallback3",
                    name: "Popular Song 3",
                    artists: [{ name: "Popular Artist 3" }],
                    albumCover: "",
                    spotifyUrl: "#"
                }
            ];

            console.log("[RECOMMENDATIONS] Returning fallback recommendations:", fallbackRecommendations);
            return res.json({ recommendations: fallbackRecommendations });
        }

        // Try to get actual recommendations
        console.log("[RECOMMENDATIONS] Attempting to get real recommendations...");

        const LASTFM_API_KEY = process.env.LASTFM_API_KEY;
        console.log("[RECOMMENDATIONS] Last.fm API key exists:", !!LASTFM_API_KEY);

        if (!LASTFM_API_KEY) {
            console.log("[RECOMMENDATIONS] No Last.fm API key, using genre-based approach");
            return await getGenreBasedRecommendations(res);
        }

        // Ensure Spotify token is available for album cover lookup
        if (!spotifyApi.getAccessToken()) {
            console.log("[RECOMMENDATIONS] Getting Spotify token for album covers...");
            try {
                await getSpotifyToken();
            } catch (err) {
                console.log("[RECOMMENDATIONS] Failed to get Spotify token:", err);
            }
        }

        // Process favorites for Last.fm recommendations
        const recommendations = [];
        const allTracks = [...favorites, ...playlistTracks];
        console.log("[RECOMMENDATIONS] Processing", allTracks.length, "total tracks");

        // DEBUG: Log the actual structure of the first few tracks
        console.log("[RECOMMENDATIONS] === TRACK STRUCTURE DEBUG ===");
        for (let i = 0; i < Math.min(3, allTracks.length); i++) {
            const track = allTracks[i];
            console.log(`[RECOMMENDATIONS] Track ${i + 1} full object:`, JSON.stringify(track, null, 2));
            console.log(`[RECOMMENDATIONS] Track ${i + 1} name:`, track.name);
            console.log(`[RECOMMENDATIONS] Track ${i + 1} artists array:`, track.artists);
            console.log(`[RECOMMENDATIONS] Track ${i + 1} first artist:`, track.artists?.[0]);
            console.log(`[RECOMMENDATIONS] Track ${i + 1} artist name:`, track.artists?.[0]?.name);
            console.log("[RECOMMENDATIONS] ---");
        }
        console.log("[RECOMMENDATIONS] === END DEBUG ===");

        // Process tracks for recommendations
        for (let i = 0; i < Math.min(3, allTracks.length); i++) {
            const track = allTracks[i];

            // Try different possible ways the artist might be stored
            let artist = null;
            let trackName = track.name;

            // Method 1: track.artists[0].name (current approach)
            if (track.artists?.[0]?.name) {
                artist = track.artists[0].name;
            }
            // Method 2: track.artist (single artist property)
            else if (track.artist) {
                artist = track.artist;
            }
            // Method 3: track.artists as string array
            else if (Array.isArray(track.artists) && track.artists[0]) {
                artist = track.artists[0];
            }
            // Method 4: track.artist_name
            else if (track.artist_name) {
                artist = track.artist_name;
            }
            // Method 5: nested in track.track
            else if (track.track?.artists?.[0]?.name) {
                artist = track.track.artists[0].name;
                trackName = track.track.name || trackName;
            }

            console.log(`[RECOMMENDATIONS] Processing track ${i + 1}:`, artist, "-", trackName);

            if (artist && trackName) {
                try {
                    const lastfmUrl = `https://ws.audioscrobbler.com/2.0/?method=track.getsimilar&artist=${encodeURIComponent(artist)}&track=${encodeURIComponent(trackName)}&api_key=${LASTFM_API_KEY}&format=json&limit=4`;

                    console.log("[RECOMMENDATIONS] Calling Last.fm API for:", artist, "-", trackName);
                    const response = await fetch(lastfmUrl);
                    console.log("[RECOMMENDATIONS] Last.fm response status:", response.status);

                    if (!response.ok) {
                        console.log("[RECOMMENDATIONS] Last.fm API error:", response.status, response.statusText);
                        continue;
                    }

                    const data = await response.json();
                    console.log("[RECOMMENDATIONS] Last.fm response for", artist, "-", trackName, ":", JSON.stringify(data, null, 2));

                    if (data.error) {
                        console.log("[RECOMMENDATIONS] Last.fm API error:", data.error, data.message);
                        continue;
                    }

                    if (data.similartracks?.track) {
                        const similarTracks = Array.isArray(data.similartracks.track)
                            ? data.similartracks.track
                            : [data.similartracks.track];

                        console.log("[RECOMMENDATIONS] Found", similarTracks.length, "similar tracks for", artist, "-", trackName);

                        for (const similar of similarTracks) {
                            if (similar.artist?.name && similar.name) {
                                console.log("[RECOMMENDATIONS] Adding similar track:", similar.artist.name, "-", similar.name);

                                // Get album cover - try Last.fm first, then Spotify
                                let albumCover = "";

                                // Method 1: Last.fm album cover (different sizes available)
                                if (similar.image && Array.isArray(similar.image)) {
                                    // Try different sizes: extralarge, large, medium, small
                                    const extraLarge = similar.image.find(img => img.size === "extralarge");
                                    const large = similar.image.find(img => img.size === "large");
                                    const medium = similar.image.find(img => img.size === "medium");

                                    albumCover = extraLarge?.["#text"] || large?.["#text"] || medium?.["#text"] || similar.image[2]?.["#text"] || "";
                                }

                                // Method 2: If no Last.fm cover, try Spotify
                                if (!albumCover && spotifyApi.getAccessToken()) {
                                    try {
                                        console.log("[RECOMMENDATIONS] Searching Spotify for album cover:", similar.artist.name, "-", similar.name);
                                        const spotifySearchUrl = `https://api.spotify.com/v1/search?q=${encodeURIComponent(`track:${similar.name} artist:${similar.artist.name}`)}&type=track&limit=1`;

                                        const spotifyResponse = await fetch(spotifySearchUrl, {
                                            headers: {
                                                'Authorization': `Bearer ${spotifyApi.getAccessToken()}`
                                            }
                                        });

                                        if (spotifyResponse.ok) {
                                            const spotifyData = await spotifyResponse.json();
                                            if (spotifyData.tracks?.items?.length > 0) {
                                                const spotifyTrack = spotifyData.tracks.items[0];
                                                albumCover = spotifyTrack.album?.images?.[0]?.url || spotifyTrack.album?.images?.[1]?.url || "";
                                                console.log("[RECOMMENDATIONS] Found Spotify album cover:", albumCover);
                                            }
                                        }
                                    } catch (spotifyErr) {
                                        console.log("[RECOMMENDATIONS] Spotify album cover lookup failed:", spotifyErr);
                                    }
                                }

                                recommendations.push({
                                    id: `similar_${Date.now()}_${Math.random()}`,
                                    name: similar.name,
                                    artists: [{ name: similar.artist.name }],
                                    albumCover: albumCover,
                                    spotifyUrl: similar.url || "#"
                                });
                            }
                        }
                    }
                } catch (err) {
                    console.error(`[RECOMMENDATIONS] Error processing track ${artist} - ${trackName}:`, err);
                }
            } else {
                console.log(`[RECOMMENDATIONS] Skipping track ${i + 1} - missing artist or track name`);
            }
        }

        console.log("[RECOMMENDATIONS] Final recommendations count:", recommendations.length);

        // Remove duplicates and limit
        const uniqueRecommendations = recommendations
            .filter((track, index, self) =>
                index === self.findIndex(t => t.name === track.name && t.artists[0]?.name === track.artists[0]?.name)
            )
            .slice(0, 12);

        console.log("[RECOMMENDATIONS] Unique recommendations count:", uniqueRecommendations.length);
        console.log("[RECOMMENDATIONS] Sending response:", uniqueRecommendations);

        res.json({ recommendations: uniqueRecommendations });

    } catch (err) {
        console.error("[RECOMMENDATIONS] Main error:", err);
        console.error("[RECOMMENDATIONS] Error stack:", err.stack);

        // Return fallback recommendations even on error
        const fallbackRecommendations = [
            {
                id: "error_fallback1",
                name: "Error Fallback Song 1",
                artists: [{ name: "Fallback Artist 1" }],
                albumCover: "",
                spotifyUrl: "#"
            },
            {
                id: "error_fallback2",
                name: "Error Fallback Song 2",
                artists: [{ name: "Fallback Artist 2" }],
                albumCover: "",
                spotifyUrl: "#"
            }
        ];

        console.log("[RECOMMENDATIONS] Returning error fallback");
        res.json({ recommendations: fallbackRecommendations });
    }
});

// Fallback function for genre-based recommendations
async function getGenreBasedRecommendations(res) {
    console.log("[RECOMMENDATIONS] Getting genre-based recommendations");

    try {
        // Check if Spotify token exists
        if (!spotifyApi.getAccessToken()) {
            console.log("[RECOMMENDATIONS] Getting Spotify token...");
            await getSpotifyToken();
        }

        console.log("[RECOMMENDATIONS] Spotify token exists:", !!spotifyApi.getAccessToken());

        // Get featured playlists as recommendations
        const response = await fetch('https://api.spotify.com/v1/browse/featured-playlists?limit=12&country=US', {
            headers: {
                'Authorization': `Bearer ${spotifyApi.getAccessToken()}`
            }
        });

        console.log("[RECOMMENDATIONS] Spotify featured playlists response:", response.status);

        if (!response.ok) {
            throw new Error(`Spotify API error: ${response.status}`);
        }

        const data = await response.json();
        console.log("[RECOMMENDATIONS] Spotify data:", JSON.stringify(data, null, 2));

        const recommendations = (data.playlists?.items || []).map(playlist => ({
            id: playlist.id,
            name: playlist.name,
            artists: [{ name: playlist.owner?.display_name || "Spotify" }],
            albumCover: playlist.images?.[0]?.url || "",
            spotifyUrl: playlist.external_urls?.spotify || "#"
        }));

        console.log("[RECOMMENDATIONS] Genre-based recommendations:", recommendations);
        return res.json({ recommendations });

    } catch (err) {
        console.error("[RECOMMENDATIONS] Genre-based error:", err);

        // Final fallback
        const fallbackRecommendations = [
            {
                id: "final_fallback1",
                name: "Today's Top Hits",
                artists: [{ name: "Spotify" }],
                albumCover: "",
                spotifyUrl: "#"
            },
            {
                id: "final_fallback2",
                name: "Pop Rising",
                artists: [{ name: "Spotify" }],
                albumCover: "",
                spotifyUrl: "#"
            }
        ];

        console.log("[RECOMMENDATIONS] Final fallback recommendations");
        return res.json({ recommendations: fallbackRecommendations });
    }
}

// Helper function to get album cover from Spotify
async function getSpotifyAlbumCover(artist, trackName) {
    if (!spotifyApi.getAccessToken()) {
        return null;
    }

    try {
        const searchUrl = `https://api.spotify.com/v1/search?q=${encodeURIComponent(`track:${trackName} artist:${artist}`)}&type=track&limit=1`;

        const response = await fetch(searchUrl, {
            headers: {
                'Authorization': `Bearer ${spotifyApi.getAccessToken()}`
            }
        });

        if (!response.ok) {
            return null;
        }

        const data = await response.json();
        if (data.tracks?.items?.length > 0) {
            const track = data.tracks.items[0];
            return track.album?.images?.[0]?.url || track.album?.images?.[1]?.url || null;
        }

        return null;
    } catch (err) {
        console.error("[RECOMMENDATIONS] Spotify album cover error:", err);
        return null;
    }
}
// Call this before starting the server
ensureDatabaseAndTable().then(pool => {
    global.pgPool = pool;
    server.listen(3000, () => {
        console.log("Server running on http://localhost:3000");
    });
});

