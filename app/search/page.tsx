import { Construction, Search, Rocket, Sparkles, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function SearchPage() {
  return (
    <div className="p-6 h-full overflow-auto bg-[#1a1a1a]">
      <div className="max-w-2xl mx-auto text-center mt-12">
        {/* Animated Construction Header */}
        <div className="relative mb-8">
          <div className="absolute -left-4 top-0 animate-bounce">
            <Sparkles className="w-8 h-8 text-yellow-400 transform -rotate-12" />
          </div>
          <div className="absolute -right-4 top-0 animate-bounce delay-100">
            <Sparkles className="w-8 h-8 text-yellow-400 transform rotate-12" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-4 tracking-tight">
            Search Almost Ready!
          </h1>
          <p className="text-xl text-yellow-400 animate-pulse">
            Final touches in progress...
          </p>
        </div>

        {/* Main Content with Animation */}
        <div className="relative p-8 rounded-xl bg-[#232323] border border-gray-800 shadow-xl mb-8">
          {/* Animated Side Elements */}
          <div className="absolute -left-3 top-1/2 transform -translate-y-1/2">
            <Rocket className="w-12 h-12 text-yellow-400 animate-pulse" />
          </div>
          <div className="absolute -right-3 top-1/2 transform -translate-y-1/2">
            <Zap className="w-12 h-12 text-yellow-400 animate-pulse delay-150" />
          </div>

          <div className="space-y-6">
            <div className="flex justify-center">
              <div className="relative w-24 h-24 mb-6">
                <Search className="w-full h-full text-yellow-400 animate-ping opacity-75" />
              </div>
            </div>

            <p className="text-xl text-gray-300 mb-6">
              We're putting the finishing touches on your ultimate music search experience!
            </p>

            <div className="flex flex-col items-center gap-4">
              <div className="flex items-center gap-2 text-gray-400">
                <Construction className="w-5 h-5 animate-spin-slow" />
                <span>99% Complete</span>
              </div>

              <div className="w-64 h-2 bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-yellow-400 to-orange-500 w-[99%] transition-all duration-1000" />
              </div>
            </div>
          </div>
        </div>

        {/* Feature Preview */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto mt-8">
          <div className="p-6 rounded-lg bg-[#232323] border border-gray-800 transform hover:scale-105 transition-transform">
            <Search className="w-8 h-8 text-yellow-400 mb-4 mx-auto" />
            <h3 className="text-lg font-semibold text-white mb-2">Universal Search</h3>
            <p className="text-gray-400 text-sm">Search across multiple platforms in one place</p>
          </div>
          <div className="p-6 rounded-lg bg-[#232323] border border-gray-800 transform hover:scale-105 transition-transform">
            <Zap className="w-8 h-8 text-yellow-400 mb-4 mx-auto" />
            <h3 className="text-lg font-semibold text-white mb-2">Lightning Fast</h3>
            <p className="text-gray-400 text-sm">Get instant results as you type</p>
          </div>
        </div>

        {/* Launch Countdown */}
        <div className="mt-12">
          <Button
            className="bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-500 hover:to-orange-600 animate-pulse-slow"
            disabled
          >
            <Rocket className="w-4 h-4 mr-2" />
            Launching Very Soon!
          </Button>
          <p className="text-yellow-400 text-sm mt-4 animate-pulse">
            The wait is almost over!
          </p>
        </div>
      </div>
    </div>
  )
}
