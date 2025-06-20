import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Plus, Play } from "lucide-react"

const featuredPlaylists = [
  { id: 1, name: "Today's Top Hits", description: "The most played songs right now", tracks: 50, image: "🎵" },
  { id: 2, name: "Chill Vibes", description: "Relax and unwind with these tracks", tracks: 75, image: "🌙" },
  { id: 3, name: "Workout Beats", description: "High energy music for your workout", tracks: 40, image: "💪" },
  { id: 4, name: "Indie Rock", description: "The best of indie rock music", tracks: 60, image: "🎸" },
  { id: 5, name: "Electronic Dreams", description: "Electronic music for every mood", tracks: 85, image: "🎛️" },
  { id: 6, name: "Jazz Classics", description: "Timeless jazz standards", tracks: 45, image: "🎺" },
  { id: 7, name: "90s Nostalgia", description: "The best hits from the 90s", tracks: 55, image: "📻" },
  { id: 8, name: "Study Focus", description: "Instrumental music for concentration", tracks: 30, image: "📚" },
  { id: 9, name: "Road Trip", description: "Perfect songs for long drives", tracks: 65, image: "🚗" },
  { id: 10, name: "Party Mix", description: "Get the party started", tracks: 80, image: "🎉" },
]

export default function PlaylistsPage() {
  return (
    <div className="p-6 h-full overflow-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white">Your Playlists</h2>
        <Button className="bg-green-600 hover:bg-green-700">
          <Plus className="w-4 h-4 mr-2" />
          Create Playlist
        </Button>
      </div>

      <div className="grid grid-cols-5 gap-6">
        {featuredPlaylists.map((playlist) => (
          <Card
            key={playlist.id}
            className="bg-[#1a1a1a] border-gray-800 hover:bg-[#2a2a2a] transition-colors cursor-pointer group"
          >
            <CardContent className="p-4">
              <div className="relative">
                <div className="w-full aspect-square bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg mb-4 flex items-center justify-center text-4xl">
                  {playlist.image}
                </div>
                <Button className="absolute bottom-2 right-2 w-12 h-12 bg-green-600 hover:bg-green-700 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                  <Play className="w-5 h-5" />
                </Button>
              </div>
              <h4 className="font-semibold text-white mb-1 truncate">{playlist.name}</h4>
              <p className="text-sm text-gray-400 line-clamp-2">{playlist.description}</p>
              <p className="text-xs text-gray-500 mt-2">{playlist.tracks} songs</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
