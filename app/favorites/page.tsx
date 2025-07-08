"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Play,
  Pause,
  Shuffle,
  Music,
  MoreHorizontal,
  Heart,
  Grid,
  List,
  Clock,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { useMusic } from "../context/MusicContext"

// Helper to format seconds to mm:ss
function formatTime(seconds = 0) {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, "0")}`
}

export default function FavoritesPage() {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [page, setPage] = useState(0)
  const PAGE_SIZE = viewMode === "grid" ? 12 : 8

  const { favorites, isFavorited, toggleFavorite, handlePlay, isPlaying, socket } = useMusic()

  const totalPages = Math.ceil(favorites.length / PAGE_SIZE)
  const pagedFavorites = favorites.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  // Play all favorites as a playlist
  const playAllFavorites = () => {
    if (favorites.length > 0 && socket) {
      const firstTrack = favorites[0];
      socket.emit("play", {
        query: firstTrack.youtubeUrl || `${firstTrack.name} ${firstTrack.artist}`
      });
      // Add remaining tracks to queue with a delay between each emit
      favorites.slice(1).forEach((track, idx) => {
        setTimeout(() => {
          socket.emit("addToQueue", {
            query: track.youtubeUrl || `${track.name} ${track.artist}`
          });
        }, 150 * idx);
      });
    }
  }

  // Play shuffled favorites
  const shuffleFavorites = () => {
    if (favorites.length > 0 && socket) {
      const shuffledFavorites = [...favorites].sort(() => Math.random() - 0.5);
      const firstTrack = shuffledFavorites[0];
      socket.emit("play", {
        query: firstTrack.youtubeUrl || `${firstTrack.name} ${firstTrack.artist}`
      });
      // Add remaining shuffled tracks to queue with a delay between each emit
      shuffledFavorites.slice(1).forEach((track, idx) => {
        setTimeout(() => {
          socket.emit("addToQueue", {
            query: track.youtubeUrl || `${track.name} ${track.artist}`
          });
        }, 150 * idx);
      });
    }
  }

  return (
    <div className="h-full overflow-auto">
      {/* Header Section */}
      <div className="p-6 md:p-8 bg-gradient-to-b from-[#1a1a1a] to-transparent">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-white">Favorites</h1>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className={`w-9 h-9 ${viewMode === "grid" ? "text-white" : "text-gray-400"}`}
              onClick={() => setViewMode("grid")}
            >
              <Grid className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={`w-9 h-9 ${viewMode === "list" ? "text-white" : "text-gray-400"}`}
              onClick={() => setViewMode("list")}
            >
              <List className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 mb-8">
          <Button
            onClick={playAllFavorites}
            className="bg-green-600 hover:bg-green-700 text-white"
            disabled={favorites.length === 0}
          >
            <Play className="w-4 h-4 mr-2" />
            Play All
          </Button>
          <Button
            onClick={shuffleFavorites}
            variant="outline"
            className="border-[#535353] bg-[#282828] text-white hover:bg-[#383838] hover:border-[#646464]"
            disabled={favorites.length === 0}
          >
            <Shuffle className="w-4 h-4 mr-2" />
            Shuffle
          </Button>
        </div>
      </div>

      {/* Grid View */}
      {viewMode === "grid" && (
        <div className="px-6 md:px-8">
          {favorites.length === 0 ? (
            <div className="text-center py-12">
              <Heart className="w-12 h-12 mx-auto mb-4 text-gray-500" />
              <p className="text-gray-400">No favorite tracks yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {pagedFavorites.map((track, i) => (
                <div
                  key={i}
                  className="bg-[#2a2a2a] rounded-lg p-4 hover:bg-[#333333] transition-colors group"
                >
                  <div className="aspect-square mb-4 bg-black/20 rounded-md relative overflow-hidden">
                    {track.albumCover ? (
                      <img
                        src={track.albumCover}
                        alt={track.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Music className="w-12 h-12 text-gray-600" />
                      </div>
                    )}
                    <Button
                      onClick={() => handlePlay(track.youtubeUrl || `${track.name} ${track.artist}`)}
                      className="absolute bottom-2 right-2 w-10 h-10 rounded-full bg-green-600 hover:bg-green-700 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Play className="w-5 h-5" />
                    </Button>
                  </div>
                  <h3 className="font-medium text-white mb-1 truncate">{track.name}</h3>
                  <p className="text-sm text-gray-400 truncate">{track.artist}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* List View */}
      {viewMode === "list" && (
        <div className="px-6 md:px-8">
          {favorites.length === 0 ? (
            <div className="text-center py-12">
              <Heart className="w-12 h-12 mx-auto mb-4 text-gray-500" />
              <p className="text-gray-400">No favorite tracks yet</p>
            </div>
          ) : (
            <div className="space-y-1">
              {/* Table Header */}
              <div className="grid grid-cols-12 gap-4 px-4 py-2 text-sm text-gray-400 border-b border-gray-800">
                <div className="col-span-6">Title</div>
                <div className="col-span-4">Artist</div>
                <div className="col-span-2 flex items-center">
                  <Clock className="w-4 h-4" />
                </div>
              </div>

              {/* Track Rows */}
              {pagedFavorites.map((track, i) => (
                <div
                  key={i}
                  className="grid grid-cols-12 gap-4 px-4 py-3 rounded-lg hover:bg-[#2a2a2a] group"
                >
                  <div className="col-span-6 flex items-center gap-3">
                    <div className="w-10 h-10 bg-black/20 rounded flex items-center justify-center overflow-hidden">
                      {track.albumCover ? (
                        <img
                          src={track.albumCover}
                          alt={track.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Music className="w-4 h-4 text-gray-500" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-white">{track.name}</p>
                      <p className="text-sm text-gray-400">{track.artist}</p>
                    </div>
                  </div>
                  <div className="col-span-4 flex items-center text-gray-400">
                    {track.artist}
                  </div>
                  <div className="col-span-2 flex items-center justify-between">
                    <span className="text-gray-400">{track.duration || "-"}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="opacity-0 group-hover:opacity-100"
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
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
            {page + 1} / {totalPages}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="h-8 w-8 p-0"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  )
}
