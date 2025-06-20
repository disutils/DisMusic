import { Card, CardContent } from "@/components/ui/card"
import { Clock, Music, TrendingUp, Star } from "lucide-react"

const topArtists = [
  { id: 1, name: "The Weeknd", followers: "85.2M", image: "👨‍🎤", genre: "Pop" },
  { id: 2, name: "Billie Eilish", followers: "72.1M", image: "👩‍🎤", genre: "Alternative" },
  { id: 3, name: "Drake", followers: "68.9M", image: "🎤", genre: "Hip-Hop" },
  { id: 4, name: "Taylor Swift", followers: "91.3M", image: "👸", genre: "Pop" },
  { id: 5, name: "Ed Sheeran", followers: "64.5M", image: "🎸", genre: "Pop" },
]

export default function StatsPage() {
  return (
    <div className="p-6 space-y-8 h-full overflow-auto">
      <div>
        <h2 className="text-2xl font-bold text-white mb-6">Your Music Stats</h2>

        <div className="grid grid-cols-4 gap-6 mb-8">
          <Card className="bg-gradient-to-br from-green-500 to-emerald-500 border-0">
            <CardContent className="p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-90">Total Listening Time</p>
                  <p className="text-2xl font-bold">247h 32m</p>
                </div>
                <Clock className="w-8 h-8 opacity-80" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-500 to-cyan-500 border-0">
            <CardContent className="p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-90">Songs Played</p>
                  <p className="text-2xl font-bold">3,247</p>
                </div>
                <Music className="w-8 h-8 opacity-80" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-500 to-pink-500 border-0">
            <CardContent className="p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-90">Top Genre</p>
                  <p className="text-2xl font-bold">Pop</p>
                </div>
                <TrendingUp className="w-8 h-8 opacity-80" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-500 to-red-500 border-0">
            <CardContent className="p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-90">Favorite Artist</p>
                  <p className="text-2xl font-bold">The Weeknd</p>
                </div>
                <Star className="w-8 h-8 opacity-80" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-8">
        <Card className="bg-[#1a1a1a] border-gray-800">
          <CardContent className="p-6">
            <h3 className="text-xl font-bold text-white mb-4">Top Artists This Month</h3>
            <div className="space-y-4">
              {topArtists.map((artist, i) => (
                <div key={artist.id} className="flex items-center gap-4">
                  <span className="text-gray-400 w-4">{i + 1}</span>
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-lg">
                    {artist.image}
                  </div>
                  <div className="flex-1">
                    <p className="text-white font-medium">{artist.name}</p>
                    <p className="text-sm text-gray-400">{artist.genre}</p>
                  </div>
                  <p className="text-sm text-gray-400">247 plays</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#1a1a1a] border-gray-800">
          <CardContent className="p-6">
            <h3 className="text-xl font-bold text-white mb-4">Listening Activity</h3>
            <div className="space-y-4">
              {[
                { day: "Monday", hours: 4.2 },
                { day: "Tuesday", hours: 3.8 },
                { day: "Wednesday", hours: 5.1 },
                { day: "Thursday", hours: 2.9 },
                { day: "Friday", hours: 6.3 },
                { day: "Saturday", hours: 7.8 },
                { day: "Sunday", hours: 5.5 },
              ].map((day) => (
                <div key={day.day} className="flex items-center gap-4">
                  <span className="text-gray-400 w-20">{day.day}</span>
                  <div className="flex-1 bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-green-500 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${(day.hours / 8) * 100}%` }}
                    />
                  </div>
                  <span className="text-white w-12 text-right">{day.hours}h</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
