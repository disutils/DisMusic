const axios = require('axios');
const jsdom = require('jsdom');
const base64url = require('base64url');

const TOKEN_REGEX = /ey[\w-]+\.[\w-]+\.[\w-]+/;
let cachedToken = null;
let cachedExpire = null;

async function fetchHtml(url) {
  const res = await axios.get(url);
  return res.data;
}

function parseTokenData(token) {
  const parts = token.split('.');
  if (parts.length < 3) throw new Error('Invalid token');
  const payload = JSON.parse(base64url.decode(parts[1]));
  const expire = payload.exp ? new Date(payload.exp * 1000) : null;
  return { token, expire };
}

async function fetchNewToken() {
  const mainPageHtml = await fetchHtml('https://music.apple.com');
  const { JSDOM } = jsdom;
  const dom = new JSDOM(mainPageHtml, { url: 'https://music.apple.com' });
  const script = Array.from(dom.window.document.querySelectorAll('script[type=module][src]'))
    .find(el => /\/assets\/index.*\.js$/.test(el.src));
  if (!script) throw new Error('Token script not found');
  const scriptUrl = script.src.startsWith('http') ? script.src : `https://music.apple.com${script.src}`;
  const scriptContent = await fetchHtml(scriptUrl);
  const match = scriptContent.match(TOKEN_REGEX);
  if (!match) throw new Error('Token not found in script');
  return parseTokenData(match[0]);
}

async function getAppleMusicToken(forceRefresh = false) {
  if (!forceRefresh && cachedToken && cachedExpire && cachedExpire > new Date(Date.now() + 5000)) {
    return cachedToken;
  }
  const { token, expire } = await fetchNewToken();
  cachedToken = token;
  cachedExpire = expire;
  return token;
}

module.exports = { getAppleMusicToken };
