import { publicRecordingUrl } from "../../lib/recording-links";

export default function StreamingAppLinks({ appleMusic, spotify, inlinePlayerUrl }: {
  appleMusic?: string;
  spotify?: string;
  inlinePlayerUrl?: string;
}) {
  const showAppleMusic = appleMusic && publicRecordingUrl(inlinePlayerUrl)?.hostname !== "embed.music.apple.com";
  if (!showAppleMusic && !spotify) return null;

  return (
    <div className="streaming-app-links" role="group" aria-label="Open in a streaming app">
      {showAppleMusic ? (
        <a href={appleMusic} target="_blank" rel="noopener noreferrer">
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor">
            <path d="M10 5v11a3.5 3.5 0 1 0 2 3.16V9l7-1.5V14a3.5 3.5 0 1 0 2 3.16V2.7L10 5Z"/>
          </svg>
          Apple Music
        </a>
      ) : null}
      {spotify ? (
        <a href={spotify} target="_blank" rel="noopener noreferrer">
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="11" fill="currentColor"/>
            <path d="M6 9c4.6-1.3 8.4-.6 12 1.3M7 12.4c3.6-.9 6.7-.4 9.7 1.2M8 15.6c2.8-.6 5-.2 7.5 1" stroke="var(--streaming-icon-cutout, #191e31)" strokeWidth="1.6" strokeLinecap="round"/>
          </svg>
          Spotify
        </a>
      ) : null}
    </div>
  );
}
