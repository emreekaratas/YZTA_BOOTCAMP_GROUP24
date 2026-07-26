"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { createGlobeScene, type GlobeSceneHandle } from "./landing/globe-scene";

export default function GlobeBackground() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<GlobeSceneHandle | null>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;

    // Mobilde ve hareket hassasiyeti olan cihazlarda sahneyi hiç başlatma
    if (window.matchMedia("(max-width: 768px)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    sceneRef.current = createGlobeScene({ wrap, gsap, ambient: true });

    return () => {
      sceneRef.current?.destroy();
      sceneRef.current = null;
    };
  }, []);

  return (
    <>
      <div ref={wrapRef} className="globe-bg" aria-hidden="true" />
      <div className="globe-veil" aria-hidden="true" />
    </>
  );
}