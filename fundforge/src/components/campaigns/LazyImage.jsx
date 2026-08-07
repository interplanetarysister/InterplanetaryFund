import { useState } from 'react';
import { cn } from '@/lib/utils';

export default function LazyImage({ src, alt, className, imgClassName }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <div className={cn('relative overflow-hidden bg-white/[0.03]', className)}>
      {!loaded && <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-white/[0.05] to-white/[0.02]" />}
      {src && (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          onLoad={() => setLoaded(true)}
          className={cn('h-full w-full object-cover transition-opacity duration-500', loaded ? 'opacity-100' : 'opacity-0', imgClassName)}
        />
      )}
    </div>
  );
}