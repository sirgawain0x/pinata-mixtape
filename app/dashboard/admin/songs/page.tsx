import AdminSongsClient from "./admin-songs-client";

export const dynamic = "force-dynamic";

export default function AdminSongsPage() {
  return (
    <main className="shell">
      <section className="hero">
        <div className="hero-copy">
          <p className="hero-mark">
            <span>Admin</span>
          </p>
          <h1>Competition song audio</h1>
          <p className="lede">
            Upload Pinata-hosted audio for curated competition entries. Requires{" "}
            <code>MIXTAPE_WRITE_TOKEN</code>.
          </p>
        </div>
      </section>
      <section className="workspace">
        <AdminSongsClient />
      </section>
    </main>
  );
}
