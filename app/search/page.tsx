import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Search, Play, Music } from "lucide-react"

export default function SearchPage() {
  return (
    <div className="p-6 h-full overflow-auto">
      <div className="max-w-2xl mb-8">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <Input
            type="text"
            placeholder="What do you want to listen to?"
            className="pl-12 h-12 bg-[#2a2a2a] border-gray-700 text-white placeholder:text-gray-400 text-lg"
          />
        </div>
      </div>

      <div className="space-y-8">
        <div>
          <h3 className="text-xl font-bold text-white mb-4">Browse all</h3>
          <div className="grid grid-cols-4 gap-4">
            {[
              { name: "Pop", color: "from-pink-500 to-red-500", icon: "🎵" },
              { name: "Hip-Hop", color: "from-orange-500 to-yellow-500", icon: "🎤" },
              { name: "Rock", color: "from-red-500 to-pink-500", icon: "🎸" },
              { name: "Electronic", color: "from-blue-500 to-purple-500", icon: "🎛️" },
              { name: "Jazz", color: "from-yellow-500 to-orange-500", icon: "🎺" },
              { name: "Classical", color: "from-purple-500 to-blue-500", icon: "🎼" },
              { name: "Country", color: "from-green-500 to-yellow-500", icon: "🤠" },
              { name: "R&B", color: "from-purple-500 to-pink-500", icon: "💜" },
            ].map((genre, i) => (
              <Card
                key={i}
                className={`bg-gradient-to-br ${genre.color} border-0 cursor-pointer hover:scale-105 transition-transform`}
              >
                <CardContent className="p-6 h-32 flex flex-col justify-between">
                  <h4 className="text-xl font-bold text-white">{genre.name}</h4>
                  <div className="text-3xl self-end">{genre.icon}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-xl font-bold text-white mb-4">Top result</h3>
          <div className="grid grid-cols-2 gap-6">
            <Card className="bg-[#2a2a2a] border-gray-700 p-6 hover:bg-[#3a3a3a] transition-colors cursor-pointer">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-3xl">
                  👨‍🎤
                </div>
                <div>
                  <h4 className="text-2xl font-bold text-white">The Weeknd</h4>
                  <Badge variant="secondary" className="mt-1">
                    Artist
                  </Badge>
                </div>
              </div>
              <Button className="bg-green-600 hover:bg-green-700 rounded-full w-12 h-12">
                <Play className="w-5 h-5" />
              </Button>
            </Card>
            <div className="space-y-2">
              <h4 className="text-lg font-semibold text-white">Songs</h4>
              {["Blinding Lights", "Save Your Tears", "After Hours", "Can't Feel My Face"].map((song, i) => (
                <div key={i} className="flex items-center gap-3 p-2 hover:bg-[#2a2a2a] rounded cursor-pointer">
                  <div className="w-10 h-10 bg-gray-700 rounded flex items-center justify-center">
                    <Music className="w-4 h-4 text-gray-400" />
                  </div>
                  <div>
                    <p className="text-white font-medium">{song}</p>
                    <p className="text-sm text-gray-400">The Weeknd</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
