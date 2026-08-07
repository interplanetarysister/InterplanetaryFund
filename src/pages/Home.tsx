/*
 * Interplanetary Fund — Home / Mission Control
 * Copyright © 2026 Michelle Rogers. All Rights Reserved.
 *
 * The landing page — features a glowing Earth on deep space background,
 * live stats, and quick actions. Implements the Interplanetary branding:
 * "Welcome to Mission Control — your interplanetary fundraising command center."
 */

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useEffect, useRef } from "react";

export default function Home({ onNavigate, userId, onViewCampaign }: { 
  onNavigate?: (view: string) => void;
  userId?: string | null;
  onViewCampaign?: (campaignId: string) => void;
}) {
  const stats = useQuery(api.campaigns.getCampaignStats, {});
  const balances = useQuery(api.treasury.aggregateBalances, {});
  const userCampaigns = useQuery(api.userCampaigns.getActiveCampaigns, {});
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const totalRaised = balances?.grandTotal?.raised || 0;
  const totalDonors = balances?.grandTotal?.donors || 0;
  const activeCount = stats?.activeCount || 0;
  const campaignCount = userCampaigns?.length || 0;

  // Animated glowing Earth on canvas — credit-free, no external deps
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;
    let angle = 0;

    function resize() {
      const parent = canvas.parentElement;
      if (!parent) return;
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
    }
    resize();
    window.addEventListener("resize", resize);

    function draw() {
      if (!ctx || !canvas) return;
      const w = canvas.width;
      const h = canvas.height;
      const cx = w / 2;
      const cy = h / 2;
      const radius = Math.min(w, h) * 0.28;

      // Clear with deep space gradient
      const bgGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h));
      bgGrad.addColorStop(0, "#0c0d1a");
      bgGrad.addColorStop(0.5, "#05060f");
      bgGrad.addColorStop(1, "#020308");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, w, h);

      // Draw stars
      ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
      for (let i = 0; i < 80; i++) {
        const sx = (Math.sin(i * 7.3) * 0.5 + 0.5) * w;
        const sy = (Math.cos(i * 3.7) * 0.5 + 0.5) * h;
        const sr = Math.sin(i + angle * 0.5) * 0.5 + 0.8;
        ctx.globalAlpha = sr * 0.7;
        ctx.beginPath();
        ctx.arc(sx, sy, 0.8, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Outer glow — pulsing cyan to purple
      const pulse = Math.sin(angle * 0.02) * 0.15 + 0.85;
      const glowGrad = ctx.createRadialGradient(cx, cy, radius * 0.8, cx, cy, radius * 2);
      glowGrad.addColorStop(0, `rgba(34, 211, 238, ${0.25 * pulse})`);
      glowGrad.addColorStop(0.4, `rgba(139, 92, 246, ${0.08 * pulse})`);
      glowGrad.addColorStop(1, "rgba(139, 92, 246, 0)");
      ctx.fillStyle = glowGrad;
      ctx.fillRect(0, 0, w, h);

      // Atmosphere ring
      const atmoGrad = ctx.createRadialGradient(cx, cy, radius * 0.95, cx, cy, radius * 1.15);
      atmoGrad.addColorStop(0, "rgba(34, 211, 238, 0)");
      atmoGrad.addColorStop(0.5, `rgba(34, 211, 238, ${0.3 * pulse})`);
      atmoGrad.addColorStop(1, "rgba(34, 211, 238, 0)");
      ctx.fillStyle = atmoGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 1.15, 0, Math.PI * 2);
      ctx.fill();

      // Earth body — deep blue-green gradient
      const earthGrad = ctx.createRadialGradient(
        cx - radius * 0.3, cy - radius * 0.3, radius * 0.1,
        cx, cy, radius
      );
      earthGrad.addColorStop(0, "#1a4d6e");
      earthGrad.addColorStop(0.4, "#0d2d4a");
      earthGrad.addColorStop(0.7, "#0a1e30");
      earthGrad.addColorStop(1, "#050f1a");
      ctx.fillStyle = earthGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();

      // Continent shapes — simplified, rotating
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.clip();

      const rotOffset = angle * 0.003;
      ctx.fillStyle = "rgba(34, 197, 94, 0.5)";
      
      // Africa-like shape
      const aX = cx + Math.cos(rotOffset) * radius * 0.2;
      const aY = cy + radius * 0.1;
      ctx.beginPath();
      ctx.ellipse(aX, aY, radius * 0.18, radius * 0.35, rotOffset * 0.5, 0, Math.PI * 2);
      ctx.fill();

      // Americas-like shape
      const amX = cx + Math.cos(rotOffset + Math.PI) * radius * 0.3;
      const amY = cy - radius * 0.1;
      ctx.beginPath();
      ctx.ellipse(amX, amY, radius * 0.12, radius * 0.4, rotOffset * 0.3, 0, Math.PI * 2);
      ctx.fill();

      // Asia-like shape
      const asX = cx + Math.cos(rotOffset + Math.PI * 0.7) * radius * 0.35;
      const asY = cy - radius * 0.2;
      ctx.beginPath();
      ctx.ellipse(asX, asY, radius * 0.2, radius * 0.15, 0, 0, Math.PI * 2);
      ctx.fill();

      // Australia-like shape
      const auX = cx + Math.cos(rotOffset + Math.PI * 1.3) * radius * 0.3;
      const auY = cy + radius * 0.3;
      ctx.beginPath();
      ctx.ellipse(auX, auY, radius * 0.1, radius * 0.07, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

      // Highlight — light from upper left
      const highlightGrad = ctx.createRadialGradient(
        cx - radius * 0.4, cy - radius * 0.4, 0,
        cx - radius * 0.4, cy - radius * 0.4, radius * 0.6
      );
      highlightGrad.addColorStop(0, "rgba(255, 255, 255, 0.15)");
      highlightGrad.addColorStop(1, "rgba(255, 255, 255, 0)");
      ctx.fillStyle = highlightGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();

      // Shadow — dark side
      const shadowGrad = ctx.createRadialGradient(
        cx + radius * 0.5, cy + radius * 0.3, 0,
        cx + radius * 0.5, cy + radius * 0.3, radius * 0.8
      );
      shadowGrad.addColorStop(0, "rgba(0, 0, 0, 0)");
      shadowGrad.addColorStop(1, "rgba(0, 0, 0, 0.6)");
      ctx.fillStyle = shadowGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();

      angle++;
      animationId = requestAnimationFrame(draw);
    }

    draw();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <div className="space-y-5">
      {/* Hero — Glowing Earth on Deep Space */}
      <div className="relative rounded-2xl overflow-hidden border border-ifborder" style={{ height: "320px" }}>
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
        
        {/* Overlay text */}
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-6 z-10">
          <div className="text-center px-4 bg-gradient-to-t from-ifdark/90 via-ifdark/40 to-transparent pt-16 w-full">
            <h1 className="text-2xl font-bold text-ifwhite" style={{ textShadow: "0 0 20px rgba(34, 211, 238, 0.5)" }}>
              Interplanetary Fund
            </h1>
            <p className="text-sm text-ifcyan mt-1" style={{ textShadow: "0 0 10px rgba(34, 211, 238, 0.3)" }}>
              Your interplanetary fundraising command center
            </p>
          </div>
        </div>
      </div>

      {/* Mission Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card text-center py-4">
          <p className="text-xl font-bold text-ifcyan" style={{ textShadow: "0 0 8px rgba(34, 211, 238, 0.3)" }}>
            ${totalRaised.toLocaleString()}
          </p>
          <p className="text-[10px] text-ifmuted mt-0.5">Total Fuel</p>
        </div>
        <div className="card text-center py-4">
          <p className="text-xl font-bold text-ifaccent" style={{ textShadow: "0 0 8px rgba(139, 92, 246, 0.3)" }}>
            {activeCount}
          </p>
          <p className="text-[10px] text-ifmuted mt-0.5">In Orbit</p>
        </div>
        <div className="card text-center py-4">
          <p className="text-xl font-bold text-ifgreen">
            {totalDonors}
          </p>
          <p className="text-[10px] text-ifmuted mt-0.5">Pilots</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-iftext">Mission Control</h2>
        
        {userId ? (
          <button
            onClick={() => onNavigate?.("aiwizard")}
            className="w-full p-4 rounded-xl bg-gradient-to-r from-ifaccent/20 to-ifcyan/10 border border-ifaccent/30 flex items-center gap-3 active:scale-[0.98] transition-transform"
          >
            <div className="w-10 h-10 rounded-lg bg-ifaccent/20 flex items-center justify-center text-lg">
              🚀
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-semibold text-iftext">Launch New Campaign</p>
              <p className="text-[10px] text-ifmuted">AI-powered campaign creation wizard</p>
            </div>
            <span className="text-ifcyan text-xs">→</span>
          </button>
        ) : (
          <button
            onClick={() => onNavigate?.("login")}
            className="w-full p-4 rounded-xl bg-gradient-to-r from-ifaccent/20 to-ifcyan/10 border border-ifaccent/30 flex items-center gap-3 active:scale-[0.98] transition-transform"
          >
            <div className="w-10 h-10 rounded-lg bg-ifaccent/20 flex items-center justify-center text-lg">
              🚀
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-semibold text-iftext">Start Your Mission</p>
              <p className="text-[10px] text-ifmuted">Sign in to create and manage campaigns</p>
            </div>
            <span className="text-ifcyan text-xs">→</span>
          </button>
        )}

        <button
          onClick={() => onNavigate?.("explore")}
          className="w-full p-4 rounded-xl bg-ifcard border border-ifborder flex items-center gap-3 active:scale-[0.98] transition-transform"
        >
          <div className="w-10 h-10 rounded-lg bg-ifcyan/10 flex items-center justify-center text-lg">
            🔍
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-semibold text-iftext">Discover Campaigns</p>
            <p className="text-[10px] text-ifmuted">{campaignCount} active launch pads across the universe</p>
          </div>
          <span className="text-ifmuted text-xs">→</span>
        </button>

        <button
          onClick={() => onNavigate?.("globe")}
          className="w-full p-4 rounded-xl bg-ifcard border border-ifborder flex items-center gap-3 active:scale-[0.98] transition-transform"
        >
          <div className="w-10 h-10 rounded-lg bg-ifblue/10 flex items-center justify-center text-lg">
            🌍
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-semibold text-iftext">Live Earth View</p>
            <p className="text-[10px] text-ifmuted">Interactive 3D globe — NASA Blue Marble</p>
          </div>
          <span className="text-ifmuted text-xs">→</span>
        </button>

        {userId && (
          <button
            onClick={() => onNavigate?.("platforms")}
            className="w-full p-4 rounded-xl bg-ifcard border border-ifborder flex items-center gap-3 active:scale-[0.98] transition-transform"
          >
            <div className="w-10 h-10 rounded-lg bg-ifaccent/10 flex items-center justify-center text-lg">
              📡
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-semibold text-iftext">Connected Stations</p>
              <p className="text-[10px] text-ifmuted">Monitor and post to all crowdfunding platforms</p>
            </div>
            <span className="text-ifmuted text-xs">→</span>
          </button>
        )}
      </div>

      {/* Mission Brief */}
      <div className="card p-4">
        <h3 className="text-sm font-semibold text-iftext mb-2">Mission Brief</h3>
        <p className="text-xs text-ifmuted leading-relaxed">
          Interplanetary Fund is an AI-powered fundraising platform that unifies all your
          crowdfunding campaigns in one command center. Create campaigns with AI assistance,
          auto-generate content for every platform, and post to all connected stations with
          a single click. Every contribution gets us closer to orbit.
        </p>
      </div>

      {/* Footer */}
      <div className="text-center pt-2 pb-4">
        <p className="text-[10px] text-ifmuted">
          Fuel the mission. Every contribution gets us closer to orbit.
        </p>
        <p className="text-[9px] text-ifmuted mt-1">
          © 2026 Michelle Rogers. All Rights Reserved.
        </p>
      </div>
    </div>
  );
}
