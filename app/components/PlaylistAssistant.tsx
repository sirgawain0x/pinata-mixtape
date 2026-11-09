"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import type { Mix, Track } from "../mixtape-app";
import type { MixInput } from "../../lib/mixtapes";
import DesignDialog from "./DesignDialog";
import { MixtapeIcon, MixtapeMark } from "./MixtapeIcons";

type Message = { role: "user" | "assistant"; content: string };
function editorDraft(input: MixInput): Partial<Mix> {
  return { ...input, tracks: (input.tracks ?? []).map((track): Track => ({
    title: track.title, artist: track.artist, releaseYear: track.releaseYear ?? "",
    duration: track.duration ?? "", bpm: track.bpm ?? "", energy: track.energy ?? "", moodTags: track.moodTags ?? [], sceneTags: track.sceneTags ?? [],
    notes: track.notes ?? "", musicbrainzId: track.musicbrainzId ?? "", musicbrainzUrl: track.musicbrainzUrl ?? "",
    youtubeUrl: track.youtubeUrl ?? "", listenUrl: track.listenUrl ?? "", creativeTvUrl: track.creativeTvUrl ?? "",
    embedSourceKind: track.embedSourceKind ?? "link_only", embedIframeUrl: track.embedIframeUrl ?? "",
    albumTitle: track.albumTitle, releaseDate: track.releaseDate
  })) };
}

export default function PlaylistAssistant({ signedIn, onClose, onForm, onReview }: {
  signedIn: boolean; onClose: () => void; onForm: () => void; onReview: (draft: Partial<Mix>) => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [prompt, setPrompt] = useState("");
  const [draft, setDraft] = useState<MixInput | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => () => abortRef.current?.abort(), []);
  useEffect(() => { if (messages.length) bottomRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }); }, [messages, busy]);
  async function send(event: FormEvent) {
    event.preventDefault();
    if (!prompt.trim() || busy) return;
    const next: Message[] = [...messages, { role: "user", content: prompt.trim() }];
    setMessages(next); setPrompt(""); setBusy(true); setError(""); setDraft(null);
    const controller = new AbortController(); abortRef.current = controller;
    try {
      const response = await fetch("/app/api/agent/create-playlist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: next.slice(-15) }), signal: controller.signal });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not reach the assistant.");
      setMessages([...next, { role: "assistant", content: data.reply }]); setDraft(data.draft);
    } catch (error) {
      if (!controller.signal.aborted) { setError((error as Error).message); setMessages(messages); setPrompt(next[next.length - 1].content); }
    } finally { if (!controller.signal.aborted) setBusy(false); }
  }
  return <DesignDialog title="Your mixtape starts here" onClose={onClose}>
    <div className="mt-assistant-intro"><MixtapeMark/><h3>WHAT’S YOUR SOUND?</h3><p className="mt-note">Tell me the mood, the artists, or the moment. We’ll find the tracks and shape a playlist together.</p></div>
    <div className="mt-conversation" aria-live="polite" aria-busy={busy}>
      {messages.map((message, index) => <p key={index} className={`mt-message ${message.role === "user" ? "mt-message-user" : ""}`}><span className="mt-sr-only">{message.role === "user" ? "You" : "Mixtape assistant"}: </span>{message.content}</p>)}
      {busy ? <p className="mt-note" role="status">Finding your sound…</p> : null}
    </div>
    {!signedIn ? <p className="mt-notice">Close this panel and sign in to create with the assistant, or explore the form below.</p> : null}
    <form className="mt-prompt-form" onSubmit={send}>
      <textarea aria-label="Message the playlist assistant" placeholder="A sunset soul playlist for a rooftop dinner…" value={prompt} onChange={(event) => setPrompt(event.target.value)} maxLength={4000} rows={2} disabled={busy || !signedIn}/>
      <button aria-label="Send message" type="submit" disabled={busy || !signedIn || !prompt.trim()}><MixtapeIcon name="arrow"/></button>
    </form>
    {error ? <p role="alert" className="mt-error">{error}</p> : null}
    {draft ? <section className="mt-draft-preview"><p className="mt-kicker">YOUR PLAYLIST DRAFT</p><h3>{draft.title}</h3><p className="mt-note">{[draft.genre, draft.creators?.join(" / ")].filter(Boolean).join(" · ")}</p>
      <ol>{draft.tracks?.map((track, index) => <li key={index}>{track.title} — {track.artist}{track.releaseYear ? ` (${track.releaseYear})` : ""}</li>)}</ol>
      <p className="mt-note">Check the matches and add playback links in the editor before saving.</p>
      <button className="mt-primary" onClick={() => onReview(editorDraft(draft))} type="button">Review playlist →</button>
    </section> : null}
    <p className="mt-note">AI suggestions can be imperfect. Track details are checked against MusicBrainz when available.</p>
    <div className="mt-assistant-actions"><button type="button" onClick={onForm}>Use the form instead ↗</button>{messages.length ? <button type="button" disabled={busy} onClick={() => { setMessages([]); setDraft(null); setError(""); }}>Start over</button> : null}</div>
    <div ref={bottomRef}/>
  </DesignDialog>;
}
