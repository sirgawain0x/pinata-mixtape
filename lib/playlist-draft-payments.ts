import { createHash, randomUUID } from "node:crypto";
import type { PaymentRequirements, SettleResponse } from "@x402/core/types";
import { sqlGet, sqlRun } from "./sql-bridge";

type Status = "generating" | "declined" | "ready" | "settling" | "paid";

export type DraftPayment = {
  id: string;
  request_hash: string;
  authorization_id: string;
  proof_hash: string;
  payer: string;
  requirements: string;
  status: Status;
  lease_until: number;
  lease_token: string;
  draft: string | null;
  settlement: string | null;
  settlement_block: string | null;
};

export function paymentHash(...parts: string[]): string {
  return createHash("sha256").update(JSON.stringify(parts)).digest("hex");
}

export async function findDraftPayment(id: string): Promise<DraftPayment | undefined> {
  return sqlGet<DraftPayment>("SELECT * FROM playlist_draft_payments WHERE id = ?", [id]);
}

export async function reserveDraftPayment(payment: {
  id: string;
  requestHash: string;
  authorizationId: string;
  proofHash: string;
  payer: string;
  requirements: PaymentRequirements;
}): Promise<DraftPayment | undefined> {
  const leaseToken = randomUUID();
  const result = await sqlRun(
    `INSERT INTO playlist_draft_payments
       (id, request_hash, authorization_id, proof_hash, payer, requirements, status, lease_until, lease_token)
     VALUES (?, ?, ?, ?, ?, ?, 'generating', ?, ?) ON CONFLICT DO NOTHING`,
    [payment.id, payment.requestHash, payment.authorizationId, payment.proofHash, payment.payer,
      JSON.stringify(payment.requirements), Date.now() + 120_000, leaseToken]
  );
  if (result.changes === 0) return undefined;
  return findDraftPayment(payment.id);
}

export async function claimDraftPayment(payment: DraftPayment, status: "generating" | "settling") {
  const now = Date.now();
  const leaseToken = randomUUID();
  const result = await sqlRun(
    `UPDATE playlist_draft_payments SET status = ?, lease_until = ?, lease_token = ?
     WHERE id = ? AND status = ? AND lease_token = ? AND lease_until <= ?`,
    [status, now + (status === "generating" ? 120_000 : 45_000), leaseToken,
      payment.id, payment.status, payment.lease_token, now]
  );
  return result.changes === 1 ? { ...payment, status, lease_token: leaseToken } : undefined;
}

export async function releaseDraftPayment(payment: DraftPayment, delay = 0) {
  await sqlRun(
    "UPDATE playlist_draft_payments SET lease_until = ? WHERE id = ? AND status = ? AND lease_token = ?",
    [Date.now() + delay, payment.id, payment.status, payment.lease_token]
  );
}

export async function saveGeneratedDraft(payment: DraftPayment, draft: unknown | null) {
  const result = await sqlRun(
    `UPDATE playlist_draft_payments SET draft = ?, status = ?, lease_until = 0
     WHERE id = ? AND status = 'generating' AND lease_token = ?`,
    [draft === null ? null : JSON.stringify(draft), draft === null ? "declined" : "ready",
      payment.id, payment.lease_token]
  );
  return result.changes === 1 ? findDraftPayment(payment.id) : undefined;
}

export async function saveDraftSettlement(payment: DraftPayment, settlement: SettleResponse, confirmed: boolean) {
  const result = await sqlRun(
    `UPDATE playlist_draft_payments SET settlement = ?, status = ?, lease_until = ?
     WHERE id = ? AND status = 'settling' AND lease_token = ?`,
    [JSON.stringify(settlement), confirmed ? "paid" : "settling", Date.now() + 5000,
      payment.id, payment.lease_token]
  );
  return result.changes === 1 ? findDraftPayment(payment.id) : undefined;
}

export async function recordSettlementStart(payment: DraftPayment, block: bigint): Promise<boolean> {
  const result = await sqlRun(
    `UPDATE playlist_draft_payments SET settlement_block = ?
     WHERE id = ? AND status = 'settling' AND lease_token = ? AND settlement_block IS NULL`,
    [String(block), payment.id, payment.lease_token]
  );
  return result.changes === 1;
}
