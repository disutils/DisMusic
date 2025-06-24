"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Play,
  Pause,
  Plus,
  Shuffle,
  Heart,
  Music,
  MoreHorizontal,
} from "lucide-react"
import { useMusic } from "../context/MusicContext"

// Helper function to safely get track information
const getTrackInfo = (item: any) => {
  if (typeof item === "string") {
    return {
      title: item,
      artist: "Unknown Artist",
      album: "Unknown Album",
      duration: "3:21",
      albumCover: null,
    }
  }
  if (item && typeof item === "object") {
    let durationSeconds = undefined;
    if (typeof item.duration === "number") {
      durationSeconds = item.duration;
    } else if (typeof item.duration_ms === "number") {
      durationSeconds = Math.round(item.duration_ms / 1000);
    } else if (typeof item.durationSeconds === "number") {
      durationSeconds = item.durationSeconds;
    }
    if (durationSeconds === undefined && item.track && typeof item.track.duration_ms === "number") {
      durationSeconds = Math.round(item.track.duration_ms / 1000);
    }
    if (durationSeconds === undefined && typeof item.duration === "string") {
      const parts = item.duration.split(":");
      if (parts.length === 2 && !isNaN(Number(parts[0])) && !isNaN(Number(parts[1]))) {
        durationSeconds = Number(parts[0]) * 60 + Number(parts[1]);
      }
    }
    return {
      title: item.title || item.name || (item.track && (item.track.title || item.track.name)) || "Unknown Track",
      artist: item.artist ?? (item.artists && item.artists[0]?.name) ?? (item.track && item.track.artists && item.track.artists[0]?.name) ?? "Unknown Artist",
      album: item.album || (item.album?.name) || (item.track && (item.track.album?.name || item.track.album)) || "Unknown Album",
      duration: typeof durationSeconds === "number" && !isNaN(durationSeconds) && durationSeconds > 0 ? formatTime(durationSeconds) : (typeof item.duration === "string" ? item.duration : (item.duration_ms ? formatTime(Math.round(item.duration_ms / 1000)) : "-")),
      albumCover: item.albumCover || item.image || (item.album?.images?.[0]?.url) || (item.track && (item.track.albumCover || (item.track.album?.images?.[0]?.url))) || null,
    }
  }
  return {
    title: "Unknown Track",
    artist: "Unknown Artist",
    album: "Unknown Album",
    duration: "3:21",
    albumCover: null,
  }
}

