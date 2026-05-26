import Link from "next/link";
import { getCurrentCreator } from "../../../lib/auth";
import { listVoiceClones } from "../../../lib/stations";
import { isMosiConfigured } from "../../../lib/tts/mosi";
import VoiceClient from "./voice-client";

export const dynamic = "force-dynamic";

export default async function VoicePage() {
  const creator = await getCurrentCreator();
  if (!creator) {
    return (
      <main className="shell">
        <section className="hero">
          <div className="hero-copy">
            <h1>Sign in first</h1>
            <p>
              <Link className="button" href="/dashboard">Go to dashboard</Link>
            </p>
          </div>
        </section>
      </main>
    );
  }

  const clones = await listVoiceClones(creator.id);
  return <VoiceClient creator={creator} initialClones={clones} mosiAvailable={isMosiConfigured()} />;
}
