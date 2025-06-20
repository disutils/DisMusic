import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Play } from "lucide-react"

const topAlbums = [
  { id: 1, name: "After Hours", artist: "The Weeknd", year: 2020, image: "🌃", genre: "Pop" },
  { id: 2, name: "Happier Than Ever", artist: "Billie Eilish", year: 2021, image: "😊", genre: "Alternative" },
  { id: 3, name: "Certified Lover Boy", artist: "Drake", year: 2021, image: "💕", genre: "Hip-Hop" },
  { id: 4, name: "Folklore", artist: "Taylor Swift", year: 2020, image: "🌲", genre: "Indie Folk" },
  { id: 5, name: "÷ (Divide)", artist: "Ed Sheeran", year: 2017, image: "➗", genre: "Pop" },
  { id: 6, name: "Positions", artist: "Ariana Grande", year: 2020, image: "💫", genre: "Pop" },
  { id: 7, name: "Hollywood's Bleeding", artist: "Post Malone", year: 2019, image: "🩸", genre: "Hip-Hop" },
  { id: 8, name: "Future Nostalgia", artist: "Dua Lipa", year: 2020, image: "🔮", genre: "Pop" },
  { id: 9, name: "Justice", artist: "Justin Bieber", year: 2021, image: "⚖️", genre: "Pop" },
  { id: 10, name: "SOUR", artist: "Olivia Rodrigo", year: 2021, image: "🍋", genre: "Pop" },
  { id: 11, name: "El Último Tour Del Mundo", artist: "Bad Bunny", year: 2020, image: "🌍", genre: "Reggaeton" },
  { id: 12, name: "Fine Line", artist: "Harry Styles", year: 2019, image: "🎨", genre: "Pop Rock" },
  { id: 13, name: "When We All Fall Asleep", artist: "Billie Eilish", year: 2019, image: "😴", genre: "Alternative" },
  { id: 14, name: "Scorpion", artist: "Drake", year: 2018, image: "🦂", genre: "Hip-Hop" },
  { id: 15, name: "Lover", artist: "Taylor Swift", year: 2019, image: "💖", genre: "Pop" },
]

export default function AlbumsPage() {
  return (
    <div className="p-6 h-full overflow-auto">
      <h2 className="text-2xl font-bold text-white mb-6">Albums</h2>

      <div className="grid grid-cols-5 gap-6">
        {topAlbums.map((album) => (
          <Card
            key={album.id}
            className="bg-[#1a1a1a] border-gray-800 hover:bg-[#2a2a2a] transition-colors cursor-pointer group"
          >
            <CardContent className="p-4">
              <div className="relative">
                <div className="w-full aspect-square bg-gradient-to-br from-orange-500 to-red-500 rounded-lg mb-4 flex items-center justify-center text-4xl">
                  {album.image}
                </div>
                <Button className="absolute bottom-2 right-2 w-12 h-12 bg-green-600 hover:bg-green-700 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                  <Play className="w-5 h-5" />
                </Button>
              </div>
              <h4 className="font-semibold text-white mb-1 truncate">{album.name}</h4>
              <p className="text-sm text-gray-400">{album.artist}</p>
              <p className="text-xs text-gray-500 mt-1">
                {album.year} • {album.genre}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
