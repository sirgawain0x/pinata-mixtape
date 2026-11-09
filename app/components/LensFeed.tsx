"use client";

import { useEffect, useState } from "react";
import { evmAddress, PageSize } from "@lens-protocol/client";
import { fetchPosts } from "@lens-protocol/client/actions";
import { useLensPublishing } from "../hooks/useLensPublishing";
import LensAccountPicker from "./LensAccountPicker";
import DesignDialog from "./DesignDialog";
import { MIXTAPE_LENS } from "../../lib/lens-config";

type FeedPost = { id: string; author: string; authorAddress: string; upvotes: number; hyped: boolean; content: string; timestamp: string };

export default function LensFeed({ refreshKey = 0, creatorId }: { refreshKey?: number; creatorId?: number }) {
  const lens = useLensPublishing();
  const [revision, setRevision] = useState(0);
  const [editing, setEditing] = useState<FeedPost | null>(null);
  const [editText, setEditText] = useState("");
  const [deleting, setDeleting] = useState<FeedPost | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [status, setStatus] = useState("Loading posts…");
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        let author: string | null = null;
        if (creatorId) {
          const linked = await fetch(`/app/api/lens/account?creator=${creatorId}`);
          if (!linked.ok) throw new Error("Could not load linked Lens account.");
          author = (await linked.json()).account;
          if (!author) { if (!cancelled) { setPosts([]); setStatus("No Lens account linked yet."); } return; }
        }
        const result = await fetchPosts(lens.readClient, { filter: { ...(author ? { authors: [evmAddress(author)] } : {}), feeds: [{ feed: evmAddress(MIXTAPE_LENS.feed) }] }, pageSize: PageSize.Ten });
        if (cancelled) return;
        if (result.isErr()) throw result.error;
        setPosts(result.value.items.flatMap((item) => {
          if (item.__typename !== "Post") return [];
          const content = item.metadata && "content" in item.metadata ? item.metadata.content : null;
          return content ? [{ id: item.id, author: item.author.username?.value || item.author.address, authorAddress: item.author.address, upvotes: item.stats.upvotes, hyped: item.operations?.hasUpvoted || false, content, timestamp: item.timestamp }] : [];
        }));
        setStatus("");
      } catch { if (!cancelled) setStatus("Posts could not load. Try refreshing shortly."); }
    })();
    return () => { cancelled = true; };
  }, [refreshKey, creatorId, revision, lens.readClient]);
  async function act(post: FeedPost, action: "edit" | "delete" | "hype" | "unhype") {
    if (await lens.act(post.id, action, action === "edit" ? editText : undefined)) {
      setEditing(null); setDeleting(null); setRevision((value) => value + 1);
    }
  }
  return <section className="mt-section" aria-labelledby="lens-posts-heading">
    <div className="mt-section-heading"><h2 id="lens-posts-heading">POSTS</h2><button type="button" onClick={() => setAccountOpen((value) => !value)} aria-expanded={accountOpen}>Lens account</button></div>
    {accountOpen ? <LensAccountPicker lens={lens} locked={Boolean(lens.pendingChange)}/> : null}
    {lens.pendingChange ? <button type="button" disabled={lens.busy} onClick={async () => {
      if (lens.pendingChange && await lens.act(lens.pendingChange.id, lens.pendingChange.action)) { setEditing(null); setDeleting(null); setRevision((value) => value + 1); }
    }}>Check submitted change</button> : null}
    {lens.status ? <p role="status" className="mt-note">{lens.status}</p> : null}
    {status ? <p className="mt-note" role="status">{status}</p> : !posts.length ? <p className="mt-empty-copy">Start the conversation. Share what’s on your rotation.</p> : null}
    <div className="mt-lens-posts">{posts.map((post) => <article key={post.id} className="mt-lens-post">
      <strong>{post.author}</strong><time dateTime={post.timestamp}>{new Date(post.timestamp).toLocaleDateString()}</time>
      <p>{post.content}</p>
      <div className="mt-post-actions">
        <button type="button" aria-pressed={post.hyped} disabled={lens.busy} onClick={() => { if (!lens.account) { setAccountOpen(true); void lens.findAccounts(); } else void act(post, post.hyped ? "unhype" : "hype"); }}>♡ {post.hyped ? "Hyped" : "Hype"} · {post.upvotes}</button>
        {lens.account.toLowerCase() === post.authorAddress.toLowerCase() ? <>
          <button type="button" disabled={lens.busy} onClick={() => { setEditing(post); setEditText(post.content); }}>Edit</button>
          <button type="button" disabled={lens.busy} onClick={() => setDeleting(post)}>Delete</button>
        </> : null}
      </div>
    </article>)}</div>
    {editing ? <DesignDialog title="Edit your post" onClose={() => { if (!lens.busy) setEditing(null); }}>
      <label className="mt-post-field">Your post<textarea data-dialog-autofocus rows={6} maxLength={4000} disabled={lens.busy} value={editText} onChange={(event) => setEditText(event.target.value)}/></label>
      <button type="button" className="mt-primary" disabled={lens.busy || !editText.trim()} onClick={() => void act(editing, "edit")}>{lens.busy ? "Saving…" : "Save changes"}</button>
      {lens.status ? <p role="status" className="mt-note">{lens.status}</p> : null}
    </DesignDialog> : null}
    {deleting ? <DesignDialog title="Delete this post?" onClose={() => { if (!lens.busy) setDeleting(null); }}>
      <p>This removes the post from the Lens feed. Public metadata may remain on IPFS.</p>
      <button type="button" disabled={lens.busy} onClick={() => void act(deleting, "delete")}>{lens.busy ? "Deleting…" : "Delete post"}</button>
      {lens.status ? <p role="status" className="mt-note">{lens.status}</p> : null}
    </DesignDialog> : null}
  </section>;
}
