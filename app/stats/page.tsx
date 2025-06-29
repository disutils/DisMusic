import { Construction, LineChart, BarChart4, PieChart, Activity } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function StatsPage() {
  return (
    <div className="p-6 h-full overflow-auto bg-[#1a1a1a]">
      <div className="max-w-2xl mx-auto text-center mt-12">
        {/* Animated Construction Header */}
        <div className="relative mb-8">
          <div className="absolute -left-4 top-0 animate-bounce">
            <Construction className="w-8 h-8 text-blue-500 transform -rotate-12" />
          </div>
          <div className="absolute -right-4 top-0 animate-bounce delay-100">
            <Construction className="w-8 h-8 text-blue-500 transform rotate-12" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-4 tracking-tight">
            Stats Coming Soon!
          </h1>
        </div>

        {/* Main Content with Animation */}
        <div className="relative p-8 rounded-xl bg-[#232323] border border-gray-800 shadow-xl mb-8">
          {/* Animated Charts */}
          <div className="absolute -left-3 top-1/2 transform -translate-y-1/2">
            <LineChart className="w-12 h-12 text-blue-500 animate-pulse" />
          </div>
          <div className="absolute -right-3 top-1/2 transform -translate-y-1/2">
            <BarChart4 className="w-12 h-12 text-blue-500 animate-pulse delay-150" />
          </div>

          <div className="space-y-6">
            <div className="flex justify-center">
              <div className="relative w-24 h-24 mb-6">
                <PieChart className="w-full h-full text-blue-500 animate-spin-slow" />
              </div>
            </div>

            <p className="text-xl text-gray-300 mb-6">
              Analyzing your music insights...
            </p>

            <div className="flex flex-col items-center gap-4">
              <div className="flex items-center gap-2 text-gray-400">
                <Activity className="w-5 h-5 animate-wiggle" />
                <span>Feature under development</span>
              </div>

              <div className="w-64 h-2 bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 animate-progress" />
              </div>
            </div>
          </div>
        </div>

        {/* Feature Preview */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto mt-8">
          <div className="p-6 rounded-lg bg-[#232323] border border-gray-800 transform hover:scale-105 transition-transform">
            <LineChart className="w-8 h-8 text-blue-500 mb-4 mx-auto" />
            <h3 className="text-lg font-semibold text-white mb-2">Listening Trends</h3>
            <p className="text-gray-400 text-sm">Track your music preferences over time</p>
          </div>
          <div className="p-6 rounded-lg bg-[#232323] border border-gray-800 transform hover:scale-105 transition-transform">
            <PieChart className="w-8 h-8 text-blue-500 mb-4 mx-auto" />
            <h3 className="text-lg font-semibold text-white mb-2">Genre Analysis</h3>
            <p className="text-gray-400 text-sm">Discover your favorite music genres</p>
          </div>
        </div>

        {/* Coming Soon Button */}
        <div className="mt-12">
          <Button
            className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 animate-pulse-slow"
            disabled
          >
            <Activity className="w-4 h-4 mr-2" />
            Coming Soon
          </Button>
          <p className="text-gray-500 text-sm mt-4">
            We'll notify you when music statistics are ready!
          </p>
        </div>
      </div>
    </div>
  )
}
