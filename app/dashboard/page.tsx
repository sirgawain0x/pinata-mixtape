import Link from "next/link";
import { getCurrentCreator } from "../../lib/auth";
import { listStations } from "../../lib/stations";
import DashboardClient from "./dashboard-client";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const creator = await getCurrentCreator();
  if (!creator) {
    return (
      <main className="shell">
        <section className="hero">
          <div className="hero-copy">
            <p className="hero-mark"><span>Influencer Radio</span></p>
            <h1>Sign in to host a station</h1>
            <p className="lede">
              Sign in with your wallet to claim a handle and start broadcasting music, voice updates, news, and podcast
              episodes from one continuous radio feed.
            </p>
            <p>
              <Link className="button" href="/">← Back to the public crate</Link>
            </p>
          </div>
        </section>
      </main>
    );
  }

  const stations = await listStations({ creatorId: creator.id });
  return <DashboardClient creator={creator} initialStations={stations} />;
}
