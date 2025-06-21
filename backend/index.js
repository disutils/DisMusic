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
            // --- YOUTUBE PLAYLIST ---
            const ytPlaylistId = extractYouTubePlaylistId(query);
            if (ytPlaylistId) {
                const playlist = await ytpl(ytPlaylistId, { limit: 100 });
                userQueues[socket.id] = playlist.items.map(item => ({
                    name: item.title,
                    artists: [{ name: item.author.name }],
                    albumCover: item.bestThumbnail.url,
                    duration: item.durationSec ? parseInt(item.durationSec) : null,
                    youtubeUrl: item.shortUrl
                }));
                emitQueueUpdate(socket);
                if (userQueues[socket.id].length > 0) {
                    socket.emit("playYouTube", { url: userQueues[socket.id][0].youtubeUrl });
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

    socket.on("addToQueue", async ({ query }) => {
        try {
            // --- YOUTUBE PLAYLIST ---
            const ytPlaylistId = extractYouTubePlaylistId(query);
            if (ytPlaylistId) {
                const playlist = await ytpl(ytPlaylistId, { limit: 100 });
                userQueues[socket.id] = [...(userQueues[socket.id] || []), ...playlist.items.map(item => ({
                    name: item.title,
                    artists: [{ name: item.author.name }],
                    albumCover: item.bestThumbnail.url,
                    duration: item.durationSec ? parseInt(item.durationSec) : null,
                    youtubeUrl: item.shortUrl
                }))];
                emitQueueUpdate(socket);
                return;
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
            // Get up to 4 album covers from the first 4 tracks
            const covers = (playlist.tracks.items || [])
                .slice(0, 4)
                .map(item => item.track?.album?.images?.[0]?.url || "")
                .filter(Boolean);
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
    try {
      // Fix: handle both stringified and already-parsed JSON, and log for debug
      console.log("[BACKEND] user.userplaylists raw:", user.userplaylists);
      if (typeof user.userplaylists === "string") {
        playlists = JSON.parse(user.userplaylists);
      } else if (Array.isArray(user.userplaylists)) {
        playlists = user.userplaylists;
      } else if (user.userplaylists && typeof user.userplaylists === "object") {
        playlists = user.userplaylists;
      } else {
        playlists = [];
      }
      console.log("[BACKEND] parsed playlists:", playlists);
    } catch (e) {
      console.error("[BACKEND] Error parsing playlists from DB:", e, user.userplaylists);
      playlists = [];
    }
    // Always return as { playlists: [...] }
    res.json({ playlists });
  } catch (err) {
    console.error("[BACKEND] Error in /api/user/playlists GET:", err);
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
  const { playlistIndex, playlistName } = req.body;
  if (playlistIndex === undefined && !playlistName) {
    return res.status(400).json({ error: "Missing playlist identifier (index or name)" });
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
    // Remove by index or name
    if (playlistIndex !== undefined) {
      playlists.splice(playlistIndex, 1);
    } else if (playlistName) {
      playlists = playlists.filter(p => p.name !== playlistName);
    }
    const pool = global.pgPool;
    await pool.query(
      'UPDATE users SET userplaylists = $1 WHERE sessiontoken = $2',
      [JSON.stringify(playlists), sessionToken]
    );
    res.json({ success: true, playlists });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete playlist" });
  }
});

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

// Log client logout events
app.post("/api/client-logout-log", (req, res) => {
  const { message } = req.body;
  console.log("[CLIENT LOGOUT]", message);
  res.json({ ok: true });
});

// Call this before starting the server
ensureDatabaseAndTable().then(pool => {
    global.pgPool = pool;
    server.listen(3000, () => {
        console.log("Server running on http://localhost:3000");
    });
});
