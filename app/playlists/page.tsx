"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tooltip, TooltipProvider } from "@/components/ui/tooltip"
import { Plus } from "lucide-react"
import { useState, useEffect } from "react"
import Cookies from "js-cookie"
import { useMusic } from "../context/MusicContext"
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/use-toast"

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

export default function PlaylistsPage() {
  const [playlistUrl, setPlaylistUrl] = useState("")
  const [playlists, setPlaylists] = useState<any[]>([])
  const { handlePlay } = useMusic()
  const [sessionToken, setSessionToken] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [didUserEdit, setDidUserEdit] = useState(false)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [newPlaylistName, setNewPlaylistName] = useState("")
  const [newPlaylistTracks, setNewPlaylistTracks] = useState("")
  const [createError, setCreateError] = useState("");
  const { toast } = useToast();

  // On mount, get session token and fetch playlists from DB
  useEffect(() => {
    const token = Cookies.get("dismusic_session")
    setSessionToken(token || null)
    setDidUserEdit(false)
    console.log("[PlaylistsPage] dismusic_session token:", token)
    if (!token) return
    fetch(`${BACKEND_URL}/api/user/playlists`, {
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
        if (data && Array.isArray(data.playlists)) {
          // Patch in-house playlists to have covers from their tracks (robust: check for albumCover, album.images, and youtubeUrl thumbnails)
          const patched = data.playlists.map(pl => {
            if (!pl.covers && Array.isArray(pl.tracks)) {
              // Defensive: ensure tracks are objects, not just strings
              const covers = pl.tracks
                .map(t => {
                  if (typeof t === 'string') return null;
                  return t.albumCover || t.album?.images?.[0]?.url || t.thumbnail || (t.youtubeUrl && t.youtubeUrl.includes('img.youtube.com') ? t.youtubeUrl : null) || null;
                })
                .filter(url => typeof url === 'string' && url.startsWith('http'))
                .slice(0, 4);
              return {
                ...pl,
                covers
              }
            }
            return pl;
          });
          setPlaylists(patched)
        }
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
    fetch(`${BACKEND_URL}/api/user/playlists`, {
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

  // Validate if URL is a supported playlist
  const isValidPlaylistUrl = (url: string): boolean => {
    const supportedPatterns = [
      /^https:\/\/open\.spotify\.com\/playlist\//,
      /^https:\/\/(?:www\.)?youtube\.com\/playlist\?list=/,
      /^https:\/\/(?:www\.)?music\.youtube\.com\/playlist\?list=/,
      /^https:\/\/youtu\.be\/playlist\?list=/
    ];

    return supportedPatterns.some(pattern => pattern.test(url));
  }

  // Extract YouTube playlist ID from URL
  const extractYouTubePlaylistId = (url: string): string | null => {
    const match = url.match(/[?&]list=([\w-]+)/);
    return match ? match[1] : null;
  }

  // Determine playlist source (spotify, youtube, youtube music)
  const getPlaylistSource = (url: string): string => {
    if (url.includes('open.spotify.com')) return 'spotify';
    if (url.includes('music.youtube.com')) return 'youtube_music';
    return 'youtube';
  }

  const handleAddPlaylist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidPlaylistUrl(playlistUrl)) {
      toast({ title: "Invalid playlist URL format", description: "Please enter a valid Spotify or YouTube playlist link", variant: "destructive" });
      return;
    }

    const playlistSource = getPlaylistSource(playlistUrl);
    let playlistInfo = {
      url: playlistUrl,
      name: playlistUrl,
      covers: [] as string[],
      source: playlistSource
    };

    try {
      // Choose the right API endpoint based on source
      let endpoint;
      if (playlistSource === 'spotify') {
        endpoint = `${BACKEND_URL}/api/spotify`;
      } else {
        // Both YouTube and YouTube Music playlists use the same endpoint
        endpoint = `${BACKEND_URL}/api/youtube`;
      }

      console.log(`[PlaylistsPage] Fetching playlist info from ${endpoint} for URL: ${playlistUrl}`);

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: playlistUrl })
      });

      if (res.ok) {
        const data = await res.json();
        console.log(`[PlaylistsPage] Response data from ${playlistSource}:`, data);

        // Handle playlist name
        playlistInfo.name = data.name || data.title || playlistUrl;

        // Handle playlist covers based on source
        if (data.tracks && Array.isArray(data.tracks)) {
          if (playlistSource === 'spotify') {
            // Handle Spotify format
            playlistInfo.covers = data.tracks.slice(0, 4)
              .map((t: any) => t.albumCover || t.album?.images?.[0]?.url)
              .filter(Boolean);
          } else {
            // Handle YouTube/YouTube Music format
            playlistInfo.covers = data.tracks.slice(0, 4)
              .map((t: any) => t.thumbnail || t.albumCover)
              .filter(Boolean);
          }
        }

        // If we still don't have covers, check if playlist has its own thumbnail
        if ((playlistInfo.covers.length === 0 || playlistInfo.covers.every(cover => !cover)) && data.thumbnail) {
          playlistInfo.covers = [data.thumbnail, data.thumbnail, data.thumbnail, data.thumbnail];
        }

        console.log(`[PlaylistsPage] Processed playlist info:`, playlistInfo);
      } else {
        console.error(`[PlaylistsPage] Error fetching from ${endpoint}, status: ${res.status}`);
        toast({
          title: "Could not fetch playlist",
          description: `Failed to load the ${playlistSource} playlist. Please try again.`,
          variant: "destructive"
        });

        // Still add the playlist with just the URL and extracted ID name
        const listId = extractYouTubePlaylistId(playlistUrl);
        if (playlistSource !== 'spotify' && listId) {
          playlistInfo.name = playlistSource === 'youtube_music'
            ? `YouTube Music Playlist: ${listId}`
            : `YouTube Playlist: ${listId}`;
        }
      }
    } catch (err) {
      console.error("[PlaylistsPage] Error fetching playlist info:", err);
      toast({
        title: "Error loading playlist",
        description: "There was a problem processing your request.",
        variant: "destructive"
      });
    }

    setPlaylists((prev) => [
      playlistInfo,
      ...prev.filter((p) => p.url !== playlistUrl)
    ]);
    setDidUserEdit(true);
    setPlaylistUrl("");
  }

  // Delete playlist handler
  const handleDeletePlaylist = async (playlist, idx) => {
    if (!sessionToken) return;
    // If playlist has an id, it's an in-house playlist (from user_playlists table)
    const deleteBody = playlist.id
      ? { playlistId: playlist.id }
      : { playlistIndex: idx };
    try {
      const res = await fetch(`${BACKEND_URL}/api/user/playlists`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${sessionToken}`
        },
        body: JSON.stringify(deleteBody)
      });
      if (res.ok) {
        const data = await res.json();
        setPlaylists(data.playlists);
      }
    } catch (err) {
      console.error("[PlaylistsPage] Error deleting playlist:", err);
    }
  };

  const handlePlayPlaylist = (pl) => {
    // If in-house playlist (has id and tracks), send the whole playlist object
    if (pl.id && Array.isArray(pl.tracks)) {
      handlePlay({ inhouse: true, tracks: pl.tracks, name: pl.name });
    } else {
      // Otherwise, treat as legacy Yt/Spotify (url-based)
      handlePlay(pl.url);
    }
  }

  const handleOpenCreateDialog = () => setShowCreateDialog(true)
  const handleCloseCreateDialog = () => {
    setShowCreateDialog(false)
    setNewPlaylistName("")
    setNewPlaylistTracks("")
    setCreateError("");
  }

  const handleCreatePlaylist = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError("");
    if (!newPlaylistName.trim() || !sessionToken) {
      toast({ title: "Playlist name is required.", variant: "destructive" });
      return;
    }
    const tracks = newPlaylistTracks
      .split(/\n|,/) // split by new line or comma
      .map(t => t.trim())
      .filter(Boolean);
    if (tracks.length === 0) {
      toast({ title: "Please enter at least one track URL.", variant: "destructive" });
      return;
    }
    // Only allow valid Spotify or YouTube track URLs
    const validTrackRegex = /^(https:\/\/(open\.spotify\.com\/track\/|music\.youtube\.com\/watch\?v=|www\.music\.youtube\.com\/watch\?v=|youtube\.com\/watch\?v=|www\.youtube\.com\/watch\?v=|youtu\.be\/)[^\s]+)$/;
    const invalidTrack = tracks.find(t => !validTrackRegex.test(t));
    if (invalidTrack) {
      toast({ title: "One or more track URLs are invalid.", description: `Invalid: ${invalidTrack}`, variant: "destructive" });
      return;
    }
    try {
      const res = await fetch(`${BACKEND_URL}/api/user/playlist/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${sessionToken}`
        },
        body: JSON.stringify({ name: newPlaylistName, tracks })
      });
      if (res.ok) {
        // Refetch playlists after creation
        const playlistsRes = await fetch(`${BACKEND_URL}/api/user/playlists`, {
          method: "GET",
          headers: { "Authorization": `Bearer ${sessionToken}` }
        });
        const data = await playlistsRes.json();
        if (data && Array.isArray(data.playlists)) setPlaylists(data.playlists);
        setShowCreateDialog(false);
        setNewPlaylistName("");
        setNewPlaylistTracks("");
        setCreateError("");
        toast({ title: "Playlist created!", variant: "success" });
      } else {
        toast({ title: "Failed to create playlist. Please try again.", variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Error creating playlist.", description: "Please check your input and try again.", variant: "destructive" });
      console.error("[PlaylistsPage] Error creating playlist:", err);
    }
  }

  return (
    <TooltipProvider>
      <div className="p-6 h-full overflow-auto">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-3xl font-extrabold text-white tracking-tight drop-shadow">Your Playlists</h2>
          <Button className="bg-gradient-to-r from-green-500 to-green-700 hover:from-green-600 hover:to-green-800 shadow-lg flex items-center gap-2" onClick={handleOpenCreateDialog}>
            <Plus className="w-5 h-5" />
            <span>Create Playlist</span>
          </Button>
        </div>
        <form onSubmit={handleAddPlaylist} className="flex gap-3 mb-8 items-center">
          <Input
            type="text"
            value={playlistUrl}
            onChange={e => setPlaylistUrl(e.target.value)}
            placeholder="Paste Spotify, YouTube, or YouTube Music playlist URL here"
            className="flex-1 px-4 py-2 rounded-lg bg-[#232323] text-white border border-gray-700 focus:ring-2 focus:ring-green-600 transition-all"
          />
          <Button type="submit" className="bg-green-600 hover:bg-green-700 shadow-md flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Add
          </Button>
        </form>
        {playlists.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-96 text-gray-400 animate-fade-in">
            <p className="text-lg mb-2">Add some playlists and get grooving!</p>
            <span className="text-4xl">🎶</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
            {playlists.map((pl, idx) => (
              <div
                key={pl.id ? `inhouse-${pl.id}-${idx}` : pl.url ? `url-${pl.url}` : `idx-${idx}`}
                className="bg-[#232323] rounded-xl shadow-xl p-0 flex flex-col overflow-hidden border border-gray-800 hover:shadow-2xl hover:scale-[1.025] transition-all duration-200 group relative animate-fade-in"
              >
                <div className="aspect-square w-full grid grid-cols-2 grid-rows-2">
                  {[0,1,2,3].map(i => (
                    <div key={i} className="w-full h-full bg-gray-800 flex items-center justify-center overflow-hidden">
                      {pl.covers && pl.covers[i] ? (
                        <img src={pl.covers[i]} alt="cover" className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-200" />
                      ) : (
                        <span className="text-gray-700 text-2xl">🎵</span>
                      )}
                    </div>
                  ))}
                </div>
                <div className="p-4 flex-1 flex flex-col justify-between">
                  <div className="font-bold text-white mb-2 flex items-center justify-between gap-2">
                    <Tooltip content={pl.name}>
                      <span className="truncate max-w-[140px] md:max-w-[180px] lg:max-w-[220px]" title={pl.name}>{pl.name}</span>
                    </Tooltip>
                    <Button
                      variant="destructive"
                      size="icon"
                      className="ml-2 opacity-80 hover:opacity-100"
                      title="Delete Playlist"
                      onClick={() => handleDeletePlaylist(pl, idx)}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </Button>
                  </div>
                  <Button onClick={() => handlePlayPlaylist(pl)} className="w-full bg-gradient-to-r from-green-500 to-green-700 hover:from-green-600 hover:to-green-800 shadow-md mt-2">Play</Button>
                </div>
              </div>
            ))}
          </div>
        )}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent>
            <form onSubmit={handleCreatePlaylist}>
              <DialogHeader>
                <DialogTitle>Create New Playlist</DialogTitle>
              </DialogHeader>
              <div className="mt-4 space-y-4">
                <Input
                  value={newPlaylistName}
                  onChange={e => setNewPlaylistName(e.target.value)}
                  placeholder="Playlist name"
                  className="w-full bg-[#181818] text-white placeholder-gray-400 border border-gray-700 focus:ring-2 focus:ring-green-600"
                  autoFocus
                />
                <Textarea
                  value={newPlaylistTracks}
                  onChange={e => setNewPlaylistTracks(e.target.value)}
                  placeholder="Enter track URLs, one per line or comma separated"
                  className="w-full min-h-[100px] bg-[#181818] text-white placeholder-gray-400 border border-gray-700 focus:ring-2 focus:ring-green-600"
                />
              </div>
              <DialogFooter className="mt-6">
                <Button type="button" variant="secondary" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
                <Button type="submit" className="bg-green-600 hover:bg-green-700">Create</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  )
}
