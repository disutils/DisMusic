import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Play } from "lucide-react"

const topArtists = [
  { id: 1, name: "The Weeknd", followers: "85.2M", image: "👨‍🎤", genre: "Pop" },
  { id: 2, name: "Billie Eilish", followers: "72.1M", image: "👩‍🎤", genre: "Alternative" },
  { id: 3, name: "Drake", followers: "68.9M", image: "🎤", genre: "Hip-Hop" },
  { id: 4, name: "Taylor Swift", followers: "91.3M", image: "👸", genre: "Pop" },
  { id: 5, name: "Ed Sheeran", followers: "64.5M", image: "🎸", genre: "Pop" },
  { id: 6, name: "Ariana Grande", followers: "78.2M", image: "👩‍🎤", genre: "Pop" },
  { id: 7, name: "Post Malone", followers: "55.8M", image: "🎭", genre: "Hip-Hop" },
  { id: 8, name: "Dua Lipa", followers: "67.4M", image: "💃", genre: "Pop" },
  { id: 9, name: "Justin Bieber", followers: "71.9M", image: "🎤", genre: "Pop" },
  { id: 10, name: "Olivia Rodrigo", followers: "45.3M", image: "🌟", genre: "Pop" },
  { id: 11, name: "Bad Bunny", followers: "62.1M", image: "🐰", genre: "Reggaeton" },
  { id: 12, name: "Harry Styles", followers: "58.7M", image: "🎩", genre: "Pop Rock" },
]

export default function ArtistsPage() {
  return (
    <div className="p-6 h-full overflow-auto">
      <h2 className="text-2xl font-bold text-white mb-6">Artists</h2>

      <div className="grid grid-cols-6 gap-6">
        {topArtists.map((artist) => (
          <Card
            key={artist.id}
            className="bg-[#1a1a1a] border-gray-800 hover:bg-[#2a2a2a] transition-colors cursor-pointer group"
          >
            <CardContent className="p-4 text-center">
              <div className="relative">
                <div className="w-full aspect-square bg-gradient-to-br from-blue-500 to-purple-500 rounded-full mb-4 flex items-center justify-center text-4xl">
                  {artist.image}
                </div>
                <Button className="absolute bottom-2 right-2 w-12 h-12 bg-green-600 hover:bg-green-700 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                  <Play className="w-5 h-5" />
                </Button>
              </div>
              <h4 className="font-semibold text-white mb-1">{artist.name}</h4>
              <p className="text-sm text-gray-400">{artist.genre}</p>
              <p className="text-xs text-gray-500 mt-1">{artist.followers} followers</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
