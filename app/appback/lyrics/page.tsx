import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Play, Heart } from "lucide-react"

export default function LyricsPage() {
  return (
    <div className="p-6 h-full overflow-auto">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-6 mb-8">
          <div className="w-32 h-32 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center text-5xl">
            🎵
          </div>
          <div>
            <h2 className="text-3xl font-bold text-white mb-2">Blinding Lights</h2>
            <p className="text-xl text-gray-400 mb-4">The Weeknd</p>
            <div className="flex items-center gap-4">
              <Button className="bg-green-600 hover:bg-green-700 rounded-full">
                <Play className="w-4 h-4 mr-2" />
                Play
              </Button>
              <Button variant="ghost" className="text-gray-400 hover:text-white">
                <Heart className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        <Card className="bg-[#1a1a1a] border-gray-800">
          <CardContent className="p-8">
            <div className="space-y-6 text-white leading-relaxed">
              <div className="space-y-2">
                <p className="text-lg">Yeah</p>
                <p className="text-lg">I've been tryna call</p>
                <p className="text-lg">I've been on my own for long enough</p>
                <p className="text-lg">Maybe you can show me how to love, maybe</p>
              </div>

              <div className="space-y-2">
                <p className="text-lg">I feel like I'm just missing something when you're gone</p>
                <p className="text-lg">What if I'm never gonna find my way back home?</p>
                <p className="text-lg">What if I'm never gonna see you again?</p>
              </div>

              <div className="space-y-2 bg-green-500/10 p-4 rounded-lg border-l-4 border-green-500">
                <p className="text-lg font-semibold text-green-400">[Chorus]</p>
                <p className="text-lg">I feel like I'm just missing something when you're gone</p>
                <p className="text-lg">What if I'm never gonna find my way back home?</p>
                <p className="text-lg">What if I'm never gonna see you again?</p>
                <p className="text-lg">I said, ooh, I'm blinded by the lights</p>
              </div>

              <div className="space-y-2">
                <p className="text-lg">No, I can't sleep until I feel your touch</p>
                <p className="text-lg">I said, ooh, I'm drowning in the night</p>
                <p className="text-lg">Oh, when I'm like this, you're the one I trust</p>
                <p className="text-lg">I'm running out of time</p>
              </div>

              <div className="space-y-2">
                <p className="text-lg">'Cause I can see the sun light up the sky</p>
                <p className="text-lg">So I hit the road in overdrive, baby, oh</p>
              </div>

              <div className="space-y-2 bg-green-500/10 p-4 rounded-lg border-l-4 border-green-500">
                <p className="text-lg font-semibold text-green-400">[Chorus]</p>
                <p className="text-lg">The city's cold and empty (Oh)</p>
                <p className="text-lg">No one's around to judge me (Oh)</p>
                <p className="text-lg">I can't see clearly when you're gone</p>
                <p className="text-lg">I said, ooh, I'm blinded by the lights</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
