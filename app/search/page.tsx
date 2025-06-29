"use client"

import { Search, ChevronLeft, ChevronRight, Heart, Play, Plus, MoreVertical, Check } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useState, useEffect } from "react"
import { useToast } from "@/components/ui/use-toast"
import { useMusic } from "@/app/context/MusicContext"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface SpotifyResult {
  id: string
  name: string
  type: string
  artists?: { name: string }[]
  images?: { url: string; height: number; width: number }[]
  album_type?: string
  album?: {
    images: { url: string; height: number; width: number }[]
  }
  external_urls?: {
    spotify: string
  }
}

interface UserPlaylist {
  id: string;
  name: string;
  tracks: any[];
}

export default function SearchPage() {
  const { socket } = useMusic();
  const { toast } = useToast();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userPlaylists, setUserPlaylists] = useState<UserPlaylist[]>([])
  const [query, setQuery] = useState("")
  const [activeTab, setActiveTab] = useState("all")
  const [isLoading, setIsLoading] = useState(false)
  const [page, setPage] = useState(0)
  const [successAnimationId, setSuccessAnimationId] = useState<string | null>(null);
  const [results, setResults] = useState<{
    tracks: SpotifyResult[];
    artists: SpotifyResult[];
    albums: SpotifyResult[];
    playlists: SpotifyResult[];
  }>({
    tracks: [],
    artists: [],
    albums: [],
    playlists: []
  });
  const PAGE_SIZE = 6
  const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

  // Get session token from cookies
  useEffect(() => {
    const token = document.cookie.split('; ').find(row => row.startsWith('dismusic_session='))?.split('=')[1];
    setIsAuthenticated(!!token);
  }, []);

  // Search function
  const performSearch = async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults({ tracks: [], artists: [], albums: [], playlists: [] })
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/search?query=${encodeURIComponent(searchQuery)}&type=${activeTab}`)
      const data = await response.json()

      if (activeTab === "all") {
        setResults({
          tracks: data.tracks?.items || [],
          artists: data.artists?.items || [],
          albums: data.albums?.items || [],
          playlists: data.playlists?.items || []
        })
      } else {
        const key = `${activeTab}s`
        setResults(prev => ({
          ...prev,
          [key]: data[key]?.items || []
        }))
      }
    } catch (error) {
      console.error("Search failed:", error)
    } finally {
      setIsLoading(false)
    }
  }

  // Use effect to handle search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      performSearch(query)
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [query, activeTab])

  // Load user playlists
  useEffect(() => {
    const loadUserPlaylists = async () => {
      if (!isAuthenticated) return;

      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/user/playlists`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("dismusic_session")}`
          }
        });
        const data = await response.json();
        setUserPlaylists(data.playlists || []);
      } catch (error) {
        console.error("Failed to load playlists:", error);
      }
    };

    loadUserPlaylists();
  }, [isAuthenticated]);

  const getImageUrl = (result: SpotifyResult | null) => {
    if (!result) return "/placeholder.jpg"

    // For tracks, get image from album
    if (result.type === 'track' && result.album?.images?.[0]?.url) {
      return result.album.images[0].url
    }
    // For other types (artists, albums, playlists), get image directly
    if (result.images?.[0]?.url) {
      return result.images[0].url
    }
    return "/placeholder.jpg"
  }

  const playItem = (result: SpotifyResult) => {
    if (!socket) {
      toast({
        title: "Error",
        description: "Not connected to server",
        variant: "destructive"
      })
      return
    }

    const query = result.external_urls?.spotify || ""
    if (!query) {
      toast({
        title: "Error",
        description: "No playable URL found",
        variant: "destructive"
      })
      return
    }

    socket.emit("play", { query })
    toast({
      title: "Playing",
      description: `Playing ${result.name}`,
    })
  }

  const addToFavorites = async (result: SpotifyResult) => {
    if (!isAuthenticated) {
      toast({
        title: "Error",
        description: "Please login to add favorites",
        variant: "destructive"
      })
      return
    }

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/user/favorites/toggle`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("dismusic_session")}`
        },
        body: JSON.stringify({
          track: {
            name: result.name,
            artist: result.artists?.[0]?.name,
            albumCover: getImageUrl(result),
            spotifyUrl: result.external_urls?.spotify
          }
        })
      })

      const data = await response.json()
      toast({
        title: data.added ? "Added to favorites" : "Removed from favorites",
        description: result.name,
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update favorites",
        variant: "destructive"
      })
    }
  }

  const addPlaylistToLibrary = async (playlist: SpotifyResult) => {
    if (!isAuthenticated) {
      toast({
        title: "Authentication required",
        description: "Please log in to add playlists to your library",
        variant: "destructive"
      });
      return;
    }

    try {
      const token = document.cookie.split('; ').find(row => row.startsWith('dismusic_session='))?.split('=')[1];
      if (!token) throw new Error("No session token found");

      // First fetch the playlist info to get covers
      const res = await fetch(`${BACKEND_URL}/api/spotify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: playlist.external_urls?.spotify })
      });

      if (!res.ok) {
        throw new Error("Failed to fetch playlist info");
      }

      const data = await res.json();

      // Add the playlist to user's playlists (legacy format)
      const legacyPlaylist = {
        url: playlist.external_urls?.spotify,
        name: playlist.name,
        covers: data.covers || [],
        source: 'spotify'
      };

      // Update playlists in backend
      const updateRes = await fetch(`${BACKEND_URL}/api/user/playlists`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          playlists: [legacyPlaylist]
        })
      });

      if (!updateRes.ok) {
        throw new Error("Failed to save playlist");
      }

      // Show success animation
      setSuccessAnimationId(playlist.id);
      setTimeout(() => {
        setSuccessAnimationId(null);
      }, 2000);

      toast({
        title: "Success!",
        description: `Added "${playlist.name}" to your library`,
        variant: "success"
      });
    } catch (err) {
      console.error("[Search] Error adding playlist to library:", err);
      toast({
        title: "Failed to add playlist",
        description: err.message || "An error occurred while adding the playlist",
        variant: "destructive"
      });
    }
  };

  const addToPlaylist = async (result: SpotifyResult, playlistId: string) => {
    if (!isAuthenticated) {
      toast({
        title: "Error",
        description: "Please login to add to playlist",
        variant: "destructive"
      })
      return
    }

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/user/playlist/${playlistId}/add-track`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("dismusic_session")}`
        },
        body: JSON.stringify({
          trackUrl: result.external_urls?.spotify
        })
      })

      const data = await response.json()
      if (data.success) {
        toast({
          title: "Added to playlist",
          description: result.name,
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add to playlist",
        variant: "destructive"
      })
    }
  }

  const renderResult = (result: SpotifyResult | null) => {
    if (!result?.id) return null

    const imageUrl = getImageUrl(result)
    let subtitle = 'Unknown'

    if (result.type === "track" || result.type === "album") {
      subtitle = result.artists?.[0]?.name || 'Unknown Artist'
    } else if (result.type) {
      subtitle = result.type.charAt(0).toUpperCase() + result.type.slice(1)
    }

    const isPlaylist = result.type === 'playlist';

    return (
      <Card key={result.id} className="bg-[#2a2a2a] hover:bg-[#333333] transition-colors border-gray-800 group">
        <CardContent className="p-4 relative">
          <div className="aspect-square bg-[#1a1a1a] rounded-md mb-4 relative overflow-hidden group">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt={result.name || 'Unknown'}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
              <Button
                size="icon"
                variant="secondary"
                className="rounded-full"
                onClick={() => playItem(result)}
              >
                <Play className="w-6 h-6" />
              </Button>
            </div>
          </div>
          <h3 className="font-semibold text-white truncate">{result.name || 'Unknown'}</h3>
          <p className="text-sm text-gray-400">{subtitle}</p>

          <div className="absolute top-4 right-4 flex gap-2">
            <Button
              size="icon"
              variant="ghost"
              className="w-8 h-8 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => isPlaylist ? addPlaylistToLibrary(result) : addToFavorites(result)}
              title={isPlaylist ? "Add to Library" : "Add to Favorites"}
            >
              {isPlaylist ? (
                successAnimationId === result.id ? (
                  <Check className="w-4 h-4 text-green-500" />
                ) : (
                  <Plus className="w-4 h-4" />
                )
              ) : (
                <Heart className="w-4 h-4" />
              )}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className="w-8 h-8 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {isPlaylist ? (
                  <>
                    <DropdownMenuItem onSelect={() => playItem(result)}>
                      Play Playlist
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => {
                      if (socket) {
                        socket.emit("addToQueue", { query: result.external_urls?.spotify })
                        toast({
                          title: "Added to queue",
                          description: `Added playlist ${result.name}`,
                        })
                      }
                    }}>
                      Add Playlist to Queue
                    </DropdownMenuItem>
                    {isAuthenticated && (
                      <DropdownMenuItem
                        onSelect={() => addPlaylistToLibrary(result)}
                        className="gap-2"
                      >
                        <Plus className="w-4 h-4" />
                        Add to Library
                      </DropdownMenuItem>
                    )}
                  </>
                ) : (
                  <>
                    <DropdownMenuItem onSelect={() => playItem(result)}>
                      Play Now
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => {
                      if (socket) {
                        socket.emit("addToQueue", { query: result.external_urls?.spotify })
                        toast({
                          title: "Added to queue",
                          description: result.name,
                        })
                      }
                    }}>
                      Add to Queue
                    </DropdownMenuItem>
                    {isAuthenticated && (
                      <>
                        <DropdownMenuItem
                          onSelect={() => addToFavorites(result)}
                          className="gap-2"
                        >
                          <Heart className="w-4 h-4" />
                          Add to Favorites
                        </DropdownMenuItem>
                        {userPlaylists.length > 0 && (
                          <>
                            <DropdownMenuItem className="p-0">
                              <div className="w-full px-2 py-1.5 text-sm font-semibold opacity-50">
                                Add to Playlist
                              </div>
                            </DropdownMenuItem>
                            {userPlaylists.map(playlist => (
                              <DropdownMenuItem
                                key={playlist.id}
                                onSelect={() => addToPlaylist(result, playlist.id)}
                                className="pl-4"
                              >
                                {playlist.name}
                              </DropdownMenuItem>
                            ))}
                          </>
                        )}
                      </>
                    )}
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardContent>
      </Card>
    )
  }

  const getActiveResults = () => {
    let allResults: SpotifyResult[] = []
    if (activeTab === "all") {
      allResults = [
        ...(results.tracks || []),
        ...(results.artists || []),
        ...(results.albums || []),
        ...(results.playlists || [])
      ].filter(Boolean)
    } else {
      const key = `${activeTab}s` as keyof typeof results
      allResults = (results[key] || []).filter(Boolean)
    }

    const totalPages = Math.ceil(allResults.length / PAGE_SIZE)
    const pagedResults = allResults.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

    return {
      results: pagedResults,
      totalPages
    }
  }

  // Reset page when changing tabs or search query
  useEffect(() => {
    setPage(0)
  }, [activeTab, query])

  return (
    <div className="h-full overflow-auto">
      <div className="p-6 md:p-6 px-4 py-4">
        <div className="w-full md:max-w-2xl mx-auto space-y-6">
          {/* Search Header */}
          <div className="text-center mb-8">
            <h1 className="text-2xl md:text-4xl font-bold text-white mb-4">
              Find Your Music
            </h1>
            <p className="text-gray-400 text-sm md:text-base">
              Search for songs, artists, albums, and playlists
            </p>
          </div>

          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 md:left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 md:w-5 h-4 md:h-5" />
            <Input
              type="search"
              placeholder="What do you want to listen to?"
              className="pl-9 md:pl-12 h-10 md:h-12 bg-[#2a2a2a] border-gray-700 text-white placeholder:text-gray-400 text-sm md:text-lg w-full"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          {/* Search Filters */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="w-full justify-start bg-[#2a2a2a] border-b border-gray-800">
              <TabsTrigger value="all" className="data-[state=active]:bg-[#1a1a1a] data-[state=active]:text-white text-gray-400">
                All
              </TabsTrigger>
              <TabsTrigger value="track" className="data-[state=active]:bg-[#1a1a1a] data-[state=active]:text-white text-gray-400">
                Songs
              </TabsTrigger>
              <TabsTrigger value="artist" className="data-[state=active]:bg-[#1a1a1a] data-[state=active]:text-white text-gray-400">
                Artists
              </TabsTrigger>
              <TabsTrigger value="album" className="data-[state=active]:bg-[#1a1a1a] data-[state=active]:text-white text-gray-400">
                Albums
              </TabsTrigger>
              <TabsTrigger value="playlist" className="data-[state=active]:bg-[#1a1a1a] data-[state=active]:text-white text-gray-400">
                Playlists
              </TabsTrigger>
            </TabsList>

            <div className="mt-6 space-y-6">
              {isLoading ? (
                <div className="text-gray-400 text-center py-8">Searching...</div>
              ) : getActiveResults().results.length > 0 ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {getActiveResults().results.map(renderResult)}
                  </div>

                  {/* Pagination */}
                  {getActiveResults().totalPages > 1 && (
                    <div className="flex justify-center items-center gap-3 mt-8 mb-6">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setPage((p) => Math.max(0, p - 1))}
                        disabled={page === 0}
                        className="h-8 w-8 p-0"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <span className="text-sm text-gray-400">
                        {page + 1} / {getActiveResults().totalPages}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setPage((p) => Math.min(getActiveResults().totalPages - 1, p + 1))}
                        disabled={page >= getActiveResults().totalPages - 1}
                        className="h-8 w-8 p-0"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </>
              ) : query ? (
                <div className="text-gray-400 text-center py-8">No results found</div>
              ) : (
                <div className="text-gray-400 text-center py-8">
                  Start typing to search
                </div>
              )}
            </div>
          </Tabs>
        </div>
      </div>
    </div>
  )
}
