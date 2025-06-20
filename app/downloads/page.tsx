import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Download } from "lucide-react"

export default function DownloadsPage() {
  return (
    <div className="p-6 h-full overflow-auto">
      <h2 className="text-2xl font-bold text-white mb-6">Downloads</h2>

      <div className="space-y-4">
        <Card className="bg-[#1a1a1a] border-gray-800">
          <CardContent className="p-6">
            <div className="flex items-center gap-4 mb-4">
              <Download className="w-8 h-8 text-green-500" />
              <div>
                <h3 className="text-lg font-semibold text-white">Download Music</h3>
                <p className="text-gray-400">Download your favorite tracks for offline listening</p>
              </div>
            </div>
            <Button className="bg-green-600 hover:bg-green-700">
              <Download className="w-4 h-4 mr-2" />
              Enable Downloads
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-white">Downloaded Music</h3>
          <div className="text-center py-12 text-gray-400">
            <Download className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No downloaded music yet</p>
            <p className="text-sm mt-2">Download songs to listen offline</p>
          </div>
        </div>
      </div>
    </div>
  )
}
