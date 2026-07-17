import { generateJwt } from "@coinbase/cdp-sdk/auth";
import { isAddress, getAddress } from "viem";
import { jsonError } from "../../../../lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const REQUEST_HOST = "api.cdp.coinbase.com";
const REQUEST_PATH = "/platform/v2/onramp/sessions";

export async function POST(request: Request) {
  const apiKeyId = process.env.CDP_API_KEY_ID;
  const apiKeySecret = process.env.CDP_API_KEY_SECRET;
  if (!apiKeyId || !apiKeySecret) {
    return jsonError("Coinbase CDP is not configured (CDP_API_KEY_ID / CDP_API_KEY_SECRET).", 500);
  }

  const body = await request.json().catch(() => null);
  const destinationAddress =
    typeof body?.destinationAddress === "string" ? body.destinationAddress.trim() : "";
  if (!isAddress(destinationAddress)) {
    return jsonError("destinationAddress must be a valid address.", 400);
  }

  const paymentAmount =
    typeof body?.paymentAmount === "string" && body.paymentAmount.trim()
      ? body.paymentAmount.trim()
      : undefined;
  const redirectUrl =
    typeof body?.redirectUrl === "string" && body.redirectUrl.trim()
      ? body.redirectUrl.trim()
      : undefined;

  try {
    const jwt = await generateJwt({
      apiKeyId,
      apiKeySecret,
      requestMethod: "POST",
      requestHost: REQUEST_HOST,
      requestPath: REQUEST_PATH
    });

    const payload: Record<string, string> = {
      purchaseCurrency: "USDC",
      destinationNetwork: "base",
      destinationAddress: getAddress(destinationAddress)
    };
    if (paymentAmount) {
      payload.paymentAmount = paymentAmount;
      payload.paymentCurrency = "USD";
    }
    if (redirectUrl) payload.redirectUrl = redirectUrl;

    const response = await fetch(`https://${REQUEST_HOST}${REQUEST_PATH}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jwt}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = (await response.json().catch(() => null)) as {
      session?: { onrampUrl?: string };
      errorMessage?: string;
      errorType?: string;
      message?: string;
    } | null;

    if (!response.ok) {
      const message =
        data?.errorMessage || data?.message || data?.errorType || `CDP onramp error (${response.status})`;
      return jsonError(message, response.status >= 400 && response.status < 600 ? response.status : 502);
    }

    const onrampUrl = data?.session?.onrampUrl;
    if (!onrampUrl) return jsonError("CDP did not return an onramp URL.", 502);

    return Response.json({ onrampUrl });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create onramp session.";
    return jsonError(message, 500);
  }
}