// Helper to format seconds to mm:ss
function formatTime(seconds = 0) {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, "0")}`
}

export default function QueuePage() {
  const [query, setQuery] = useState("")
  const [queuePage, setQueuePage] = useState(0)
  const PAGE_SIZE = 8

  const { queue, isPlaying, loading, error, handlePlay, handlePause, handleResume, setQueue } = useMusic()

  const totalPages = Math.ceil(queue.length / PAGE_SIZE)
  const pagedQueue = queue.slice(queuePage * PAGE_SIZE, (queuePage + 1) * PAGE_SIZE)

  // Update the currentTrack assignment
  const currentTrack = queue.length > 0 ? getTrackInfo(queue[0]).title : "No track selected"
  const currentTrackInfo = queue.length > 0 ? getTrackInfo(queue[0]) : null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (query && !loading) {
      handlePlay(query)
    }
  }

  return (
      <div className="h-full overflow-auto">
        {/* Header */}
        <div className="p-6">
          <div className="max-w-2xl mb-8">
            <form onSubmit={handleSubmit} className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <Input
                    type="text"
                    placeholder="Insert Spotify URL or YT URL, or search for a track..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="pl-12 h-12 bg-[#2a2a2a] border-gray-700 text-white placeholder:text-gray-400 text-lg"
                />
                {loading && <Loader2 className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 animate-spin" />}
              </div>
              <Button type="submit" disabled={loading || !query} className="h-12 px-6 bg-green-600 hover:bg-green-700 text-white">
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
              </Button>
            </form>
            {error && (
                <div className="mt-4 p-3 bg-red-900/50 border border-red-700 rounded-lg">
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
            )}
          </div>
        </div>

        {/* Now Playing Section */}
        {queue.length > 0 && (
            <div className="p-6 bg-gradient-to-r from-[#1a1a1a] to-[#2a2a2a] border-b border-gray-800">
              <div className="flex items-center gap-6">
                <div className="w-48 h-48 bg-gray-800 rounded-lg flex items-center justify-center overflow-hidden">
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
                    <Music className="w-16 h-16 text-gray-600" />
                  </div>
                </div>
                <div className="flex-1">
                  <h2 className="text-3xl font-bold text-white mb-2">{currentTrackInfo?.title || currentTrack}</h2>
                  <p className="text-gray-400 mb-4">{currentTrackInfo?.artist || "Unknown Artist"}</p>
                  <div className="flex items-center gap-4">
                    <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
                      <Shuffle className="w-4 h-4" />
                    </Button>
                    <Button
                        onClick={() => query && setQueue([...queue, query])}
                        variant="ghost"
                        size="sm"
                        className="text-gray-400 hover:text-white"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Queue
                    </Button>
                    <Button
                        onClick={isPlaying ? handlePause : handleResume}
                        variant="ghost"
                        size="sm"
                        className="text-gray-400 hover:text-white"
                    >
                      {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    </Button>
                    <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
                      <Heart className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
        )}

        {/* Track List */}
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-white">Queue</h3>
          </div>

          {/* Table Header */}
          <div className="grid grid-cols-12 gap-4 px-4 py-2 text-sm text-gray-400 border-b border-gray-800 mb-2">
            <div className="col-span-1">#</div>
            <div className="col-span-5">Title</div>
            <div className="col-span-4">Artist</div>
            <div className="col-span-2">Duration</div>
          </div>

          {/* Track Rows */}
          <div className="space-y-1">
            {pagedQueue.length === 0 && (
                <div className="text-center py-12 text-gray-400">
                  <Music className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No tracks in queue</p>
                </div>
            )}
            {pagedQueue.map((item, i) => {
              const trackInfo = getTrackInfo(item)
              let duration = trackInfo.duration;
              // For the first row (currently playing), use the player duration from context
              if (i + queuePage * PAGE_SIZE === 0 && typeof currentTrackInfo?.duration === "number") {
                duration = formatTime(currentTrackInfo.duration);
              } else if (i + queuePage * PAGE_SIZE === 0 && typeof currentTrackInfo?.duration === "string") {
                duration = currentTrackInfo.duration;
              }
              // Debug logs turn on if needed. only used for loggin the dang duration :sob:
              // console.log('Row', i + queuePage * PAGE_SIZE, {
              //   duration,
              //   trackInfo,
              //   currentTrackInfo,
              //   item
              // });
              return (
                  <div
                      key={i + queuePage * PAGE_SIZE}
                      className={`grid grid-cols-12 gap-4 px-4 py-3 rounded-lg hover:bg-[#2a2a2a] group ${
                          i + queuePage * PAGE_SIZE === 0 ? "bg-[#2a2a2a]" : ""
                      }`}
                  >
                    <div className="col-span-1 flex items-center">
                      {i + queuePage * PAGE_SIZE === 0 && isPlaying ? (
                          <div className="w-4 h-4 flex items-center justify-center">
                            <div className="w-1 h-3 bg-green-500 animate-pulse mr-0.5"></div>
                            <div className="w-1 h-2 bg-green-500 animate-pulse mr-0.5"></div>
                            <div className="w-1 h-4 bg-green-500 animate-pulse"></div>
                          </div>
                      ) : (
                          <span className="text-gray-400">{i + queuePage * PAGE_SIZE + 1}</span>
                      )}
                    </div>
                    <div className="col-span-5 flex items-center gap-3">
                      <div className="w-10 h-10 bg-gray-700 rounded flex items-center justify-center overflow-hidden">
                        {trackInfo.albumCover ? (
                            <img
                                src={trackInfo.albumCover || "/placeholder.svg"}
                                alt={trackInfo.title}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  e.currentTarget.style.display = "none"
                                  e.currentTarget.nextElementSibling.style.display = "flex"
                                }}
                            />
                        ) : null}
                        <div
                            className={`w-full h-full flex items-center justify-center ${trackInfo.albumCover ? "hidden" : ""}`}
                        >
                          <Music className="w-4 h-4 text-gray-500" />
                        </div>
                      </div>
                      <div>
                        <p className={`font-medium ${i + queuePage * PAGE_SIZE === 0 ? "text-green-400" : "text-white"}`}>
                          {trackInfo.title}
                        </p>
                        <p className="text-sm text-gray-400">{trackInfo.artist}</p>
                      </div>
                    </div>
                    <div className="col-span-4 flex items-center text-gray-400">{trackInfo.artist}</div>
                    <div className="col-span-2 flex items-center justify-between">
                      <span className="text-gray-400">{duration}</span>
                      <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
              )
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
              <div className="flex justify-center items-center gap-4 mt-8">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setQueuePage((p) => Math.max(0, p - 1))}
                    disabled={queuePage === 0}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-sm text-gray-400">
              {queuePage + 1} / {totalPages}
            </span>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setQueuePage((p) => Math.min(totalPages - 1, p + 1))}
                    disabled={queuePage >= totalPages - 1}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
          )}
        </div>
      </div>
  )
}