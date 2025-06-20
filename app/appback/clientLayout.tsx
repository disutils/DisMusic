"use client"

import type React from "react"

import { usePathname, useRouter } from "next/navigation"
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
import { MusicProvider, useMusic } from "./context/MusicContext"

function ClientLayoutContent({ children }: { children: React.ReactNode }) {
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
  } = useMusic()

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const currentTrack = queue[0] || null

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
                                ? "bg-gray-800 text-white"
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
                                  ? "bg-gray-800 text-white"
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
                            ? "bg-gray-800 text-white"
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
            <div className="p-4 border-t border-gray-800 flex items-center gap-3">
              <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center">
                <User className="w-4 h-4" />
              </div>
              <span className="text-sm text-gray-300">User</span>
              <Button variant="ghost" size="sm" className="ml-auto">
                <Settings className="w-4 h-4" />
              </Button>
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
            <div className="w-12 h-12 bg-gray-700 rounded flex items-center justify-center">
              <Music className="w-5 h-5 text-gray-500" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {currentTrack && typeof currentTrack === "object" && "title" in currentTrack
                    ? currentTrack.title
                    : "No track selected"}
              </p>
              <p className="text-xs text-gray-400 truncate">Unknown Artist</p>
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
              <span className="text-xs text-gray-400 w-10 text-right">{formatTime(currentTime)}</span>
              <div className="flex-1 h-1 bg-gray-600 rounded-full overflow-hidden">
                <div
                    className="h-full bg-white rounded-full transition-all duration-1000"
                    style={{ width: duration ? `${(currentTime / duration) * 100}%` : "0%" }}
                />
              </div>
              <span className="text-xs text-gray-400 w-10">{formatTime(duration)}</span>
            </div>
          </div>

          {/* Volume and Additional Controls */}
          <div className="flex items-center gap-3 w-1/4 justify-end">
            <Volume2 className="w-4 h-4 text-gray-400" />
            <Slider value={volume} onValueChange={handleVolumeChange} max={100} step={1} className="w-24" />
          </div>
        </div>
      </div>
  )
}

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
      <html lang="en">
      <body>
      <MusicProvider>
        <ClientLayoutContent>{children}</ClientLayoutContent>
      </MusicProvider>
      </body>
      </html>
  )
}