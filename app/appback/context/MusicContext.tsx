"use client"

import type React from "react"
import { createContext, useContext, useState, useRef, useEffect } from "react"
import io, { type Socket } from "socket.io-client"

export interface QueueItem {
    title: string
    albumCover: string
}

interface MusicContextType {
    videoId: string | null
    ytReady: boolean
    queue: QueueItem[]
    isPlaying: boolean
    volume: number[]
    currentTime: number
    duration: number
    loading: boolean
    error: string
    handlePlay: (query: string) => void
    handlePause: () => void
    handleResume: () => void
    handleSkip: () => void
    handleVolumeChange: (value: number[]) => void
    setQueue: (queue: QueueItem[]) => void
}

const MusicContext = createContext<MusicContextType | undefined>(undefined)

export function MusicProvider({ children }: { children: React.ReactNode }) {
    const [videoId, setVideoId] = useState<string | null>(null)
    const [ytReady, setYtReady] = useState(false)
    const [queue, setQueue] = useState<QueueItem[]>([])
    const [isPlaying, setIsPlaying] = useState(true)
    const [volume, setVolume] = useState([100])
    const [currentTime, setCurrentTime] = useState(0)
    const [duration, setDuration] = useState(0)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")

    const playerRef = useRef<HTMLDivElement>(null)
    const socketRef = useRef<Socket | null>(null)

    useEffect(() => {
        if (window.YT && window.YT.Player) {
            setYtReady(true)
            return
        }
        window.onYouTubeIframeAPIReady = () => setYtReady(true)
        const tag = document.createElement("script")
        tag.src = "https://www.youtube.com/iframe_api"
        document.body.appendChild(tag)
        return () => {
            window.onYouTubeIframeAPIReady = () => {}
        }
    }, [])

    useEffect(() => {
        const socket = io("http://localhost:3000")
        socketRef.current = socket

        socket.on("connect", () => {
            console.log("Socket connected:", socket.id)
        })
        socket.on("connect_error", (err) => {
            setError("Socket connection error")
            console.error("Socket connection error:", err)
        })
        socket.on("playYouTube", ({ url }) => {
            const id = new URL(url).searchParams.get("v")
            setVideoId(id)
            setLoading(false)
            setIsPlaying(true)
        })
        socket.on("queueUpdate", ({ queue }) => {
            setQueue(queue)
        })

        return () => {
            socket.disconnect()
        }
    }, [])

    useEffect(() => {
        if (ytReady && videoId && playerRef.current) {
            if (!window.ytPlayer) {
                window.ytPlayer = new window.YT.Player(playerRef.current, {
                    height: "0",
                    width: "0",
                    videoId,
                    playerVars: { autoplay: 1 },
                    events: {
                        onStateChange: (event: any) => {
                            if (event.data === window.YT.PlayerState.ENDED) {
                                socketRef.current?.emit("next")
                            }
                            if (event.data === window.YT.PlayerState.PAUSED) {
                                setIsPlaying(false)
                            }
                            if (event.data === window.YT.PlayerState.PLAYING) {
                                setIsPlaying(true)
                            }
                        },
                        onReady: () => {
                            setDuration(window.ytPlayer.getDuration())
                        },
                    },
                })
            } else {
                window.ytPlayer.loadVideoById(videoId)
            }
        }
    }, [ytReady, videoId])

    useEffect(() => {
        if (window.ytPlayer && typeof window.ytPlayer.setVolume === "function") {
            window.ytPlayer.setVolume(volume[0])
        }
    }, [volume])

    useEffect(() => {
        const interval = setInterval(() => {
            if (window.ytPlayer && typeof window.ytPlayer.getCurrentTime === "function") {
                setCurrentTime(window.ytPlayer.getCurrentTime())
            }
        }, 1000)
        return () => clearInterval(interval)
    }, [])

    const handlePlay = (query: string) => {
        setLoading(true)
        setError("")
        setVideoId(null)
        socketRef.current?.emit("play", { query })
    }

    const handlePause = () => {
        window.ytPlayer?.pauseVideo()
    }

    const handleResume = () => {
        window.ytPlayer?.playVideo()
    }

    const handleSkip = () => {
        socketRef.current?.emit("next")
    }

    const handleVolumeChange = (value: number[]) => {
        setVolume(value)
    }

    return (
        <MusicContext.Provider
            value={{
                videoId,
                ytReady,
                queue,
                isPlaying,
                volume,
                currentTime,
                duration,
                loading,
                error,
                handlePlay,
                handlePause,
                handleResume,
                handleSkip,
                handleVolumeChange,
                setQueue,
            }}
        >
            {children}
            <div ref={playerRef} className="hidden" />
        </MusicContext.Provider>
    )
}

export function useMusic() {
    const context = useContext(MusicContext)
    if (context === undefined) {
        throw new Error("useMusic must be used within a MusicProvider")
    }
    return context
}