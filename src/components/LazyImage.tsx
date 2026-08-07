/*
 * Interplanetary Fund — Lazy Image Component
 * Copyright © 2026 Michelle Rogers. All Rights Reserved.
 */

import { useState, useRef, useEffect } from "react";

export default function LazyImage({
  src,
  alt,
  className = "",
  imgClassName = "",
  placeholder = "🪐",
}: {
  src?: string;
  alt: string;
  className?: string;
  imgClassName?: string;
  placeholder?: string;
}) {
  const [loaded, setLoaded] = useState(false);
  const [inView, setInView] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: "100px" }
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={`overflow-hidden ${className}`}>
      {inView && src ? (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          className={`transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"} ${imgClassName}`}
          onLoad={() => setLoaded(true)}
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-3xl bg-zinc-800">
          {placeholder}
        </div>
      )}
      {!loaded && inView && src && (
        <div className="absolute inset-0 bg-zinc-800 animate-pulse" />
      )}
    </div>
  );
}
