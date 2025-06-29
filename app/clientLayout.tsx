"use client"

import type React from "react"
import Cookies from "js-cookie"

import { usePathname, useRouter } from "next/navigation"
import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import {
  Slider as SliderPrimitive,
  SliderTrack,
  SliderRange,
  SliderThumb,
} from "@/components/ui/slider"
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
  Menu,
  X,
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
    if (!duration || !progressBarRef.current) return;

    const rect = progressBarRef.current.getBoundingClientRect();
    const relativeX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const percentage = relativeX / rect.width;
    const newTime = percentage * duration;

    if (window.ytPlayer && typeof window.ytPlayer.seekTo === 'function') {
        window.ytPlayer.seekTo(newTime, true);
        setCurrentTime(newTime);
    }
};

const handleProgressMouseMove = (e: MouseEvent) => {
    if (!isDragging || !duration || !progressBarRef.current) return;

    const rect = progressBarRef.current.getBoundingClientRect();
    const relativeX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const percentage = relativeX / rect.width;
    const newTime = percentage * duration;

    if (window.ytPlayer && typeof window.ytPlayer.seekTo === 'function') {
        window.ytPlayer.seekTo(newTime, true);
        setCurrentTime(newTime);
    }
};

const handleProgressMouseUp = () => {
    setIsDragging(false);
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
        {/* Mobile Header - Only visible on mobile devices */}
        <div className="md:hidden flex items-center justify-between px-4 py-3 bg-[#121212] border-b border-gray-800">
          <Button
              variant="ghost"
              size="sm"
              className="p-1 text-white"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </Button>
          <h1 className="text-lg font-bold text-white">DisMusic</h1>
          <div className="w-8"></div> {/* Spacer for alignment */}
        </div>

        {/* Main Layout */}
        <div className="flex flex-1 overflow-hidden">
          {/* Mobile Sidebar Backdrop */}
          {mobileMenuOpen && (
              <div
                  className="md:hidden fixed inset-0 bg-black bg-opacity-70 z-40"
                  onClick={() => setMobileMenuOpen(false)}
              />
          )}

          {/* Sidebar - Desktop: always visible, Mobile: conditionally visible */}
          <aside
              className={`bg-[#121212] border-r border-gray-800 flex-col md:flex
                      fixed md:static inset-y-0 left-0 z-50 md:z-0 
                      transition-transform duration-300 ease-in-out
                      w-[260px] md:w-64
                      ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}
          >
            {/* Logo - Only visible on desktop since we have the mobile header */}
            <div className="p-6 border-b border-gray-800 hidden md:block">
              <h1 className="text-xl font-bold text-white">DisMusic</h1>
            </div>

            {/* Close button for mobile - Top right */}
            <button
                onClick={() => setMobileMenuOpen(false)}
                className="absolute top-3 right-3 text-gray-400 md:hidden"
            >
              <X className="h-6 w-6" />
            </button>

            {/* Navigation */}
            <nav className="flex-1 p-4 overflow-y-auto">
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
                        onClick={() => {
                          router.push(item.path);
                          if (mobileMenuOpen) setMobileMenuOpen(false);
                        }}
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
                          onClick={() => {
                            router.push(item.path);
                            if (mobileMenuOpen) setMobileMenuOpen(false);
                          }}
                      >
                        <item.icon className="w-5 h-5 mr-3" />
                        {item.label}
                      </Button>
                  ))}
                  <Button
                      variant="ghost"
                      className={`w-full justify-start ${
                          pathname === "/favorites"
                              ? "bg-gray-800 text-white hover:bg-gray-700"
                              : "text-gray-300 hover:text-white hover:bg-gray-800"
                      }`}
                      onClick={() => {
                        router.push("/favorites");
                        if (mobileMenuOpen) setMobileMenuOpen(false);
                      }}
                  >
                    <Heart className="w-5 h-5 mr-3" />
                    Favorites
                  </Button>
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
                    onClick={() => {
                      router.push("/downloads");
                      if (mobileMenuOpen) setMobileMenuOpen(false);
                    }}
                >
                  <Download className="w-5 h-5 mr-3" />
                  Downloads
                </Button>
                <Button
                    className="w-full justify-start bg-red-600 hover:bg-red-700 text-white"
                    onClick={() => {
                      if (mobileMenuOpen) setMobileMenuOpen(false);
                    }}
                >
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
            <div className="flex-1 overflow-auto pt-0 md:pt-0">{children}</div>
          </div>
        </div>

        {/* Bottom Player Bar */}
        <div className="hidden md:flex h-20 bg-[#181818] border-t border-gray-800 px-4 items-center justify-between">
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
            <Slider
              value={[volume]}
              onValueChange={handleVolumeSliderChange}
              max={100}
              step={1}
              className="w-24"
            />
          </div>
        </div>

        {/* Mobile Player - Only visible on mobile devices */}
        <div className="block md:hidden fixed bottom-0 left-0 right-0 bg-gradient-to-b from-[#181818] to-[#121212] border-t border-gray-800 px-2 pt-1.5 pb-2 z-50">
          {/* Mobile Track Info */}
          <div className="flex items-center">
            <div className="w-10 h-10 bg-gray-700 rounded-md flex items-center justify-center overflow-hidden">
              {currentTrackInfo?.albumCover ? (
                  <img
                      src={currentTrackInfo.albumCover || "/placeholder.svg"}
                      alt={currentTrackInfo.title}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = "none"
                        if (e.currentTarget.nextElementSibling) e.currentTarget.nextElementSibling.style.display = "flex"
                      }}
                  />
              ) : null}
              <div className={`w-full h-full flex items-center justify-center ${currentTrackInfo?.albumCover ? "hidden" : ""}`}>
                <Music className="w-4 h-4 text-gray-500" />
              </div>
            </div>
            <div className="ml-2 flex-1 min-w-0">
              <p className="text-xs font-medium text-white truncate">{currentTrack}</p>
              <p className="text-[10px] text-gray-400 truncate">{currentTrackInfo?.artist || "Unknown Artist"}</p>
            </div>
            <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white ml-2 p-0 h-7 w-7">
              <Heart className="w-4 h-4" />
            </Button>
          </div>

          {/* Mobile Progress Bar */}
          <div className="mt-1.5">
            <div
                ref={progressBarRef}
                className="h-1 bg-gray-700 rounded-full overflow-hidden cursor-pointer relative"
                onMouseDown={handleProgressMouseDown}
            >
              <div
                  className="h-full bg-green-500 rounded-full"
                  style={{ width: `${((isDragging && dragTime !== null ? dragTime : currentTime) / duration) * 100}%` }}
              />
            </div>
            <div className="flex justify-between mt-0.5">
              <span className="text-[9px] text-gray-500">{formatTime(isDragging && dragTime !== null ? dragTime : currentTime)}</span>
              <span className="text-[9px] text-gray-500">{formatTime(duration)}</span>
            </div>
          </div>

          {/* Mobile Controls */}
          <div className="flex items-center justify-center gap-5 mt-1.5">
            <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white p-0 h-8 w-8">
              <SkipBack className="w-5 h-5" />
            </Button>
            <Button
                onClick={isPlaying ? handlePause : handleResume}
                disabled={!videoId}
                className="w-9 h-9 bg-white hover:bg-gray-200 text-black rounded-full flex items-center justify-center"
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
            </Button>
            <Button
                onClick={handleSkip}
                disabled={queue.length <= 1}
                variant="ghost"
                size="sm"
                className="text-gray-400 hover:text-white p-0 h-8 w-8"
            >
              <SkipForward className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Mobile player spacer - prevents content from being hidden behind fixed player */}
        <div className="block md:hidden h-28"></div>
      </div>
  )
}
