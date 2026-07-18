import type { ProcessingMode } from "../types";

export type ServerProcessingEnv = {
  mode: ProcessingMode;
  wavespeedApiKey: string | null;
  elevenLabsApiKey: string | null;
  jobSigningSecret: string | null;
  realConfigured: boolean;
};

function readMode(raw: string | undefined): ProcessingMode {
  return raw?.trim().toLowerCase() === "real" ? "real" : "mock";
}

export function readServerProcessingEnv(
  env: NodeJS.ProcessEnv = process.env,
): ServerProcessingEnv {
  const mode = readMode(env.KAROKS_PROCESSING_MODE);
  const wavespeedApiKey = env.WAVESPEED_API_KEY?.trim() || null;
  const elevenLabsApiKey = env.ELEVENLABS_API_KEY?.trim() || null;
  const jobSigningSecret = env.KAROKS_JOB_SIGNING_SECRET?.trim() || null;
  const realConfigured = Boolean(
    wavespeedApiKey && elevenLabsApiKey && jobSigningSecret,
  );

  return {
    mode,
    wavespeedApiKey,
    elevenLabsApiKey,
    jobSigningSecret,
    realConfigured,
  };
}

export function requireRealProcessingConfig(
  env: ServerProcessingEnv = readServerProcessingEnv(),
): {
  wavespeedApiKey: string;
  elevenLabsApiKey: string;
  jobSigningSecret: string;
} {
  if (env.mode !== "real" || !env.realConfigured) {
    throw new ProcessingConfigError(
      "REAL_NOT_CONFIGURED",
      "Real processing is not configured.",
    );
  }

  return {
    wavespeedApiKey: env.wavespeedApiKey!,
    elevenLabsApiKey: env.elevenLabsApiKey!,
    jobSigningSecret: env.jobSigningSecret!,
  };
}

export class ProcessingConfigError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "ProcessingConfigError";
    this.code = code;
  }
}
