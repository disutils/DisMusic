import { Construction, Mic2, User, Music2, Radio } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function ArtistsPage() {
  return (
    <div className="p-6 h-full overflow-auto bg-[#1a1a1a]">
      <div className="max-w-2xl mx-auto text-center mt-12">
        {/* Animated Construction Header */}
        <div className="relative mb-8">
          <div className="absolute -left-4 top-0 animate-bounce">
            <Construction className="w-8 h-8 text-purple-500 transform -rotate-12" />
          </div>
          <div className="absolute -right-4 top-0 animate-bounce delay-100">
            <Construction className="w-8 h-8 text-purple-500 transform rotate-12" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-4 tracking-tight">
            Artists Coming Soon!
          </h1>
        </div>

        {/* Main Content with Animation */}
        <div className="relative p-8 rounded-xl bg-[#232323] border border-gray-800 shadow-xl mb-8">
          {/* Animated Microphones */}
          <div className="absolute -left-3 top-1/2 transform -translate-y-1/2">
            <Mic2 className="w-12 h-12 text-purple-500 animate-bounce" />
          </div>
          <div className="absolute -right-3 top-1/2 transform -translate-y-1/2">
            <Mic2 className="w-12 h-12 text-purple-500 animate-bounce delay-150" />
          </div>

          <div className="space-y-6">
            <div className="flex justify-center">
              <div className="relative w-24 h-24 mb-6">
                <User className="w-full h-full text-purple-500 animate-pulse" />
              </div>
            </div>

            <p className="text-xl text-gray-300 mb-6">
              Get ready to discover your favorite artists!
            </p>

            <div className="flex flex-col items-center gap-4">
              <div className="flex items-center gap-2 text-gray-400">
                <Radio className="w-5 h-5 animate-wiggle" />
                <span>Feature under development</span>
              </div>

              <div className="w-64 h-2 bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-purple-500 to-pink-500 animate-progress" />
              </div>
            </div>
          </div>
        </div>

        {/* Feature Preview */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto mt-8">
          <div className="p-6 rounded-lg bg-[#232323] border border-gray-800 transform hover:scale-105 transition-transform">
            <User className="w-8 h-8 text-purple-500 mb-4 mx-auto" />
            <h3 className="text-lg font-semibold text-white mb-2">Artist Profiles</h3>
            <p className="text-gray-400 text-sm">Explore detailed artist biographies and discographies</p>
          </div>
          <div className="p-6 rounded-lg bg-[#232323] border border-gray-800 transform hover:scale-105 transition-transform">
            <Music2 className="w-8 h-8 text-purple-500 mb-4 mx-auto" />
            <h3 className="text-lg font-semibold text-white mb-2">Top Tracks</h3>
            <p className="text-gray-400 text-sm">Listen to the most popular songs from your favorite artists</p>
          </div>
        </div>

        {/* Coming Soon Button */}
        <div className="mt-12">
          <Button
            className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 animate-pulse-slow"
            disabled
          >
            <User className="w-4 h-4 mr-2" />
            Coming Soon
          </Button>
          <p className="text-gray-500 text-sm mt-4">
            We'll notify you when artist profiles are ready!
          </p>
        </div>
      </div>
    </div>
  )
}
