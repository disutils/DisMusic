"use client"

import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Music, Loader2, ChevronLeft, ChevronRight } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

// Helper to format seconds to mm:ss
function formatTime(seconds = 0) {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, "0")}`
}

// Helper to get track info
const getTrackInfo = (item: any) => {
  if (!item) return { title: "Unknown Track", artist: "Unknown Artist", duration: "-", albumCover: null }
  if (typeof item === "string") {
    return { title: item, artist: "Unknown Artist", duration: "-", albumCover: null }
  }
  let duration = typeof item.duration === "number" ? formatTime(item.duration) : (item.duration || "-")
  if (typeof item.duration_ms === "number") duration = formatTime(Math.round(item.duration_ms / 1000))
  return {
    title: item.title || item.name || "Unknown Track",
    artist: item.artist || (item.artists && item.artists[0]?.name) || "Unknown Artist",
    duration,
    albumCover: item.albumCover || item.image || (item.album?.images?.[0]?.url) || null,
  }
}

// Helper to get a cookie value by name
function getCookie(name: string) {
  if (typeof document === "undefined") return null;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(";").shift() || null;
  return null;
}

export default function PlaylistPage() {
  const { id } = useParams() as { id: string }
  const router = useRouter()
  const [playlist, setPlaylist] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [page, setPage] = useState(0)
  const [newTrackUrl, setNewTrackUrl] = useState("");
  const [addingTrack, setAddingTrack] = useState(false);
  const [addTrackError, setAddTrackError] = useState("");
  const PAGE_SIZE = 8

  useEffect(() => {
    const fetchPlaylist = async () => {
      setLoading(true)
      setError("")
      try {
        const apiUrl = process.env.NEXT_PUBLIC_BACKEND_URL
          ? `${process.env.NEXT_PUBLIC_BACKEND_URL.replace(/\/$/, "")}/api/user/playlist/${id}`
          : `/api/user/playlist/${id}`;
        const sessionToken = typeof window !== "undefined" ? getCookie("dismusic_session") : null;
        const res = await fetch(apiUrl, {
          headers: {
            Authorization: sessionToken ? `Bearer ${sessionToken}` : ""
          }
        })
        if (!res.ok) throw new Error("Failed to fetch playlist")
        const data = await res.json()
        setPlaylist(data)
      } catch (e: any) {
        setError(e.message || "Error loading playlist")
      } finally {
        setLoading(false)
      }
    }
    if (id) fetchPlaylist()
  }, [id])

  // Add track to playlist handler
  const handleAddTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddTrackError("");
    if (!newTrackUrl.trim()) {
      setAddTrackError("Track URL is required.");
      return;
    }
    setAddingTrack(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_BACKEND_URL
        ? `${process.env.NEXT_PUBLIC_BACKEND_URL.replace(/\/$/, "")}/api/user/playlist/${id}/add-track`
        : `/api/user/playlist/${id}/add-track`;
      const sessionToken = typeof window !== "undefined" ? getCookie("dismusic_session") : null;
      const res = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: sessionToken ? `Bearer ${sessionToken}` : ""
        },
        body: JSON.stringify({ trackUrl: newTrackUrl })
      });
      if (!res.ok) {
        const err = await res.json();
        setAddTrackError(err.error || "Failed to add track");
      } else {
        setNewTrackUrl("");
        // Refetch playlist from backend instead of using add-track response
        const apiUrl = process.env.NEXT_PUBLIC_BACKEND_URL
          ? `${process.env.NEXT_PUBLIC_BACKEND_URL.replace(/\/$/, "")}/api/user/playlist/${id}`
          : `/api/user/playlist/${id}`;
        const sessionToken = typeof window !== "undefined" ? getCookie("dismusic_session") : null;
        const playlistRes = await fetch(apiUrl, {
          headers: {
            Authorization: sessionToken ? `Bearer ${sessionToken}` : ""
          }
        });
        if (playlistRes.ok) {
          const playlistData = await playlistRes.json();
          setPlaylist(playlistData);
        }
      }
    } catch (e: any) {
      setAddTrackError(e.message || "Error adding track");
    } finally {
      setAddingTrack(false);
    }
  };

  if (loading) {
    return <div className="flex flex-col items-center justify-center h-full py-20 text-gray-400"><Loader2 className="animate-spin w-8 h-8 mb-4" />Loading playlist...</div>
  }
  if (error) {
    return <div className="flex flex-col items-center justify-center h-full py-20 text-red-400">{error}</div>
  }
  if (!playlist) {
    return <div className="flex flex-col items-center justify-center h-full py-20 text-gray-400">Playlist not found</div>
  }

  const tracks = Array.isArray(playlist.tracks) ? playlist.tracks : []
  const totalPages = Math.ceil(tracks.length / PAGE_SIZE)
  const pagedTracks = tracks.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  return (
    <div className="h-full overflow-auto">
      <div className="p-6 md:p-6 px-4 py-4 flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()} className="h-8 w-8 p-0"><ChevronLeft className="w-5 h-5" /></Button>
        <h1 className="text-2xl md:text-3xl font-bold text-white flex-1 truncate">{playlist.name || "Playlist"}</h1>
      </div>
      <div className="px-4 py-4 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg md:text-xl font-bold text-white">Tracks</h3>
        </div>
        {/* Add Track Form */}
        <form onSubmit={handleAddTrack} className="flex gap-2 mb-6">
          <input
            type="text"
            value={newTrackUrl}
            onChange={e => setNewTrackUrl(e.target.value)}
            placeholder="Paste Spotify or YouTube track URL"
            className="flex-1 px-3 py-2 rounded bg-[#232323] text-white border border-gray-700 focus:ring-2 focus:ring-green-600"
            disabled={addingTrack}
          />
          <Button type="submit" className="bg-green-600 hover:bg-green-700" disabled={addingTrack}>Add Track</Button>
        </form>
        {addTrackError && <div className="text-red-400 mb-4">{addTrackError}</div>}
        <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-2 text-sm text-gray-400 border-b border-gray-800 mb-2">
          <div className="col-span-1">#</div>
          <div className="col-span-6">Title</div>
          <div className="col-span-3">Artist</div>
          <div className="col-span-2">Duration</div>
        </div>
        <div className="space-y-1">
          {pagedTracks.length === 0 && (
            <div className="text-center py-8 md:py-12 text-gray-400">
              <Music className="w-10 h-10 md:w-12 md:h-12 mx-auto mb-3 md:mb-4 opacity-50" />
              <p className="text-sm md:text-base">No tracks in this playlist</p>
            </div>
          )}
          {pagedTracks.map((item, i) => {
            const trackInfo = getTrackInfo(item)
            return (
              <div key={i + page * PAGE_SIZE} className="md:grid md:grid-cols-12 flex flex-col gap-1 md:gap-4 px-3 md:px-4 py-2 md:py-3 rounded-lg hover:bg-[#2a2a2a] group">
                {/* Mobile Layout */}
                <div className="flex items-center gap-2 md:hidden">
                  <div className="w-8 h-8 bg-gray-700 rounded flex-shrink-0 flex items-center justify-center overflow-hidden">
                    {trackInfo.albumCover ? (
                      <img src={trackInfo.albumCover || "/placeholder.svg"} alt={trackInfo.title} className="w-full h-full object-cover" onError={e => { e.currentTarget.style.display = "none"; if (e.currentTarget.nextElementSibling) e.currentTarget.nextElementSibling.style.display = "flex" }} />
                    ) : (
                      <Music className="w-3 h-3 text-gray-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-sm truncate text-white">{trackInfo.title}</p>
                      <span className="text-xs text-gray-400 flex-shrink-0">{trackInfo.duration}</span>
                    </div>
                    <p className="text-xs text-gray-400 truncate">{trackInfo.artist}</p>
                  </div>
                </div>
                {/* Desktop Layout */}
                <div className="md:col-span-1 hidden md:flex items-center">
                  <span className="text-gray-400">{i + page * PAGE_SIZE + 1}</span>
                </div>
                <div className="col-span-6 hidden md:flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-700 rounded flex items-center justify-center overflow-hidden">
                    {trackInfo.albumCover ? (
                      <img src={trackInfo.albumCover || "/placeholder.svg"} alt={trackInfo.title} className="w-full h-full object-cover" onError={e => { e.currentTarget.style.display = "none"; if (e.currentTarget.nextElementSibling) e.currentTarget.nextElementSibling.style.display = "flex" }} />
                    ) : null}
                    <div className={`w-full h-full flex items-center justify-center ${trackInfo.albumCover ? "hidden" : ""}`}>
                      <Music className="w-4 h-4 text-gray-500" />
                    </div>
                  </div>
                  <div>
                    <p className="font-medium text-white">{trackInfo.title}</p>
                    <p className="text-sm text-gray-400">{trackInfo.artist}</p>
                  </div>
                </div>
                <div className="col-span-3 hidden md:flex items-center text-gray-400">{trackInfo.artist}</div>
                <div className="col-span-2 hidden md:flex items-center">{trackInfo.duration}</div>
              </div>
            )
          })}
        </div>
        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-3 md:gap-4 mt-6 md:mt-8">
            <Button variant="ghost" size="sm" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="h-8 w-8 md:h-9 md:w-9 p-0">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-xs md:text-sm text-gray-400">{page + 1} / {totalPages}</span>
            <Button variant="ghost" size="sm" onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="h-8 w-8 md:h-9 md:w-9 p-0">
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
