const express = require("express");
const fetch = require("node-fetch");
const router = express.Router();

// Load env variables
require("dotenv").config({ path: require('path').resolve(__dirname, '../.env') });

const CLIENT_ID = process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID;
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const REDIRECT_URI = process.env.NEXT_PUBLIC_DISCORD_REDIRECT_URI;

// Helper to upsert user in DB
async function upsertUser({ id, username, avatar, playlists = [], queue = [] }) {
  const pool = global.pgPool;
  const userpfpurl = avatar
    ? `https://cdn.discordapp.com/avatars/${id}/${avatar}.png`
    : null;
  await pool.query(
    `INSERT INTO users (userid, username, userpfpurl, userplaylists, userqueue)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (userid) DO UPDATE SET username = $2, userpfpurl = $3`,
    [id, username, userpfpurl, JSON.stringify(playlists), JSON.stringify(queue)]
  );
}

router.get("/callback/discord", async (req, res) => {
  const code = req.query.code;
  if (!code) return res.status(400).send("Missing code");

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

    // Upsert user in DB
    await upsertUser(userData);

    // Optionally: Set a cookie or redirect to frontend
    res.redirect("/playlists");
  } catch (err) {
    res.status(500).json({ error: "Discord OAuth error", details: err.message });
  }
});




module.exports = router;

