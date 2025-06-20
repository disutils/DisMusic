import { Card, CardContent } from "@/components/ui/card"

const featuredPlaylists = [
  { id: 1, name: "Today's Top Hits", description: "The most played songs right now", tracks: 50, image: "🎵" },
  { id: 2, name: "Chill Vibes", description: "Relax and unwind with these tracks", tracks: 75, image: "🌙" },
  { id: 3, name: "Workout Beats", description: "High energy music for your workout", tracks: 40, image: "💪" },
  { id: 4, name: "Indie Rock", description: "The best of indie rock music", tracks: 60, image: "🎸" },
  { id: 5, name: "Electronic Dreams", description: "Electronic music for every mood", tracks: 85, image: "🎛️" },
  { id: 6, name: "Jazz Classics", description: "Timeless jazz standards", tracks: 45, image: "🎺" },
]

const topAlbums = [
  { id: 1, name: "After Hours", artist: "The Weeknd", year: 2020, image: "🌃", genre: "Pop" },
  { id: 2, name: "Happier Than Ever", artist: "Billie Eilish", year: 2021, image: "😊", genre: "Alternative" },
  { id: 3, name: "Certified Lover Boy", artist: "Drake", year: 2021, image: "💕", genre: "Hip-Hop" },
  { id: 4, name: "Folklore", artist: "Taylor Swift", year: 2020, image: "🌲", genre: "Indie Folk" },
  { id: 5, name: "÷ (Divide)", artist: "Ed Sheeran", year: 2017, image: "➗", genre: "Pop" },
  { id: 6, name: "Positions", artist: "Ariana Grande", year: 2020, image: "💫", genre: "Pop" },
]

export default function BrowsePage() {
  return (
    <div className="p-6 space-y-8 h-full overflow-auto">
      <div>
        <h2 className="text-2xl font-bold text-white mb-6">Good evening</h2>
        <div className="grid grid-cols-3 gap-4 mb-8">
          {featuredPlaylists.slice(0, 6).map((playlist) => (
            <Card
              key={playlist.id}
              className="bg-[#2a2a2a] border-gray-700 hover:bg-[#3a3a3a] transition-colors cursor-pointer"
            >
              <CardContent className="p-4 flex items-center gap-4">
                <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded flex items-center justify-center text-2xl">
                  {playlist.image}
                </div>
                <div>
                  <h3 className="font-semibold text-white">{playlist.name}</h3>
                  <p className="text-sm text-gray-400">{playlist.tracks} tracks</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-xl font-bold text-white mb-4">Made for you</h3>
        <div className="grid grid-cols-6 gap-4">
          {featuredPlaylists.map((playlist) => (
            <Card
              key={playlist.id}
              className="bg-[#1a1a1a] border-gray-800 hover:bg-[#2a2a2a] transition-colors cursor-pointer"
            >
              <CardContent className="p-4">
                <div className="w-full aspect-square bg-gradient-to-br from-blue-500 to-purple-500 rounded-lg mb-4 flex items-center justify-center text-4xl">
                  {playlist.image}
                </div>
                <h4 className="font-semibold text-white mb-1 truncate">{playlist.name}</h4>
                <p className="text-sm text-gray-400 line-clamp-2">{playlist.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-xl font-bold text-white mb-4">Recently played</h3>
        <div className="grid grid-cols-6 gap-4">
          {topAlbums.map((album) => (
            <Card
              key={album.id}
              className="bg-[#1a1a1a] border-gray-800 hover:bg-[#2a2a2a] transition-colors cursor-pointer"
            >
              <CardContent className="p-4">
                <div className="w-full aspect-square bg-gradient-to-br from-green-500 to-blue-500 rounded-lg mb-4 flex items-center justify-center text-4xl">
                  {album.image}
                </div>
                <h4 className="font-semibold text-white mb-1 truncate">{album.name}</h4>
                <p className="text-sm text-gray-400">{album.artist}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
