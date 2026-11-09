import type { CSSProperties } from "react";
import Image from "next/image";

export function MixtapeMark({ small = false }: { small?: boolean }) {
  return <span className={`mt-mark ${small ? "mt-mark-small" : ""}`} aria-hidden="true">
    <Image src="/app/mixtape/mark.png" width={55} height={45} alt="" />
    <Image src="/app/mixtape/mark.png" width={55} height={45} alt="" />
  </span>;
}

export function MixtapeIcon({ name }: { name: "playlist" | "post" | "track" | "search" | "arrow" | "live" }) {
  return <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {name === "playlist" ? <><rect x="4" y="4" width="17" height="17" rx="2"/><rect x="27" y="4" width="17" height="17" rx="2"/><rect x="4" y="27" width="17" height="17" rx="2"/><rect x="27" y="27" width="17" height="17" rx="2"/><path d="M35.5 8v9M31 12.5h9M8 32h9M8 37h9"/></> : null}
    {name === "post" ? <><path d="m3 15 42-10-14 38-10-16L3 15Zm18 12L45 5M21 27l-2 13 8-7"/></> : null}
    {name === "track" ? <><rect x="4" y="6" width="40" height="36" rx="3"/><path d="M12 32h3m-3-7h3m6 7h3m-3-7h3m-3-7h3m6 14h3m-3-7h3m-3-7h3m-3-7h3" strokeWidth="3"/></> : null}
    {name === "search" ? <><circle cx="20" cy="20" r="12"/><path d="m29 29 12 12"/></> : null}
    {name === "arrow" ? <path d="M7 24h33M27 11l13 13-13 13"/> : null}
    {name === "live" ? <><circle cx="24" cy="24" r="4"/><path d="M15 15a13 13 0 0 0 0 18m18-18a13 13 0 0 1 0 18M9 8a22 22 0 0 0 0 32M39 8a22 22 0 0 1 0 32"/></> : null}
  </svg>;
}

/** Original typography-based covers for playlists without uploaded artwork. */
export function PlaylistArt({ title, id, compact = false }: { title: string; id: number; compact?: boolean }) {
  const hue = ((id * 67) % 360);
  return <span className={`mt-art ${compact ? "mt-art-compact" : ""}`} style={{ "--cover-hue": hue } as CSSProperties} aria-hidden="true">
    <span className="mt-art-rings"/><span className="mt-art-letter">{title.slice(0, 1).toUpperCase()}</span>
    <span className="mt-art-label">CREATIVE<br/>MIXTAPE</span>
  </span>;
}
