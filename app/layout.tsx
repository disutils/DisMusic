import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { MusicProvider } from "./context/MusicContext"
import ClientLayoutContent from "./clientLayout"
import "./globals.css"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "DisMusic",
  description: "Music player with queue management",
}

export default function RootLayout({
                                     children,
                                   }: {
  children: React.ReactNode
}) {
  return (
      <html lang="en">
      <body className={inter.className}>
      <MusicProvider>
        <ClientLayoutContent>{children}</ClientLayoutContent>
      </MusicProvider>
      </body>
      </html>
  )
}