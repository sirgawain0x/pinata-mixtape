import { isAddress, verifyMessage } from "viem";
import { evmAddress } from "@lens-protocol/client";
import { fetchAccountsAvailable } from "@lens-protocol/client/actions";
import { getCurrentCreator, withCreator, jsonError } from "../../../../lib/auth";
import { requireSignedInForLensAccountLookup } from "../../../../lib/lens-account-access";
import { sqlGet, sqlRun } from "../../../../lib/sql-bridge";
import { lensClient } from "../../../../lib/lens-client";
import { rateLimitHit } from "../../../../lib/rate-limit";

export async function GET(request: Request) {
  const viewer = await getCurrentCreator();
  const authError = requireSignedInForLensAccountLookup(Boolean(viewer));
  if (authError) return jsonError(authError.message, authError.status);
  const creatorId = Number(new URL(request.url).searchParams.get("creator"));
  if (!Number.isSafeInteger(creatorId) || creatorId < 1) return jsonError("Invalid creator.", 400);
  const row = await sqlGet<{ account: string }>("SELECT account FROM creator_lens_accounts WHERE creator_id = ?", [creatorId]);
  return Response.json({ account: row?.account || null });
}

export async function POST(request: Request) {
  return withCreator(async (creator) => {
    if (!rateLimitHit(`lens-link:${creator.id}`, 12, 60_000)) return jsonError("Please wait before trying again.", 429);
    const raw = await request.text();
    if (raw.length > 5000) return jsonError("Invalid link request.", 413);
    let input;
    try { input = JSON.parse(raw); } catch { return jsonError("Invalid link request.", 400); }
    if (!isAddress(input?.account || "") || !isAddress(input?.signer || "")) return jsonError("Invalid account or signer.", 400);
    if (!input.signature) {
      const message = `Link Lens account to Creative Mixtape\nCreator: ${creator.id}\nLens account: ${input.account.toLowerCase()}\nWallet: ${input.signer.toLowerCase()}\nNonce: ${crypto.randomUUID()}`;
      await sqlRun("INSERT INTO creator_lens_challenges (creator_id, message, expires_at) VALUES (?, ?, ?) ON CONFLICT(creator_id) DO UPDATE SET message = excluded.message, expires_at = excluded.expires_at", [creator.id, message, Date.now() + 300_000]);
      return Response.json({ message });
    }
    const challenge = await sqlGet<{ message: string; expires_at: number }>("SELECT message, expires_at FROM creator_lens_challenges WHERE creator_id = ?", [creator.id]);
    const message = challenge && challenge.expires_at > Date.now() ? challenge.message : undefined;
    if (!message || !message.startsWith(`Link Lens account to Creative Mixtape\nCreator: ${creator.id}\nLens account: ${input.account.toLowerCase()}\nWallet: ${input.signer.toLowerCase()}\nNonce: `)) return jsonError("Link request expired. Try again.", 400);
    if (typeof input.signature !== "string" || !/^0x[0-9a-f]+$/i.test(input.signature) || !await verifyMessage({ address: input.signer, message, signature: input.signature as `0x${string}` })) return jsonError("Wallet signature could not be verified.", 403);
    const available = await fetchAccountsAvailable(lensClient, { managedBy: evmAddress(input.signer), includeOwned: true });
    if (available.isErr()) return jsonError("Could not verify Lens account access.", 502);
    if (!available.value.items.some((item) => item.account.address.toLowerCase() === input.account.toLowerCase())) return jsonError("This wallet does not manage the selected Lens account.", 403);
    const consumed = await sqlRun("DELETE FROM creator_lens_challenges WHERE creator_id = ? AND message = ? AND expires_at > ?", [creator.id, message, Date.now()]);
    if (consumed.changes !== 1) return jsonError("Link request expired. Try again.", 400);
    await sqlRun("INSERT INTO creator_lens_accounts (creator_id, account) VALUES (?, ?) ON CONFLICT(creator_id) DO UPDATE SET account = excluded.account", [creator.id, input.account.toLowerCase()]);
    return Response.json({ account: input.account });
  });
}
