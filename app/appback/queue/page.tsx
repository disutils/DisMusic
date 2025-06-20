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

export default function QueuePage() {
  const [query, setQuery] = useState("")
  const [queuePage, setQueuePage] = useState(0)
  const PAGE_SIZE = 8

  const { queue, isPlaying, loading, error, handlePlay, handlePause, handleResume, setQueue } = useMusic()

  const totalPages = Math.ceil(queue.length / PAGE_SIZE)
  const pagedQueue = queue.slice(queuePage * PAGE_SIZE, (queuePage + 1) * PAGE_SIZE)
  const currentTrack = queue[0]

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (query && !loading) {
      handlePlay(query)
    }
  }

  return (
      <div className="flex flex-col h-full">
        {/* Header */}
        <header className="p-6 border-b border-gray-800 bg-[#121212]">
          <form onSubmit={handleSubmit} className="flex items-center gap-4">
            <Button type="button" variant="ghost" size="sm" className="text-gray-400">
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <div className="flex-1 max-w-md">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                    type="text"
                    placeholder="Search tracks..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="pl-10 bg-[#2a2a2a] border-gray-700 text-white placeholder:text-gray-400"
                />
              </div>
            </div>
            <Button type="submit" disabled={loading || !query} className="bg-green-600 hover:bg-green-700 text-white">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            </Button>
          </form>
          {error && (
              <div className="mt-4 p-3 bg-red-900/50 border border-red-700 rounded-lg">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
          )}
        </header>

        {/* Now Playing Section */}
        {queue.length > 0 && currentTrack && (
            <div className="p-6 bg-gradient-to-r from-[#1a1a1a] to-[#2a2a2a] border-b border-gray-800">
              <div className="flex items-center gap-6">
                <div className="w-48 h-48 bg-gray-800 rounded-lg flex items-center justify-center overflow-hidden">
                  {currentTrack.albumCover ? (
                      <img src={currentTrack.albumCover} alt={currentTrack.title} className="w-48 h-48 object-cover rounded-lg" />
                  ) : (
                      <Music className="w-16 h-16 text-gray-600" />
                  )}
                </div>
                <div className="flex-1">
                  <h2 className="text-3xl font-bold text-white mb-2">{currentTrack.title}</h2>
                  <p className="text-gray-400 mb-4">Unknown Artist</p>
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
        <div className="flex-1 overflow-auto">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white">Queue</h3>
            </div>

            {/* Table Header */}
            <div className="grid grid-cols-12 gap-4 px-4 py-2 text-sm text-gray-400 border-b border-gray-800 mb-2">
              <div className="col-span-1">#</div>
              <div className="col-span-6">Title</div>
              <div className="col-span-3">Album</div>
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
              {pagedQueue.map((item, i) => (
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
                    <div className="col-span-6 flex items-center gap-3">
                      <div className="w-10 h-10 bg-gray-700 rounded flex items-center justify-center overflow-hidden">
                        {item.albumCover ? (
                            <img src={item.albumCover} alt={item.title} className="w-10 h-10 object-cover rounded" />
                        ) : (
                            <Music className="w-4 h-4 text-gray-500" />
                        )}
                      </div>
                      <div>
                        <p className={`font-medium ${i + queuePage * PAGE_SIZE === 0 ? "text-green-400" : "text-white"}`}>
                          {item.title}
                        </p>
                        <p className="text-sm text-gray-400">Unknown Artist</p>
                      </div>
                    </div>
                    <div className="col-span-3 flex items-center text-gray-400">Unknown Album</div>
                    <div className="col-span-2 flex items-center justify-between">
                      <span className="text-gray-400">3:21</span>
                      <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
              ))}
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
      </div>
  )
}