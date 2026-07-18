import { readServerProcessingEnv } from "@/lib/processing/server/env";

export const runtime = "nodejs";

export async function GET() {
  const env = readServerProcessingEnv();
  return Response.json({
    mode: env.mode,
    realConfigured: env.realConfigured,
  });
}
