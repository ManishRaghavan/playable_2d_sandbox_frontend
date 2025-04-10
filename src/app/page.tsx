"use client";

import { InteractiveHoverButton } from "@/components/magicui/interactive-hover-button";
import { RetroGrid } from "@/components/magicui/retro-grid";
import { TypingAnimation } from "@/components/magicui/typing-animation";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  return (
    <div className="relative flex h-screen w-screen flex-col items-center justify-center overflow-hidden bg-background">
      <span className="pointer-events-none z-10 whitespace-pre-wrap bg-gradient-to-b from-[#ffd319] via-[#ff2975] to-[#8c1eff] bg-clip-text text-center text-7xl font-bold leading-none tracking-tighter text-transparent">
        Playable 2D Game Sandbox
      </span>
      <TypingAnimation className="mt-6 text-center">
        Turn your prompts into playable games.
      </TypingAnimation>
      <InteractiveHoverButton
        onClick={() => router.push("/sandbox")}
        className="mt-6 text-center text-2xl"
      >
        Get Started
      </InteractiveHoverButton>
      <RetroGrid />
    </div>
  );
}
