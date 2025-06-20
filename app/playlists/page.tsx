"use client"

import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { useState, useEffect } from "react"
import Cookies from "js-cookie"
import { useMusic } from "../context/MusicContext"

export default function PlaylistsPage() {
  const [playlistUrl, setPlaylistUrl] = useState("")
  const [playlists, setPlaylists] = useState<any[]>([])
  const { handlePlay } = useMusic()
  const [sessionToken, setSessionToken] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [didUserEdit, setDidUserEdit] = useState(false)

  // On mount, get session token and fetch playlists from DB
  useEffect(() => {
    const token = Cookies.get("dismusic_session")
    setSessionToken(token || null)
    setDidUserEdit(false)
    console.log("[PlaylistsPage] dismusic_session token:", token)
    if (!token) return
    fetch("https://musicsocket.distools.dev/api/user/playlists", {
      method: "GET",
      headers: { "Authorization": `Bearer ${token}` }
    })
      .then(async res => {
        console.log("[PlaylistsPage] /api/user/playlists status:", res.status)
        const text = await res.text();
        let data;
        try {
          data = JSON.parse(text);
        } catch (e) {
          console.error("[PlaylistsPage] Error parsing JSON:", e, text)
          data = null;
        }
        return data;
      })
      .then(data => {
        console.log("[PlaylistsPage] /api/user/playlists data:", data)
        if (data && Array.isArray(data.playlists)) setPlaylists(data.playlists)
        setLoaded(true)
      })
      .catch((err) => {
        console.error("[PlaylistsPage] Error fetching playlists:", err)
        setPlaylists([])
        setLoaded(true)
      })
  }, [])

  // Save playlists to DB only if user edited
  useEffect(() => {
    if (!sessionToken || !loaded || !didUserEdit) return
    console.log("[PlaylistsPage] Saving playlists to backend:", playlists)
    fetch("https://musicsocket.distools.dev/api/user/playlists", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${sessionToken}`
      },
      body: JSON.stringify({ playlists })
    })
      .then(res => {
        console.log("[PlaylistsPage] /api/user/playlists POST status:", res.status)
        return res.ok ? res.json() : null
      })
      .then(data => {
        console.log("[PlaylistsPage] /api/user/playlists POST data:", data)
      })
      .catch((err) => {
        console.error("[PlaylistsPage] Error saving playlists:", err)
      })
  }, [playlists, sessionToken, loaded, didUserEdit])

  const handleAddPlaylist = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!playlistUrl.startsWith("https://open.spotify.com/playlist/")) return
    let playlistInfo = { url: playlistUrl, name: playlistUrl, covers: [] as string[] };
    try {
      const res = await fetch("https://musicsocket.distools.dev/api/spotify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: playlistUrl })
      });
      if (res.ok) {
        const data = await res.json();
        playlistInfo.name = data.name || playlistUrl;
        if (data.tracks && Array.isArray(data.tracks)) {
          playlistInfo.covers = data.tracks.slice(0, 4).map((t: any) => {
            return t.albumCover || t.album?.images?.[0]?.url;
          }).filter(Boolean);
        }
      }
    } catch {}
    setPlaylists((prev) => [
      playlistInfo,
      ...prev.filter((p) => p.url !== playlistUrl)
    ])
    setDidUserEdit(true)
    setPlaylistUrl("")
  }

  // Delete playlist handler
  const handleDeletePlaylist = async (playlistIndex: number) => {
    if (!sessionToken) return;
    try {
      const res = await fetch("https://musicsocket.distools.dev/api/user/playlists", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${sessionToken}`
        },
        body: JSON.stringify({ playlistIndex })
      });
      if (res.ok) {
        const data = await res.json();
        setPlaylists(data.playlists);
      }
    } catch (err) {
      console.error("[PlaylistsPage] Error deleting playlist:", err);
    }
  };

  const handlePlayPlaylist = (url: string) => {
    handlePlay(url)
  }

  return (
    <div className="p-6 h-full overflow-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white">Your Playlists</h2>
        <Button className="bg-green-600 hover:bg-green-700">
          <Plus className="w-4 h-4 mr-2" />
          Create Playlist
        </Button>
      </div>
      <form onSubmit={handleAddPlaylist} className="flex gap-2 mb-6">
        <input
          type="text"
          value={playlistUrl}
          onChange={e => setPlaylistUrl(e.target.value)}
          placeholder="Paste Spotify playlist URL here"
          className="flex-1 px-3 py-2 rounded bg-[#232323] text-white border border-gray-700"
        />
        <Button type="submit" className="bg-green-600 hover:bg-green-700">Add</Button>
      </form>
      {playlists.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-96 text-gray-400">
          <p className="text-lg mb-2">Add some playlists and get grooving!</p>
          <span className="text-4xl">🎶</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {playlists.map((pl, idx) => (
            <div key={pl.url} className="bg-[#232323] rounded-lg shadow p-0 flex flex-col overflow-hidden">
              <div className="aspect-square w-full grid grid-cols-2 grid-rows-2">
                {[0,1,2,3].map(i => (
                  <div key={i} className="w-full h-full bg-gray-800 flex items-center justify-center overflow-hidden">
                    {pl.covers && pl.covers[i] ? (
                      <img src={pl.covers[i]} alt="cover" className="object-cover w-full h-full" />
                    ) : (
                      <span className="text-gray-700 text-2xl">🎵</span>
                    )}
                  </div>
                ))}
              </div>
              <div className="p-4 flex-1 flex flex-col justify-between">
                <div className="font-bold text-white mb-2 flex items-center justify-between gap-2">
                  <span className="truncate max-w-[140px] md:max-w-[180px] lg:max-w-[220px]" title={pl.name}>{pl.name}</span>
                  <Button
                    variant="destructive"
                    size="icon"
                    className="ml-2"
                    title="Delete Playlist"
                    onClick={() => handleDeletePlaylist(idx)}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </Button>
                </div>
                <Button onClick={() => handlePlayPlaylist(pl.url)} className="w-full bg-green-600 hover:bg-green-700">Play</Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
