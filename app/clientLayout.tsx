"use client"

import type React from "react"
import Cookies from "js-cookie"

import { usePathname, useRouter } from "next/navigation"
import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Volume2,
  Music,
  Heart,
  Shuffle,
  Repeat,
  Download,
  Settings,
  User,
  Library,
  Mic,
  BarChart3,
  Headphones,
  Clock,
  Home,
  Search,
  Disc3,
} from "lucide-react"
import { useMusic } from "./context/MusicContext"
import { Badge } from "@/components/ui/badge"

declare global {
  interface Window {
    YT: any
    onYouTubeIframeAPIReady: () => void
    ytPlayer: any
  }
}

// Helper function to safely get track information
const getTrackInfo = (item: any) => {
  if (typeof item === "string") {
    return {
      title: item,
      artist: "Unknown Artist",
      albumCover: null,
    }
  }
  if (item && typeof item === "object") {
    return {
      title: item.title || item.name || "Unknown Track",
      artist: item.artist || "Unknown Artist",
      albumCover: item.albumCover || item.image || null,
    }
  }
  return {
    title: "Unknown Track",
    artist: "Unknown Artist",
    albumCover: null,
  }
}

export default function ClientLayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const {
    queue,
    isPlaying,
    volume,
    currentTime,
    duration,
    videoId,
    handlePause,
    handleResume,
    handleSkip,
    handleVolumeChange,
    setCurrentTime,
    username,
    userpfpurl,
  } = useMusic()

  const [isDragging, setIsDragging] = useState(false)
  const [dragTime, setDragTime] = useState<number | null>(null)
  const progressBarRef = useRef<HTMLDivElement>(null)
  const [hasMounted, setHasMounted] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [unauthorized, setUnauthorized] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  // Update the currentTrack assignment
  const currentTrackInfo = queue.length > 0 ? getTrackInfo(queue[0]) : null
  const currentTrack = currentTrackInfo?.title || "No track selected"

  const navigationItems = [
    { path: "/", icon: Home, label: "Browse" },
    { path: "/search", icon: Search, label: "Search" },
    { path: "/lyrics", icon: Mic, label: "Lyrics" },
    { path: "/stats", icon: BarChart3, label: "Stats" },
    { path: "/queue", icon: Clock, label: "Queue" },
  ]

  const libraryItems = [
    { path: "/playlists", icon: Library, label: "Playlists" },
    { path: "/artists", icon: User, label: "Artists" },
    { path: "/albums", icon: Disc3, label: "Albums" },
  ]

  // Handle progress bar drag events
  const handleProgressMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!duration) return

    setIsDragging(true)

    const rect = progressBarRef.current?.getBoundingClientRect()
    if (!rect) return

    const clickX = e.clientX - rect.left
    const percentage = clickX / rect.width
    const newTime = percentage * duration

    setDragTime(newTime)
  }

  const handleProgressMouseMove = (e: MouseEvent) => {
    if (!isDragging || !duration) return

    const rect = progressBarRef.current?.getBoundingClientRect()
    if (!rect) return

    const moveX = e.clientX - rect.left
    const percentage = Math.max(0, Math.min(1, moveX / rect.width))
    const newTime = percentage * duration

    setDragTime(newTime)
  }

  const handleProgressMouseUp = () => {
    if (isDragging && dragTime !== null && typeof window !== "undefined" && window.ytPlayer) {
      window.ytPlayer.seekTo(dragTime)
      setCurrentTime(dragTime)
    }

    setIsDragging(false)
    setDragTime(null)
  }

  // Add and remove event listeners for drag
  useEffect(() => {
    if (typeof window === "undefined") return

    if (isDragging) {
      window.addEventListener("mousemove", handleProgressMouseMove)
      window.addEventListener("mouseup", handleProgressMouseUp)
    }

    return () => {
      window.removeEventListener("mousemove", handleProgressMouseMove)
      window.removeEventListener("mouseup", handleProgressMouseUp)
    }
  }, [isDragging, dragTime, duration])

  // Fix for volume slider
  const handleVolumeSliderChange = (newVolume: number[]) => {
    if (typeof window !== "undefined" && window.ytPlayer && typeof window.ytPlayer.setVolume === "function") {
      window.ytPlayer.setVolume(newVolume[0])
    }
    handleVolumeChange(newVolume)
  }

  useEffect(() => {
    setHasMounted(true);
    if (typeof window !== "undefined") {
      const sessionToken = Cookies.get("dismusic_session") || null;
      setToken(sessionToken);
      // Exclude /login from auth check
      if (!sessionToken && pathname !== "/login") {
        setUnauthorized(true);
      }
    }
  }, [pathname]);

  const handleLogout = async () => {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3000";
    const sessionToken = Cookies.get("dismusic_session");
    try {
      await fetch(`${backendUrl}/api/logout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {})
        },
        credentials: "include"
      });
      Cookies.remove("dismusic_session", { path: "/" });
      await fetch(`${backendUrl}/api/client-logout-log`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "User logged out and cookie cleared (client+server)" })
      });
    } catch (err) {
      await fetch(`${backendUrl}/api/client-logout-log`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: `[ERROR] Logout failed: ${err}` })
      });
    } finally {
      setTimeout(() => {
        setToken(null);
        setUnauthorized(true);
        router.push("/login");
      }, 3000); // Increased from 500ms to 3000ms for easier error copying
    }
  };

  if (!hasMounted) return null;
  if (unauthorized) {
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
    return null;
  }

  return (
      <div className="h-screen bg-[#0a0a0a] text-white flex flex-col">
        {/* Main Layout */}
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <aside className="w-64 bg-[#121212] border-r border-gray-800 flex flex-col">
            {/* Logo */}
            <div className="p-6 border-b border-gray-800">
              <h1 className="text-xl font-bold text-white">DisMusic</h1>
            </div>

            {/* Navigation */}
            <nav className="flex-1 p-4">
              <div className="space-y-2 mb-8">
                {navigationItems.map((item) => (
                    <Button
                        key={item.path}
                        variant="ghost"
                        className={`w-full justify-start ${
                            pathname === item.path
                                ? "bg-gray-800 text-white hover:bg-gray-700"
                                : "text-gray-300 hover:text-white hover:bg-gray-800"
                        }`}
                        onClick={() => router.push(item.path)}
                    >
                      <item.icon className="w-5 h-5 mr-3" />
                      {item.label}
                    </Button>
                ))}
              </div>

              <div className="mb-8">
                <h3 className="text-sm font-semibold text-gray-400 mb-3 px-3">Library</h3>
                <div className="space-y-2">
                  {libraryItems.map((item) => (
                      <Button
                          key={item.path}
                          variant="ghost"
                          className={`w-full justify-start ${
                              pathname === item.path
                                  ? "bg-gray-800 text-white hover:bg-gray-700"
                                  : "text-gray-300 hover:text-white hover:bg-gray-800"
                          }`}
                          onClick={() => router.push(item.path)}
                      >
                        <item.icon className="w-5 h-5 mr-3" />
                        {item.label}
                      </Button>
                  ))}
                </div>
              </div>

              <div className="mt-auto">
                <Button
                    variant="ghost"
                    className={`w-full justify-start mb-2 ${
                        pathname === "/downloads"
                            ? "bg-gray-800 text-white hover:bg-gray-700"
                            : "text-gray-300 hover:text-white hover:bg-gray-800"
                    }`}
                    onClick={() => router.push("/downloads")}
                >
                  <Download className="w-5 h-5 mr-3" />
                  Downloads
                </Button>
                <Button className="w-full justify-start bg-red-600 hover:bg-red-700 text-white">
                  <Headphones className="w-5 h-5 mr-3" />
                  Devices
                </Button>
              </div>
            </nav>

            {/* User Profile */}
            <div className="p-4 border-t border-gray-800 flex items-center gap-3 relative">
              {userpfpurl ? (
                <img
                  src={userpfpurl}
                  alt={username || "User"}
                  className="w-8 h-8 rounded-full object-cover bg-gray-600"
                  onError={e => { e.currentTarget.src = "/placeholder-user.jpg"; }}
                />
              ) : (
                <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center">
                  <User className="w-4 h-4" />
                </div>
              )}
              <span className="text-sm text-gray-300 truncate max-w-[100px]">{username || "User"}</span>
              <div className="relative ml-auto">
                <Button variant="ghost" size="sm" onClick={() => setShowDropdown(v => !v)}>
                  <Settings className="w-4 h-4" />
                </Button>
                {showDropdown && (
                  <div className="absolute right-0 bottom-12 w-32 bg-gray-900 border border-gray-700 rounded shadow-lg z-50">
                    <div className="flex flex-col gap-1 p-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-400">Version</span>
                        <Badge variant="secondary" className="ml-2" style={{background: 'linear-gradient(90deg, #d4d4d4 0%, #b0b0b0 100%)', color: '#222', border: '1px solid #bbb'}}>
                          {process.env.NEXT_PUBLIC_VERSION}
                        </Badge>
                      </div>
                    </div>
                    <button
                      className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-gray-800"
                      onClick={handleLogout}
                    >
                      Log out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </aside>

          {/* Main Content */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-auto">{children}</div>
          </div>
        </div>

        {/* Bottom Player Bar */}
        <div className="h-20 bg-[#181818] border-t border-gray-800 px-4 flex items-center justify-between">
          {/* Currently Playing */}
          <div className="flex items-center gap-3 w-1/4">
            <div className="w-12 h-12 bg-gray-700 rounded flex items-center justify-center overflow-hidden">
              {currentTrackInfo?.albumCover ? (
                  <img
                      src={currentTrackInfo.albumCover || "/placeholder.svg"}
                      alt={currentTrackInfo.title}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = "none"
                        e.currentTarget.nextElementSibling.style.display = "flex"
                      }}
                  />
              ) : null}
              <div
                  className={`w-full h-full flex items-center justify-center ${currentTrackInfo?.albumCover ? "hidden" : ""}`}
              >
                <Music className="w-5 h-5 text-gray-500" />
              </div>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-white truncate">{currentTrack}</p>
              <p className="text-xs text-gray-400 truncate">{currentTrackInfo?.artist || "Unknown Artist"}</p>
            </div>
            <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
              <Heart className="w-4 h-4" />
            </Button>
          </div>

          {/* Player Controls */}
          <div className="flex flex-col items-center w-1/2">
            <div className="flex items-center gap-4 mb-2">
              <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
                <Shuffle className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
                <SkipBack className="w-5 h-5" />
              </Button>
              <Button
                  onClick={isPlaying ? handlePause : handleResume}
                  disabled={!videoId}
                  className="w-8 h-8 bg-white hover:bg-gray-200 text-black rounded-full flex items-center justify-center"
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
              </Button>
              <Button
                  onClick={handleSkip}
                  disabled={queue.length <= 1}
                  variant="ghost"
                  size="sm"
                  className="text-gray-400 hover:text-white"
              >
                <SkipForward className="w-5 h-5" />
              </Button>
              <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
                <Repeat className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex items-center gap-2 w-full max-w-md">
            <span className="text-xs text-gray-400 w-10 text-right">
              {formatTime(isDragging && dragTime !== null ? dragTime : currentTime)}
            </span>
              <div
                  ref={progressBarRef}
                  className="flex-1 h-2 bg-gray-600 rounded-full overflow-hidden cursor-pointer group relative"
                  onMouseDown={handleProgressMouseDown}
              >
                <div
                    className="h-full bg-white rounded-full transition-colors duration-200 group-hover:bg-green-400"
                    style={{
                      width: duration
                          ? `${((isDragging && dragTime !== null ? dragTime : currentTime) / duration) * 100}%`
                          : "0%",
                    }}
                />
                {isDragging && dragTime !== null && (
                    <div
                        className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-lg"
                        style={{
                          left: `calc(${(dragTime / duration) * 100}% - 6px)`,
                          display: duration ? "block" : "none",
                        }}
                    />
                )}
              </div>
              <span className="text-xs text-gray-400 w-10">{formatTime(duration)}</span>
            </div>
          </div>

          {/* Volume and Additional Controls */}
          <div className="flex items-center gap-3 w-1/4 justify-end">
            <Volume2 className="w-4 h-4 text-gray-400" />
            <Slider value={volume} onValueChange={handleVolumeSliderChange} max={100} step={1} className="w-24" />
          </div>
        </div>
      </div>
  )
}
