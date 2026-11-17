import type { ReactNode } from "react";
import Link from "next/link";
import { MixtapeMark } from "./MixtapeIcons";

export default function MixtapePageFrame({ children }: { children: ReactNode }) {
  return (
    <main id="mixtape-ui" className="mixtape-ui">
      <div className="mt-page">
        <header className="mt-header">
          <Link href="/" className="mt-brand" aria-label="Creative Mixtape home">
            <MixtapeMark />
            <span>MIXTAPE</span>
          </Link>
        </header>
        {children}
      </div>
    </main>
  );
}
