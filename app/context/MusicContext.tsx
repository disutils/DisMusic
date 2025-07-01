"use client"

import type React from "react"
import { createContext, useContext, useState, useRef, useEffect } from "react"
import io, { type Socket } from "socket.io-client"
import { Heart, ListMusic, QueueList } from "lucide-react"

declare global {
  interface Window {
    YT: any
    onYouTubeIframeAPIReady: () => void
    ytPlayer: any
  }
}

interface MusicContextType {
  videoId: string | null
  ytReady: boolean
  queue: string[]
  isPlaying: boolean
  volume: number[]
  currentTime: number
  duration: number
  loading: boolean
  error: string
  handlePlay: (query: string) => void
  handlePause: () => void
  handleResume: () => void
  handleSkip: () => void
  handleVolumeChange: (value: number[]) => void
  setQueue: (queue: string[]) => void
  setCurrentTime: (time: number) => void
  username?: string
  userpfpurl?: string
  display_name?: string
  favorites: any[]
  isFavorited: (track: any) => boolean
  toggleFavorite: (track: any) => Promise<void>
  currentPath: string
  setCurrentPath: (path: string) => void
  socket: Socket | null
}

const MusicContext = createContext<MusicContextType | undefined>(undefined)

export function MusicProvider({ children }: { children: React.ReactNode }) {
  const [videoId, setVideoId] = useState<string | null>(null)
  const [ytReady, setYtReady] = useState(false)
  const [queue, setQueue] = useState<string[]>([])
  const [isPlaying, setIsPlaying] = useState(false)
  const [volume, setVolume] = useState([100])
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [username, setUsername] = useState<string | undefined>(undefined)
  const [userpfpurl, setUserpfpurl] = useState<string | undefined>(undefined)
  const [display_name, setDisplayName] = useState<string | undefined>(undefined)
  const [favorites, setFavorites] = useState<any[]>([])
  const [currentPath, setCurrentPath] = useState<string>("queue")
  const Cookies = require("js-cookie")
  const playerRef = useRef<HTMLDivElement>(null)
  const socketRef = useRef<Socket | null>(null)

  const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "https://musicsocket.distools.dev"

  // Load YouTube IFrame API
  useEffect(() => {
    if (typeof window === "undefined") return

    if (window.YT && window.YT.Player) {
      setYtReady(true)
      return
    }
    window.onYouTubeIframeAPIReady = () => setYtReady(true)
    const tag = document.createElement("script")
    tag.src = "https://www.youtube.com/iframe_api"
    document.body.appendChild(tag)
    return () => {
      window.onYouTubeIframeAPIReady = () => {}
    }
  }, [])

  // Socket.io setup
  useEffect(() => {
    if (typeof window === "undefined") return

    const socket = io(BACKEND_URL);
    socketRef.current = socket

    socket.on("connect", () => {
      console.log("Socket connected:", socket.id)
    })
    socket.on("connect_error", (err) => {
      setError("Socket connection error")
      console.error("Socket connection error:", err)
    })
    socket.on("playYouTube", (data) => {
      let url = data.url;
      let duration = data.duration;
      // Support both { url: string } and { url: { url, duration } }
      if (url && typeof url === "object" && url.url) {
        duration = url.duration ?? duration;
        url = url.url;
      }
      try {
        const id = url && typeof url === "string" && url.startsWith("http") ? new URL(url).searchParams.get("v") : null;
        setVideoId(id);
      } catch (e) {
        setVideoId(null);
        console.error("Invalid YouTube URL:", url, e);
      }
      setLoading(false);
      setIsPlaying(true);
      if (typeof duration === "number") {
        setDuration(duration);
      }
    })
    socket.on("queueUpdate", ({ queue }) => {
      console.log("Received queueUpdate", queue);
      setQueue(queue)
    })

    return () => {
      socket.disconnect()
    }
  }, [])

  // Create or update YouTube player
  useEffect(() => {
    if (typeof window === "undefined") return

    if (ytReady && videoId && playerRef.current) {
      if (!window.ytPlayer) {
        window.ytPlayer = new window.YT.Player(playerRef.current, {
          height: "0",
          width: "0",
          videoId,
          playerVars: { autoplay: 1 },
          events: {
            onStateChange: (event: any) => {
              if (event.data === window.YT.PlayerState.ENDED) {
                socketRef.current?.emit("next")
              }
              if (event.data === window.YT.PlayerState.PAUSED) {
                setIsPlaying(false)
              }
              if (event.data === window.YT.PlayerState.PLAYING) {
                setIsPlaying(true)
              }
            },
            onReady: () => {
              setDuration(window.ytPlayer.getDuration())
              // Set initial volume
              window.ytPlayer.setVolume(volume[0])
            },
          },
        })
      } else {
        window.ytPlayer.loadVideoById(videoId)
      }
    }
  }, [ytReady, videoId])

  // Volume control
  useEffect(() => {
    if (typeof window === "undefined") return

    if (window.ytPlayer && typeof window.ytPlayer.setVolume === "function") {
      window.ytPlayer.setVolume(volume[0])
    }
  }, [volume])

  // Time tracking
  useEffect(() => {
    if (typeof window === "undefined") return

    const interval = setInterval(() => {
      if (window.ytPlayer && typeof window.ytPlayer.getCurrentTime === "function") {
        setCurrentTime(window.ytPlayer.getCurrentTime())
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  // Fetch user info on mount
  useEffect(() => {
    if (typeof window === "undefined") return
    const Cookies = require("js-cookie")
    const token = Cookies.get("dismusic_session")
    console.log("[MusicContext] dismusic_session token:", token)
    if (!token) return
    fetch(`${BACKEND_URL}/api/user/info`, {
      method: "GET",
      headers: { "Authorization": `Bearer ${token}` }
    })
      .then(res => {
        console.log("[MusicContext] /api/user/info status:", res.status)
        return res.ok ? res.json() : null
      })
      .then(data => {
        console.log("[MusicContext] /api/user/info data:", data)
        if (data && data.username) setUsername(data.username)
        if (data && data.userpfpurl) setUserpfpurl(data.userpfpurl)
        if (data && data.display_name) setDisplayName(data.display_name)
      })
      .catch((err) => { console.error("[MusicContext] Error fetching user info:", err) })
  }, [])

  // Fetch favorites on initial load
  useEffect(() => {
    const fetchFavorites = async () => {
      try {
        const token = Cookies.get("dismusic_session");
        if (!token) return;

        const res = await fetch(`${BACKEND_URL}/api/user/favorites`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await res.json();
        if (data.favorites) {
          setFavorites(data.favorites);
        }
      } catch (err) {
        console.error("Failed to fetch favorites:", err);
      }
    };
    fetchFavorites();
  }, []);

  const isFavorited = (track: any) => {
    return favorites.some(f =>
      (f.name === track.name && f.artist === track.artist) ||
      (f.youtubeUrl && f.youtubeUrl === track.youtubeUrl) ||
      (f.appleMusicUrl && f.appleMusicUrl === track.appleMusicUrl)
    );
  };

  const toggleFavorite = async (track: any) => {
    try {
      const token = Cookies.get("dismusic_session");
      console.log("[FAVORITES DEBUG] Token:", token);
      if (!token) {
        setError("Please log in to favorite tracks");
        return;
      }

      console.log("[FAVORITES DEBUG] Toggling favorite for track:", track);
      const res = await fetch(`${BACKEND_URL}/api/user/favorites/toggle`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ track }),
      });

      const data = await res.json();
      console.log("[FAVORITES DEBUG] Toggle response:", data);
      if (data.favorites) {
        setFavorites(data.favorites);
      }
    } catch (err) {
      console.error("Failed to toggle favorite:", err);
      setError("Failed to update favorites");
    }
  };

  const handlePlay = (query: string) => {
    console.log('handlePlay called', { query, videoId, socket: socketRef.current });
    setError("")
    // Use isPlaying as a more reliable indicator
    if (!videoId && !isPlaying) {
      setLoading(true)
      setVideoId(null)
      console.log('Emitting play', { query });
      socketRef.current?.emit("play", { query })
    } else {
      console.log('Emitting addToQueue', { query });
      socketRef.current?.emit("addToQueue", { query })
    }
  }

  const handlePause = () => {
    if (typeof window !== "undefined" && window.ytPlayer) {
      window.ytPlayer.pauseVideo()
    }
  }

  const handleResume = () => {
    if (typeof window !== "undefined" && window.ytPlayer) {
      window.ytPlayer.playVideo()
    }
  }

  const handleSkip = () => {
    socketRef.current?.emit("next")
  }

  const handleVolumeChange = (value: number[]) => {
    setVolume(value)
  }

  return (
    <MusicContext.Provider
      value={{
        videoId,
        ytReady,
        queue,
        isPlaying,
        volume,
        currentTime,
        duration,
        loading,
        error,
        handlePlay,
        handlePause,
        handleResume,
        handleSkip,
        handleVolumeChange,
        setQueue,
        setCurrentTime,
        username,
        userpfpurl,
        display_name,
        favorites,
        isFavorited,
        toggleFavorite,
        currentPath,
        setCurrentPath,
        socket: socketRef.current,
      }}
    >
      {children}
      <div ref={playerRef} className="hidden" />
    </MusicContext.Provider>
  )
}

export function useMusic() {
  const context = useContext(MusicContext)
  if (context === undefined) {
    throw new Error("useMusic must be used within a MusicProvider")
  }
  return context
}
