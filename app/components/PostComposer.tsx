"use client";

import { useEffect, useState } from "react";
import type { Mix } from "../mixtape-app";
import { publicPlaylistShareUrl, shareableOrigin, socialComposerUrl, socialPostText, type SocialPlatform } from "../../lib/social-composer";
import {
  LENS_POST_MAX_CHARACTERS,
  isLensFinalPostWithinLimit,
  lensFinalPostLength,
  maxLensTextareaCharacters,
} from "../../lib/lens-post-content";
import { useLensPublishing } from "../hooks/useLensPublishing";
import LensAccountPicker from "./LensAccountPicker";
import DesignDialog from "./DesignDialog";

export default function PostComposer({ mixes, initialMixId, onClose }: {
  mixes: Mix[];
  initialMixId?: number;
  onClose: () => void;
}) {
  const lens = useLensPublishing();
  const [platform, setPlatform] = useState<SocialPlatform>("x");
  const [text, setText] = useState("");
  const [mixId, setMixId] = useState(initialMixId ? String(initialMixId) : "");
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState("");
  const [opened, setOpened] = useState<SocialPlatform | null>(null);
  useEffect(() => { setOrigin(window.location.origin); }, []);
  const publicMixes = mixes.filter((mix) => mix.isPublic);
  const selected = publicMixes.find((mix) => String(mix.id) === mixId);
  const playlistUrl = selected ? publicPlaylistShareUrl(selected, origin) : null;
  const postText = platform === "lens" && lens.pendingHash ? lens.pendingContent : socialPostText(text, playlistUrl);
  const finalPostLength = lensFinalPostLength(text, playlistUrl);
  const postWithinLimit = isLensFinalPostWithinLimit(text, playlistUrl);
  const textareaMaxLength = maxLensTextareaCharacters(playlistUrl);
  const canContinue = Boolean(postText.trim()) && postWithinLimit;
  const publicOrigin = shareableOrigin(origin);
  const destinationName = platform === "x" ? "X / Twitter" : "Lens";
  const composeUrl = socialComposerUrl(platform, text, playlistUrl);

  async function copyPost() {
    try { await navigator.clipboard.writeText(postText); setCopied("Post copied. You can paste it into either composer."); }
    catch { setCopied("Could not copy. Select and copy your text from the preview."); }
  }

  return <DesignDialog title="Share what moves you" onClose={() => { if (!lens.busy) onClose(); }} className="mt-post-dialog">
    <p className="mt-note">Write your post and publish to Lens here, or share it on X / Twitter.</p>
    <fieldset className="mt-social-platforms"><legend>Post to</legend>
      <label className={platform === "x" ? "mt-platform mt-platform-selected" : "mt-platform"}>
        <input type="radio" name="social-platform" value="x" checked={platform === "x"} onChange={() => { setPlatform("x"); setOpened(null); }}/>
        <span className="mt-platform-symbol" aria-hidden="true">𝕏</span><span><strong>X / Twitter</strong><small>Primary</small></span>
      </label>
      <label className={platform === "lens" ? "mt-platform mt-platform-selected" : "mt-platform"}>
        <input type="radio" name="social-platform" value="lens" checked={platform === "lens"} onChange={() => { setPlatform("lens"); setOpened(null); }}/>
        <span className="mt-platform-symbol mt-lens-symbol" aria-hidden="true">◉</span><span><strong>Lens</strong><small>Publish inside Mixtape</small></span>
      </label>
    </fieldset>
    <label className="mt-post-field">Your post
      <textarea disabled={lens.busy || Boolean(lens.pendingHash)} data-dialog-autofocus rows={5} maxLength={textareaMaxLength} placeholder="What’s on your rotation?" value={text}
        onChange={(event) => { setText(event.target.value); setOpened(null); setCopied(""); }}/>
    </label>
    <div className="mt-post-length">
      <span>{finalPostLength.toLocaleString()} / {LENS_POST_MAX_CHARACTERS.toLocaleString()} characters in final post</span>
      {!postWithinLimit ? <span>Shorten your post{playlistUrl ? " or remove the playlist" : ""} to publish.</span> : <span>Playlist links count toward the Lens limit.</span>}
    </div>
    <label className="mt-post-field">Attach a public playlist <span className="mt-post-optional">Optional</span>
      <select value={mixId} disabled={!publicOrigin || lens.busy || Boolean(lens.pendingHash)} onChange={(event) => { setMixId(event.target.value); setOpened(null); setCopied(""); }}>
        <option value="">No playlist</option>
        {publicMixes.map((mix) => <option key={mix.id} value={mix.id}>{mix.title}</option>)}
      </select>
    </label>
    {!publicOrigin ? <p className="mt-note">Playlist links can be attached from your deployed Mixtape site. You can still share text from this local preview.</p> : null}
    <section className="mt-post-preview" aria-label="Post preview"><p className="mt-kicker">PREVIEW</p>
      <p>{postText || "Your words, your sound. Write something above to get started."}</p>
    </section>
    {platform === "lens" ? <section aria-label="Lens publishing">
      <LensAccountPicker lens={lens} locked={Boolean(lens.pendingHash)}/>
      <div className="mt-post-actions"><button type="button" className="mt-primary" disabled={!canContinue || (!lens.account && !lens.pendingHash) || lens.busy || Boolean(lens.publishedId)} onClick={() => void lens.publish(postText)}>
        {lens.busy ? "Working…" : lens.publishedId ? "Published" : lens.pendingHash ? "Check confirmation" : "Publish to Lens"}
      </button></div>
      {lens.status ? <p role="status" className="mt-note mt-post-status">{lens.status}</p> : null}
      {lens.publishedId ? <p className="mt-note">Post ID: {lens.publishedId}</p> : null}
    </section> : <>
      <p className="mt-note">Opens X / Twitter for you to review and publish. Direct X publishing requires a connected X account.</p>
      <div className="mt-post-actions">
        <button type="button" disabled={!canContinue} onClick={() => void copyPost()}>Copy post</button>
        {canContinue ? <a className="mt-primary" href={composeUrl} target="_blank" rel="noopener noreferrer" onClick={() => setOpened(platform)}>Continue to {destinationName} ↗</a>
          : <button type="button" className="mt-primary" disabled>Continue to {destinationName} ↗</button>}
      </div>
    </>}
    {copied ? <p className="mt-note mt-post-status" role="status">{copied}</p> : null}
    {opened ? <p className="mt-note mt-post-status" role="status">Finish publishing in {opened === "x" ? "X / Twitter" : "Lens via Hey"}. Your draft remains here; opening a composer does not publish it.</p> : null}
  </DesignDialog>;
}
