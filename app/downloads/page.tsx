import { Construction, Cog, Download, Wrench, HardDrive } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function DownloadsPage() {
  return (
    <div className="p-6 h-full overflow-auto bg-[#1a1a1a]">
      <div className="max-w-2xl mx-auto text-center mt-12">
        {/* Animated Construction Header */}
        <div className="relative mb-8">
          <div className="absolute -left-4 top-0 animate-bounce">
            <Construction className="w-8 h-8 text-yellow-500 transform -rotate-12" />
          </div>
          <div className="absolute -right-4 top-0 animate-bounce delay-100">
            <Construction className="w-8 h-8 text-yellow-500 transform rotate-12" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-4 tracking-tight">
            Downloads Coming Soon!
          </h1>
        </div>

        {/* Main Content with Animation */}
        <div className="relative p-8 rounded-xl bg-[#232323] border border-gray-800 shadow-xl mb-8">
          {/* Animated Gears */}
          <div className="absolute -left-3 top-1/2 transform -translate-y-1/2">
            <Cog className="w-12 h-12 text-green-500 animate-spin-slow" />
          </div>
          <div className="absolute -right-3 top-1/2 transform -translate-y-1/2">
            <Cog className="w-12 h-12 text-green-500 animate-spin-reverse-slow" />
          </div>

          <div className="space-y-6">
            <div className="flex justify-center">
              <div className="relative w-24 h-24 mb-6">
                <HardDrive className="w-full h-full text-green-500 animate-pulse" />
              </div>
            </div>

            <p className="text-xl text-gray-300 mb-6">
              We're working hard to bring you offline downloads!
            </p>

            <div className="flex flex-col items-center gap-4">
              <div className="flex items-center gap-2 text-gray-400">
                <Wrench className="w-5 h-5 animate-wiggle" />
                <span>Feature under construction</span>
              </div>

              <div className="w-64 h-2 bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-green-500 to-green-700 animate-progress" />
              </div>
            </div>
          </div>
        </div>

        {/* Feature Preview */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto mt-8">
          <div className="p-6 rounded-lg bg-[#232323] border border-gray-800 transform hover:scale-105 transition-transform">
            <Download className="w-8 h-8 text-green-500 mb-4 mx-auto" />
            <h3 className="text-lg font-semibold text-white mb-2">Offline Mode</h3>
            <p className="text-gray-400 text-sm">Listen to your favorite tracks without an internet connection</p>
          </div>
          <div className="p-6 rounded-lg bg-[#232323] border border-gray-800 transform hover:scale-105 transition-transform">
            <HardDrive className="w-8 h-8 text-green-500 mb-4 mx-auto" />
            <h3 className="text-lg font-semibold text-white mb-2">Smart Storage</h3>
            <p className="text-gray-400 text-sm">Efficiently manage your downloaded music library</p>
          </div>
        </div>

        {/* Newsletter Signup */}
        <div className="mt-12">
          <Button
            className="bg-gradient-to-r from-green-500 to-green-700 hover:from-green-600 hover:to-green-800 animate-pulse-slow"
            disabled
          >
            <Download className="w-4 h-4 mr-2" />
            Coming Soon
          </Button>
          <p className="text-gray-500 text-sm mt-4">
            We'll notify you when downloads are available!
          </p>
        </div>
      </div>
    </div>
  )
}
