"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Play } from "lucide-react"
import React, { useEffect, useState } from "react"

const featuredPlaylists = [
	{ id: 1, name: "Today's Top Hits", description: "The most played songs right now", tracks: 50, image: "🎵" },
	{ id: 2, name: "Chill Vibes", description: "Relax and unwind with these tracks", tracks: 75, image: "🌙" },
	{ id: 3, name: "Workout Beats", description: "High energy music for your workout", tracks: 40, image: "💪" },
	{ id: 4, name: "Indie Rock", description: "The best of indie rock music", tracks: 60, image: "🎸" },
	{ id: 5, name: "Electronic Dreams", description: "Electronic music for every mood", tracks: 85, image: "🎛️" },
	{ id: 6, name: "Jazz Classics", description: "Timeless jazz standards", tracks: 45, image: "🎺" },
]

const topAlbums = [
	{ id: 1, name: "After Hours", artist: "The Weeknd", year: 2020, image: "🌃" },
	{ id: 2, name: "Happier Than Ever", artist: "Billie Eilish", year: 2021, image: "😊" },
	{ id: 3, name: "Certified Lover Boy", artist: "Drake", year: 2021, image: "💕" },
	{ id: 4, name: "Folklore", artist: "Taylor Swift", year: 2020, image: "🌲" },
	{ id: 5, name: "÷ (Divide)", artist: "Ed Sheeran", year: 2017, image: "➗" },
	{ id: 6, name: "Positions", artist: "Ariana Grande", year: 2020, image: "💫" },
]

export default function Home() {
	const [recommendations, setRecommendations] = useState<any[]>([])
	const [error, setError] = useState<string | null>(null)

	useEffect(() => {
		const fetchRecommendations = async () => {
			try {
				const Cookies = require("js-cookie");
				const token = Cookies.get("dismusic_session");
				const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "";

				console.log("Recommendations - Token exists:", !!token);
				console.log("Recommendations - Backend URL:", backendUrl);

				if (!token || !backendUrl) {
					console.error("Missing token or backend URL for recommendations");
					setError("Authentication or configuration error");
					return;
				}

				console.log("Fetching recommendations from:", `${backendUrl}/api/user/recommendations`);

				const response = await fetch(`${backendUrl}/api/user/recommendations`, {
					headers: { Authorization: `Bearer ${token}` },
				});

				console.log("Recommendations response status:", response.status);

				if (!response.ok) {
					throw new Error(`Error ${response.status}: ${response.statusText}`);
				}

				const data = await response.json();
				console.log("Recommendations data:", data);

				if (data && data.recommendations) {
					setRecommendations(data.recommendations);
				}
			} catch (err) {
				console.error("Error fetching recommendations:", err);
				setError("Failed to load recommendations");
			}
		};

		fetchRecommendations();
	}, [])

	return (
		<div className="p-6 space-y-8 h-full overflow-auto">
			<div>
				<h2 className="text-2xl font-bold text-white mb-6">Good evening</h2>
				{error && (
					<div className="text-red-500 mb-4">
						{error}
					</div>
				)}
				<div className="grid grid-cols-3 gap-4 mb-8">
					{featuredPlaylists.slice(0, 6).map((playlist) => (
						<Card
							key={playlist.id}
							className="bg-[#2a2a2a] border-gray-700 hover:bg-[#3a3a3a] transition-colors cursor-pointer"
						>
							<CardContent className="p-4 flex items-center gap-4">
								<div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded flex items-center justify-center text-2xl">
									{playlist.image}
								</div>
								<div>
									<h3 className="font-semibold text-white">{playlist.name}</h3>
									<p className="text-sm text-gray-400">{playlist.tracks} tracks</p>
								</div>
							</CardContent>
						</Card>
					))}
				</div>
			</div>

			<div>
				<h3 className="text-xl font-bold text-white mb-4">Made for you</h3>
				<div className="grid grid-cols-6 gap-4">
					{featuredPlaylists.map((playlist) => (
						<Card
							key={playlist.id}
							className="bg-[#1a1a1a] border-gray-800 hover:bg-[#2a2a2a] transition-colors cursor-pointer group"
						>
							<CardContent className="p-4">
								<div className="relative">
									<div className="w-full aspect-square bg-gradient-to-br from-blue-500 to-purple-500 rounded-lg mb-4 flex items-center justify-center text-4xl">
										{playlist.image}
									</div>
									<Button className="absolute bottom-2 right-2 w-10 h-10 bg-green-600 hover:bg-green-700 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-0">
										<Play className="w-5 h-5" />
									</Button>
								</div>
								<h4 className="font-semibold text-white mb-1 truncate">{playlist.name}</h4>
								<p className="text-sm text-gray-400 line-clamp-2">{playlist.description}</p>
							</CardContent>
						</Card>
					))}
				</div>
			</div>

			<div>
				<h3 className="text-xl font-bold text-white mb-4">Recently played</h3>
				<div className="grid grid-cols-6 gap-4">
					{topAlbums.map((album) => (
						<Card
							key={album.id}
							className="bg-[#1a1a1a] border-gray-800 hover:bg-[#2a2a2a] transition-colors cursor-pointer group"
						>
							<CardContent className="p-4">
								<div className="relative">
									<div className="w-full aspect-square bg-gradient-to-br from-green-500 to-blue-500 rounded-lg mb-4 flex items-center justify-center text-4xl">
										{album.image}
									</div>
									<Button className="absolute bottom-2 right-2 w-10 h-10 bg-green-600 hover:bg-green-700 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-0">
										<Play className="w-5 h-5" />
									</Button>
								</div>
								<h4 className="font-semibold text-white mb-1 truncate">{album.name}</h4>
								<p className="text-sm text-gray-400">{album.artist}</p>
							</CardContent>
						</Card>
					))}
				</div>
			</div>

			<div>
				<h3 className="text-xl font-bold text-white mb-4">Recommended for you</h3>
				<div className="grid grid-cols-6 gap-4">
					{recommendations.length === 0 && (
						<div className="col-span-6 text-gray-400">No recommendations yet. Add some favorites or playlists!</div>
					)}
					{recommendations.map((rec) => (
						<Card
							key={rec.id}
							className="bg-[#1a1a1a] border-gray-800 hover:bg-[#2a2a2a] transition-colors cursor-pointer group"
							onClick={() => window.open(rec.spotifyUrl, "_blank")}
						>
							<CardContent className="p-4">
								<div className="relative">
									<div className="w-full aspect-square bg-gradient-to-br from-green-500 to-blue-500 rounded-lg mb-4 flex items-center justify-center text-4xl overflow-hidden">
										{rec.albumCover ? (
											<img
												src={rec.albumCover}
												alt={rec.name}
												className="w-full h-full object-cover rounded-lg"
											/>
										) : (
											<span>🎵</span>
										)}
									</div>
									<Button className="absolute bottom-2 right-2 w-10 h-10 bg-green-600 hover:bg-green-700 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-0">
										<Play className="w-5 h-5" />
									</Button>
								</div>
								<h4 className="font-semibold text-white mb-1 truncate">{rec.name}</h4>
								<p className="text-sm text-gray-400 truncate">
									{rec.artists?.map((a) => a.name).join(", ")}
								</p>
							</CardContent>
						</Card>
					))}
				</div>
			</div>
		</div>
	)
}
