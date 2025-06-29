import React, { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { Slider } from "./ui/slider";

let socket: Socket;

const Player: React.FC = () => {
    const [youtubeUrl, setYoutubeUrl] = useState<string | null>(null);
    const [queue, setQueue] = useState<string[]>([]);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const playerRef = useRef<any>(null);
    const [isPlayerReady, setIsPlayerReady] = useState(false);
    const [nearEndLogged, setNearEndLogged] = useState(false);

    useEffect(() => {
        socket = io("http://localhost:3000");

        socket.on("playYouTube", ({ url }) => {
            setYoutubeUrl(url);
            setNearEndLogged(false);
            setIsPlayerReady(false); // Reset player ready state for new video
        });

        socket.on("queueUpdate", ({ queue }) => {
            setQueue(queue);
        });

        socket.on("queueEnded", () => {
            setYoutubeUrl(null);
        });

        return () => {
            socket.disconnect();
        };
    }, []);

    const handlePlay = () => {
        const query = inputRef.current?.value;
        if (query) {
            socket.emit("play", { query });
        }
    };

    // YouTube IFrame API integration
    useEffect(() => {
        function onYouTubeIframeAPIReady() {
            if (!iframeRef.current) return;

            playerRef.current = new window.YT.Player(iframeRef.current, {
                events: {
                    onReady: (event: any) => {
                        setIsPlayerReady(true);
                        const player = event.target;
                        const duration = player.getDuration();
                        if (duration && !isNaN(duration)) {
                            setDuration(duration);
                        }
                        // Start time tracking
                        startTimeTracking(player);
                    },
                    onStateChange: (event: any) => {
                        if (event.data === 0) {
                            socket.emit("next");
                        }
                    }
                }
            });
        }

        if (youtubeUrl && iframeRef.current) {
            if (!window.YT) {
                const tag = document.createElement("script");
                tag.src = "https://www.youtube.com/iframe_api";
                document.body.appendChild(tag);
                window.onYouTubeIframeAPIReady = onYouTubeIframeAPIReady;
            } else {
                onYouTubeIframeAPIReady();
            }
        }

        return () => {
            if (playerRef.current && playerRef.current.destroy) {
                playerRef.current.destroy();
                playerRef.current = null;
            }
            setIsPlayerReady(false);
            setCurrentTime(0);
            setDuration(0);
        };
    }, [youtubeUrl]);

    // Function to start time tracking
    const startTimeTracking = (player: any) => {
        const updateTime = () => {
            if (player && typeof player.getCurrentTime === 'function') {
                const current = player.getCurrentTime();
                if (!isNaN(current)) {
                    setCurrentTime(current);
                }
            }
        };

        // Update time every 100ms for smoother progress bar
        const interval = setInterval(updateTime, 100);
        return () => clearInterval(interval);
    };

    const handleSeek = (value: number[]) => {
        const newTime = value[0];
        if (playerRef.current && typeof playerRef.current.seekTo === 'function') {
            playerRef.current.seekTo(newTime, true);
            setCurrentTime(newTime);
        }
    };

    const formatTime = (seconds: number) => {
        if (isNaN(seconds) || seconds < 0) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div style={{ display: "flex", position: "relative" }}>
            <div style={{ flex: 1, padding: 20 }}>
                <input
                    ref={inputRef}
                    type="text"
                    placeholder="Spotify URL or search..."
                    style={{ width: "60%", marginRight: 8 }}
                />
                <button onClick={handlePlay}>Play</button>
                {youtubeUrl && (
                    <>
                        <div style={{ marginTop: 20 }}>
                            <iframe
                                ref={iframeRef}
                                width="560"
                                height="315"
                                src={youtubeUrl.replace("watch?v=", "embed/") + "?enablejsapi=1"}
                                title="YouTube player"
                                frameBorder="0"
                                allow="autoplay; encrypted-media"
                                allowFullScreen
                            />
                        </div>
                        <div style={{ marginTop: 10, width: "560px" }}>
                            {isPlayerReady && (
                                <>
                                    <Slider
                                        value={[currentTime]}
                                        max={Math.max(duration, 1)}
                                        min={0}
                                        step={1}
                                        onValueChange={handleSeek}
                                    />
                                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5 }}>
                                        <span>{formatTime(currentTime)}</span>
                                        <span>{formatTime(duration)}</span>
                                    </div>
                                </>
                            )}
                        </div>
                    </>
                )}
            </div>
            <div style={{ width: 250, borderLeft: "1px solid #ccc", padding: 20 }}>
                <h3>Queue</h3>
                <ul>
                    {queue.map((track, i) => (
                        <li key={i}>{track}</li>
                    ))}
                </ul>
            </div>
        </div>
    );
};

export default Player;