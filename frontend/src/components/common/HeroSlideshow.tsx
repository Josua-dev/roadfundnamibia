import { useState, useEffect } from 'react';

export interface SlideImage {
  url: string;
  credit: string; // photographer name, for the small attribution line
}

/**
 * Full-bleed auto-rotating background slideshow. Crossfades between
 * images on an interval; respects prefers-reduced-motion by just
 * showing the first image statically instead of rotating.
 */
export function HeroSlideshow({ images, intervalMs = 5500 }: { images: SlideImage[]; intervalMs?: number }) {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (images.length <= 1) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const id = setInterval(() => setCurrent(c => (c + 1) % images.length), intervalMs);
    return () => clearInterval(id);
  }, [images.length, intervalMs]);

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 0, overflow: 'hidden' }}>
      {images.map((img, i) => (
        <div
          key={img.url}
          style={{
            position: 'absolute', inset: 0,
            backgroundImage: `url(${img.url})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            opacity: i === current ? 1 : 0,
            transition: 'opacity 1.4s ease-in-out',
          }}
        />
      ))}
      {/* Dark scrim so heading/body text stays readable over any photo */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(115deg, rgba(20,28,38,0.94) 0%, rgba(20,28,38,0.85) 38%, rgba(20,28,38,0.68) 70%, rgba(20,28,38,0.58) 100%)',
      }} />
      <div style={{
        position: 'absolute', bottom: 10, right: 16,
        fontSize: '0.65rem', color: 'rgba(255,255,255,0.35)',
      }}>
        Photo: {images[current]?.credit} / Unsplash
      </div>
    </div>
  );
}
