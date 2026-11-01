import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";

const RADIUS = 2;
const MOBILE_BREAKPOINT = 640;
const MAX_PIXEL_RATIO = 2;

function latLngToVector3(lat, lng, radius = RADIUS) {
  const phi = (90 - lat) * Math.PI / 180;
  const theta = (lng + 180) * Math.PI / 180;
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
}

// An interactive 3D globe (three.js). Drag to rotate; tap a glowing pin to
// select that campaign. Auto-rotates when idle. Falls back gracefully if WebGL
// is unavailable. All assets are procedural except an optional earth texture
// (loaded with a graceful fallback to a styled ocean sphere).
export default function CampaignGlobe({ campaigns = [], onSelect }) {
  const containerRef = useRef(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    } catch (e) {
      setFailed(true);
      return;
    }

    let width = Math.max(1, container.clientWidth || 600);
    let height = Math.max(1, container.clientHeight || 420);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x010207);

    const starPoints = new Float32Array(7200);
    for (let i = 0; i < starPoints.length; i += 3) {
      const n = i / 3 + 1;
      starPoints[i] = ((n * 47) % 211) / 211 * 26 - 13;
      starPoints[i + 1] = ((n * 83) % 197) / 197 * 16 - 8;
      starPoints[i + 2] = -4 - ((n * 61) % 173) / 173 * 16;
    }
    const starGeometry = new THREE.BufferGeometry();
    starGeometry.setAttribute("position", new THREE.BufferAttribute(starPoints, 3));
    scene.add(new THREE.Points(starGeometry, new THREE.PointsMaterial({ color: 0xffffff, size: 0.018, transparent: true, opacity: 0.9 })));

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    const setCameraDistance = () => camera.position.set(0, 0, width < MOBILE_BREAKPOINT ? 6.6 : 5.35);
    setCameraDistance();

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO));
    renderer.setSize(width, height, false);
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.display = "block";
    renderer.domElement.style.touchAction = "pan-y";
    container.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.65));
    const dir = new THREE.DirectionalLight(0xffffff, 0.9);
    dir.position.set(5, 3, 5);
    scene.add(dir);

    const globeGroup = new THREE.Group();
    scene.add(globeGroup);

    const oceanMat = new THREE.MeshPhongMaterial({ color: 0x12304a, shininess: 14, specular: 0x224466 });
    globeGroup.add(new THREE.Mesh(new THREE.SphereGeometry(RADIUS, 64, 64), oceanMat));

    // Optional earth texture (graceful fallback to the ocean sphere above)
    const texLoader = new THREE.TextureLoader();
    texLoader.setCrossOrigin("anonymous");
    texLoader.load(
      "https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg",
      (tex) => { oceanMat.map = tex; oceanMat.color.set(0xffffff); oceanMat.needsUpdate = true; },
      undefined,
      () => { /* keep styled ocean */ }
    );

    // Atmosphere glow
    scene.add(new THREE.Mesh(
      new THREE.SphereGeometry(RADIUS * 1.12, 48, 48),
      new THREE.MeshBasicMaterial({ color: 0x3b82f6, transparent: true, opacity: 0.12, side: THREE.BackSide })
    ));

    // Pins
    const pinMeshes = [];
    const pinMat = new THREE.MeshBasicMaterial({ color: 0x22d3ee });
    const haloMat = new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.4 });
    (campaigns || []).forEach((c) => {
      if (!Number.isFinite(c?.location_lat) || !Number.isFinite(c?.location_lng)) return;
      const pos = latLngToVector3(c.location_lat, c.location_lng, RADIUS * 1.01);
      const pin = new THREE.Mesh(new THREE.SphereGeometry(0.038, 12, 12), pinMat);
      pin.position.copy(pos);
      pin.userData = { campaign: c };
      globeGroup.add(pin);
      pinMeshes.push(pin);
      const up = pos.clone().normalize();
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.2, 8), haloMat);
      pillar.position.copy(pos.clone().add(up.clone().multiplyScalar(0.1)));
      pillar.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), up);
      globeGroup.add(pillar);
    });

    const state = { dragging: false, pointerId: null, lastX: 0, lastY: 0, moved: false, auto: true };
    const target = { x: 0.25, y: 0 };

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const resumeTimers = new Set();

    const onDown = (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      state.dragging = true; state.pointerId = e.pointerId; state.auto = false; state.moved = false;
      state.lastX = e.clientX; state.lastY = e.clientY;
      renderer.domElement.setPointerCapture?.(e.pointerId);
    };
    const onMove = (e) => {
      if (!state.dragging || e.pointerId !== state.pointerId) return;
      const dx = e.clientX - state.lastX;
      const dy = e.clientY - state.lastY;
      if (Math.abs(dx) + Math.abs(dy) > 3) state.moved = true;
      target.y += dx * 0.005;
      target.x = Math.max(-1.2, Math.min(1.2, target.x + dy * 0.005));
      state.lastX = e.clientX; state.lastY = e.clientY;
    };
    const finishPointer = (e, allowSelect) => {
      if (!state.dragging || e.pointerId !== state.pointerId) return;
      const wasMoved = state.moved;
      state.dragging = false;
      state.pointerId = null;
      renderer.domElement.releasePointerCapture?.(e.pointerId);
      if (allowSelect && !wasMoved) {
        const rect = renderer.domElement.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
          pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
          raycaster.setFromCamera(pointer, camera);
          const hits = raycaster.intersectObjects(pinMeshes, false);
          if (hits.length) onSelectRef.current?.(hits[0].object.userData.campaign);
        }
      }
      const timer = window.setTimeout(() => {
        resumeTimers.delete(timer);
        if (!state.dragging) state.auto = true;
      }, 2500);
      resumeTimers.add(timer);
    };
    const onPointerUp = (e) => finishPointer(e, true);
    const onPointerCancel = (e) => finishPointer(e, false);

    renderer.domElement.addEventListener("pointerdown", onDown);
    renderer.domElement.addEventListener("pointermove", onMove);
    renderer.domElement.addEventListener("pointerup", onPointerUp);
    renderer.domElement.addEventListener("pointercancel", onPointerCancel);

    const resize = () => {
      width = Math.max(1, container.clientWidth || 600);
      height = Math.max(1, container.clientHeight || 420);
      setCameraDistance();
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO));
      renderer.setSize(width, height, false);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    let raf;
    const animate = () => {
      raf = requestAnimationFrame(animate);
      if (state.auto) target.y += 0.0014;
      globeGroup.rotation.y += (target.y - globeGroup.rotation.y) * 0.08;
      globeGroup.rotation.x += (target.x - globeGroup.rotation.x) * 0.08;
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(raf);
      resumeTimers.forEach((timer) => window.clearTimeout(timer));
      ro.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onDown);
      renderer.domElement.removeEventListener("pointermove", onMove);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      renderer.domElement.removeEventListener("pointercancel", onPointerCancel);
      scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) { Array.isArray(obj.material) ? obj.material.forEach((m) => m.dispose()) : obj.material.dispose(); }
      });
      renderer.dispose();
      if (renderer.domElement.parentNode === container) container.removeChild(renderer.domElement);
    };
  }, [campaigns]);

  if (failed) {
    return (
      <div className="w-full h-[clamp(280px,52dvh,560px)] flex items-center justify-center px-4 text-center text-cyan-200/80 text-sm">
        3D globe isn't available on this device. See the list below instead.
      </div>
    );
  }

  return <div ref={containerRef} className="w-full max-w-full h-[clamp(280px,52dvh,560px)] overflow-hidden cursor-grab active:cursor-grabbing" aria-label="Interactive campaign globe" />;
}