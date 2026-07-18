import { createHmac, timingSafeEqual } from "node:crypto";

export type SeparationJobClaims = {
  v: 1;
  predictionId: string;
  filename: string;
  durationSeconds: number;
  exp: number;
};

export type JobTokenVerificationResult =
  | { ok: true; claims: SeparationJobClaims }
  | { ok: false; code: "INVALID_TOKEN" | "TOKEN_EXPIRED"; message: string };

const DEFAULT_TTL_SECONDS = 2 * 60 * 60;

function toBase64Url(value: Buffer | string): string {
  const buf = typeof value === "string" ? Buffer.from(value, "utf8") : value;
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromBase64Url(value: string): Buffer {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  return Buffer.from(padded + pad, "base64");
}

export function signSeparationJobToken(
  input: {
    predictionId: string;
    filename: string;
    durationSeconds: number;
    ttlSeconds?: number;
    nowSeconds?: number;
  },
  secret: string,
): string {
  if (!secret) {
    throw new Error("Missing job signing secret");
  }

  const now = input.nowSeconds ?? Math.floor(Date.now() / 1000);
  const claims: SeparationJobClaims = {
    v: 1,
    predictionId: input.predictionId,
    filename: input.filename,
    durationSeconds: input.durationSeconds,
    exp: now + (input.ttlSeconds ?? DEFAULT_TTL_SECONDS),
  };

  const payload = toBase64Url(JSON.stringify(claims));
  const signature = toBase64Url(
    createHmac("sha256", secret).update(payload).digest(),
  );
  return `${payload}.${signature}`;
}

export function verifySeparationJobToken(
  token: string,
  secret: string,
  options?: { nowSeconds?: number },
): JobTokenVerificationResult {
  if (!secret || typeof token !== "string" || !token.includes(".")) {
    return {
      ok: false,
      code: "INVALID_TOKEN",
      message: "This processing job token is invalid.",
    };
  }

  const [payload, signature] = token.split(".");
  if (!payload || !signature) {
    return {
      ok: false,
      code: "INVALID_TOKEN",
      message: "This processing job token is invalid.",
    };
  }

  const expected = toBase64Url(
    createHmac("sha256", secret).update(payload).digest(),
  );
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) {
    return {
      ok: false,
      code: "INVALID_TOKEN",
      message: "This processing job token is invalid.",
    };
  }

  let claims: SeparationJobClaims;
  try {
    const parsed = JSON.parse(fromBase64Url(payload).toString("utf8")) as unknown;
    if (!parsed || typeof parsed !== "object") {
      throw new Error("bad claims");
    }
    const raw = parsed as Record<string, unknown>;
    if (
      raw.v !== 1 ||
      typeof raw.predictionId !== "string" ||
      !raw.predictionId ||
      typeof raw.filename !== "string" ||
      typeof raw.durationSeconds !== "number" ||
      !Number.isFinite(raw.durationSeconds) ||
      typeof raw.exp !== "number"
    ) {
      throw new Error("bad claims");
    }
    claims = {
      v: 1,
      predictionId: raw.predictionId,
      filename: raw.filename,
      durationSeconds: raw.durationSeconds,
      exp: raw.exp,
    };
  } catch {
    return {
      ok: false,
      code: "INVALID_TOKEN",
      message: "This processing job token is invalid.",
    };
  }

  const now = options?.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (claims.exp < now) {
    return {
      ok: false,
      code: "TOKEN_EXPIRED",
      message: "This processing job has expired. Start again with your audio.",
    };
  }

  return { ok: true, claims };
}
