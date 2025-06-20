import React, { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

let socket: Socket;

const Player: React.FC = () => {
    const [youtubeUrl, setYoutubeUrl] = useState<string | null>(null);
    const [queue, setQueue] = useState<string[]>([]);
    const inputRef = useRef<HTMLInputElement>(null);
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const playerRef = useRef<any>(null);
    const [nearEndLogged, setNearEndLogged] = useState(false);

    useEffect(() => {
        socket = io("http://localhost:3000");

        socket.on("playYouTube", ({ url }) => {
            setYoutubeUrl(url);
            setNearEndLogged(false);
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
        let interval: NodeJS.Timeout;

        function onYouTubeIframeAPIReady() {
            if (!iframeRef.current) return;
            // @ts-ignore
            playerRef.current = new window.YT.Player(iframeRef.current, {
                events: {
                    onStateChange: (event: any) => {
                        // 0 = ended
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
                // @ts-ignore
                window.onYouTubeIframeAPIReady = onYouTubeIframeAPIReady;
            } else {
                onYouTubeIframeAPIReady();
            }
        }

        // Poll current time every 3 seconds
        if (youtubeUrl) {
            interval = setInterval(() => {
                const player = playerRef.current;
                if (player && player.getDuration && player.getCurrentTime) {
                    const duration = player.getDuration();
                    const current = player.getCurrentTime();
                    if (
                        duration &&
                        current &&
                        duration - current < 10 &&
                        !nearEndLogged
                    ) {
                        console.log(
                            `Song is near end: ${Math.round(duration - current)}s left`
                        );
                        setNearEndLogged(true);
                    }
                }
            }, 3000);
        }

        return () => {
            if (interval) clearInterval(interval);
            if (playerRef.current && playerRef.current.destroy) {
                playerRef.current.destroy();
                playerRef.current = null;
            }
        };
        // eslint-disable-next-line
    }, [youtubeUrl, nearEndLogged]);

    return (
        <div style={{ display: "flex" }}>
            <div style={{ flex: 1, padding: 20 }}>
                <input
                    ref={inputRef}
                    type="text"
                    placeholder="Spotify URL or search..."
                    style={{ width: "60%", marginRight: 8 }}
                />
                <button onClick={handlePlay}>Play</button>
                {youtubeUrl && (
                    <div style={{ marginTop: 20 }}>
                        <iframe
                            ref={iframeRef}
                            width="560"
                            height="315"
                            src={youtubeUrl.replace("watch?v=", "embed/") + "?enablejsapi=1&autoplay=1"}
                            title="YouTube player"
                            frameBorder="0"
                            allow="autoplay; encrypted-media"
                            allowFullScreen
                        />
                    </div>
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