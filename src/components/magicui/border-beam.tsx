"use client";

import { useEffect, useRef } from "react";

interface BorderBeamProps {
  duration?: number;
  size?: number;
}

export function BorderBeam({ duration = 8, size = 100 }: BorderBeamProps) {
  const beamRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const beam = beamRef.current;
    const container = containerRef.current;
    if (!beam || !container) return;

    const rotateBeam = () => {
      const { width, height } = container.getBoundingClientRect();
      const perimeter = 2 * (width + height);

      beam.animate(
        [
          { transform: "translateX(0) translateY(0)" },
          { transform: `translateX(${width}px) translateY(0)` },
          { transform: `translateX(${width}px) translateY(${height}px)` },
          { transform: `translateX(0) translateY(${height}px)` },
          { transform: "translateX(0) translateY(0)" },
        ],
        {
          duration: duration * 1000,
          iterations: Infinity,
        }
      );
    };

    rotateBeam();

    window.addEventListener("resize", rotateBeam);
    return () => window.removeEventListener("resize", rotateBeam);
  }, [duration]);

  return (
    <div
      ref={containerRef}
      className="pointer-events-none absolute inset-0 overflow-hidden rounded-lg"
    >
      <div
        ref={beamRef}
        style={{ width: size, height: size }}
        className="absolute -left-24 -top-24 bg-gradient-to-r from-transparent via-blue-500/50 to-transparent blur-[2px]"
      />
    </div>
  );
}
