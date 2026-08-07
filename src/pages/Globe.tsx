/*
 * Interplanetary Fund — Copyright © 2026 Michelle Rogers. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL. Do not copy, distribute, or modify without
 * express written permission. See LICENSE file for full terms.
 *
 * Interactive Globe — Geologically accurate Earth using NASA Blue Marble textures
 * with topology bump mapping for mountain relief, water mask for ocean/land
 * separation, and atmospheric glow matching IF branding.
 */

import { useEffect, useRef, useState } from "react";

// Lazy import globe.gl + three to avoid bundling on initial load
let GlobeConstructor: any = null;
let THREE: any = null;

async function loadGlobe() {
  if (!GlobeConstructor) {
    const [globeMod, threeMod] = await Promise.all([
      import("globe.gl"),
      import("three"),
    ]);
    GlobeConstructor = globeMod.default || globeMod.Globe || globeMod;
    THREE = threeMod;
  }
  return { Globe: GlobeConstructor, THREE };
}

export default function GlobePage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const globeRef = useRef<any>(null);
  const [loading, setLoading] = useState(true);
  const [autoRotate, setAutoRotate] = useState(true);
  const [viewMode, setViewMode] = useState<"day" | "night">("day");

  useEffect(() => {
    let mounted = true;
    let globeInstance: any = null;

    async function initGlobe() {
      try {
        const { Globe, THREE } = await loadGlobe();
        if (!mounted || !containerRef.current) return;

        // Create the globe with geologically accurate textures
        const world = Globe()(containerRef.current, {
          animateIn: true,
        })
          .globeImageUrl("earth-blue-marble.jpg")
          .bumpImageUrl("earth-topology.png")
          .backgroundImageUrl("night-sky.png")
          .width(containerRef.current.clientWidth)
          .height(containerRef.current.clientHeight)
          .atmosphereColor("#22d3ee")
          .atmosphereAltitude(0.15)
          .showGlobe(true)
          .showGraticules(false)
          .showAtmosphere(true);

        globeInstance = world;
        globeRef.current = world;

        // Get the three.js scene and enhance rendering quality
        const scene = world.scene();

        // Add subtle warm nebula light to match branding
        const ambientLight = scene.children.find((c: any) => c.type === "AmbientLight");
        if (ambientLight) {
          ambientLight.intensity = 0.3;
          ambientLight.color = new THREE.Color("#22d3ee");
        }

        // Add a warm directional light to simulate the sun
        const sunLight = new THREE.DirectionalLight(0xfff5e6, 1.2);
        sunLight.position.set(5, 3, 5);
        scene.add(sunLight);

        // Add a subtle rim light from the opposite side (deep space purple)
        const rimLight = new THREE.DirectionalLight(0x8b5cf6, 0.3);
        rimLight.position.set(-5, -2, -5);
        scene.add(rimLight);

        // Configure controls for smooth mobile interaction
        const controls = world.controls();
        controls.autoRotate = true;
        controls.autoRotateSpeed = 0.3;
        controls.enableZoom = true;
        controls.enableDamping = true;
        controls.dampingFactor = 0.1;
        controls.rotateSpeed = 0.5;
        controls.minDistance = 180;
        controls.maxDistance = 600;

        // Pause auto-rotate on interaction, resume after 5 seconds
        let interactionTimeout: any = null;
        controls.addEventListener("start", () => {
          controls.autoRotate = false;
          if (interactionTimeout) clearTimeout(interactionTimeout);
        });
        controls.addEventListener("end", () => {
          if (interactionTimeout) clearTimeout(interactionTimeout);
          interactionTimeout = setTimeout(() => {
            if (globeRef.current && mounted && autoRotate) {
              globeRef.current.controls().autoRotate = true;
            }
          }, 5000);
        });

        // Set initial camera position — slightly tilted to show continents
        world.pointOfView({ lat: 20, lng: 0, altitude: 2.5 }, 0);

        setLoading(false);
      } catch (err) {
        console.error("Globe init failed:", err);
        setLoading(false);
      }
    }

    initGlobe();

    // Handle resize
    function handleResize() {
      if (globeRef.current && containerRef.current) {
        globeRef.current
          .width(containerRef.current.clientWidth)
          .height(containerRef.current.clientHeight);
      }
    }
    window.addEventListener("resize", handleResize);

    return () => {
      mounted = false;
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  const toggleRotate = () => {
    if (globeRef.current) {
      const newVal = !autoRotate;
      setAutoRotate(newVal);
      globeRef.current.controls().autoRotate = newVal;
    }
  };

  const toggleView = () => {
    if (globeRef.current) {
      const newMode = viewMode === "day" ? "night" : "day";
      setViewMode(newMode);
      if (newMode === "night") {
        globeRef.current.globeImageUrl("earth-night.jpg");
      } else {
        globeRef.current.globeImageUrl("earth-blue-marble.jpg");
      }
    }
  };

  return (
    <div className="relative w-full h-full flex flex-col">
      {/* Header */}
      <div className="px-4 pt-4 pb-2">
        <h2 className="page-title text-electric">Live Earth View</h2>
        <p className="page-subtitle">Drag to spin. Pinch to zoom. Campaign pins coming soon.</p>
      </div>

      {/* Globe container */}
      <div className="flex-1 relative overflow-hidden">
        <div ref={containerRef} className="w-full h-full" />

        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-ifdark">
            <div className="flex flex-col items-center gap-3">
              <div className="flex gap-2">
                <span className="w-2 h-2 rounded-full bg-ifcyan animate-pulse-glow" />
                <span className="w-2 h-2 rounded-full bg-ifaccent animate-pulse-glow" style={{ animationDelay: "0.2s" }} />
                <span className="w-2 h-2 rounded-full bg-ifcyan animate-pulse-glow" style={{ animationDelay: "0.4s" }} />
              </div>
              <span className="text-[10px] text-ifmuted">Loading Earth...</span>
            </div>
          </div>
        )}

        {/* Controls */}
        {!loading && (
          <>
            {/* Auto-rotate toggle */}
            <button
              onClick={toggleRotate}
              className="absolute bottom-4 right-4 z-10 bg-ifcard/80 backdrop-blur border border-ifborder rounded-full px-4 py-2 text-xs text-iftext"
            >
              {autoRotate ? "❙❙ Pause" : "▶ Spin"}
            </button>

            {/* Day/Night toggle */}
            <button
              onClick={toggleView}
              className="absolute bottom-4 left-4 z-10 bg-ifcard/80 backdrop-blur border border-ifborder rounded-full px-4 py-2 text-xs text-iftext"
            >
              {viewMode === "day" ? "🌙 Night" : "☀ Day"}
            </button>

            {/* Future search bar */}
            <div className="absolute top-2 left-4 right-4 z-10">
              <div className="bg-ifcard/80 backdrop-blur border border-ifborder rounded-xl px-4 py-2.5 text-xs text-ifmuted text-center">
                Search by address, neighborhood, or city — coming soon
              </div>
            </div>
          </>
        )}
      </div>

      {/* Bottom info */}
      <div className="px-4 py-3 mt-2">
        <div className="flex items-center justify-between text-[10px] text-ifmuted">
          <span>NASA Blue Marble — Geological accuracy</span>
          <span className="text-ifcyan">Live</span>
        </div>
      </div>
    </div>
  );
}
