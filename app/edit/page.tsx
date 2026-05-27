import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentCreator } from "../../lib/auth";

export const dynamic = "force-dynamic";

export default async function MixEditLandingPage() {
  const creator = await getCurrentCreator();
  if (!creator) {
    return (
      <main className="shell">
        <section className="hero">
          <div className="hero-copy">
            <h1>Sign in to edit</h1>
            <p className="muted">Connect your wallet from the home page to create and edit mixtapes.</p>
            <Link className="button" href="/">
              ← Back to crate
            </Link>
          </div>
        </section>
      </main>
    );
  }

  redirect("/?editor=new");
}
