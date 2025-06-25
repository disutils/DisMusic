import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { MusicProvider } from "./context/MusicContext"
import ClientLayoutContent from "./clientLayout"
import "./globals.css"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "DisMusic",
  description: "A music player inspired by Spotube that allows you to play music from sources like YouTube, Spotify, and more.",
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