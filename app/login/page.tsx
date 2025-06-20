"use client"

import { Button } from "@/components/ui/button"
import Image from "next/image"
import { useEffect, useState } from "react"

export default function LoginPage() {
  const [clientId, setClientId] = useState("");
  const [redirectUri, setRedirectUri] = useState("");

  useEffect(() => {
    // Check for token in URL (e.g., /login?token=...)
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    if (token) {
      // Set cookie for .distools.dev domain, 30 days expiry
      document.cookie = `dismusic_session=${token};domain=.distools.dev;path=/;secure;max-age=${30*24*60*60}`;
      window.location.href = "/playlists";
      return;
    }
    setClientId(process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID || "");
    setRedirectUri(process.env.NEXT_PUBLIC_DISCORD_REDIRECT_URI || "");
  }, []);

  const handleDiscordLogin = () => {
    if (!clientId || !redirectUri) return;
    window.location.href = `https://discord.com/oauth2/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=identify%20email`;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#18181b]">
      <div className="bg-[#232323] rounded-lg shadow-lg p-10 flex flex-col items-center w-full max-w-md">
        <Image src="/placeholder-logo.svg" alt="Logo" width={64} height={64} className="mb-6" />
        <h1 className="text-3xl font-bold text-white mb-2">Sign in to DisMusic</h1>
        <p className="text-gray-400 mb-8">Access your playlists, favorites, and more.</p>
        <Button
          onClick={handleDiscordLogin}
          className="w-full flex items-center justify-center gap-3 bg-[#5865F2] hover:bg-[#4752c4] text-white text-lg font-semibold py-3 rounded-lg shadow"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-3.6938-.5538-7.3898-.5538-11.0599 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.0371A19.7363 19.7363 0 00.6719 4.3698a.0699.0699 0 00-.0321.0277C-1.0462 7.0922-.4768 9.7132.1498 12.275c.0024.0102.0095.0195.0196.0244 2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276c-.598.3428-1.2205.6447-1.8733.8923a.0766.0766 0 00-.0406.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0196-.0244c.5006-2.1057.1807-4.6863-1.9926-7.8775a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1835 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1835 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z" fill="currentColor"/>
          </svg>
          Sign in with Discord
        </Button>
      </div>
    </div>
  )
}
