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
async function upsertUser({ id, username, avatar, playlists = [], queue = [] }) {
  const pool = global.pgPool;
  const userpfpurl = avatar
    ? `https://cdn.discordapp.com/avatars/${id}/${avatar}.png`
    : null;
  // Generate a secure session token
  const sessionToken = crypto.randomBytes(32).toString("hex");
  await pool.query(
    `INSERT INTO users (userid, username, userpfpurl, userplaylists, userqueue)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (userid) DO UPDATE SET username = $2, userpfpurl = $3`,
    [id, username, userpfpurl, JSON.stringify(playlists), JSON.stringify(queue)]
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
    const sessionToken = await upsertUser(userData);
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
            userpfpurl TEXT,
            userplaylists JSONB,
            userqueue JSONB,
            sessiontoken TEXT
        )`);
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
        const result = await pool.query(
            'SELECT id, name, tracks, created_at FROM user_playlists WHERE id = $1 AND userid = $2',
            [playlistId, user.userid]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Playlist not found" });
        }
        res.json(result.rows[0]);
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
      userid: user.userid || null
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

// Call this before starting the server
ensureDatabaseAndTable().then(pool => {
    global.pgPool = pool;
    server.listen(3000, () => {
        console.log("Server running on http://localhost:3000");
    });
});

