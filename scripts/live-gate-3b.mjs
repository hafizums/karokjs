/**
 * Phase 3B live gate — one short authorized run.
 * Never logs secrets, auth headers, or provider URLs.
 */
import { chromium } from "playwright";
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const BASE = "http://localhost:3000";
const outDir = join(process.cwd(), "docs", "live-gate");
mkdirSync(outDir, { recursive: true });

const report = {
  config: null,
  network: {
    browserRequests: [],
    separationPosts: 0,
    separationPolls: 0,
    transcriptionPosts: 0,
    instrumentalGets: 0,
    providerHostHits: 0,
    keyLikeQueryOrHeader: false,
  },
  stages: [],
  completed: false,
  editorLoaded: false,
  instrumentalReadyState: null,
  lyricHighlightObserved: false,
  reloadRestored: false,
  transcriptionRetryWithoutExtraSeparation: false,
  errors: [],
};

function summarizeUrl(url) {
  try {
    const u = new URL(url);
    return `${u.origin}${u.pathname}`;
  } catch {
    return "[invalid-url]";
  }
}

function looksLikeKeyLeak(url, headers) {
  const blob = `${url} ${JSON.stringify(headers || {})}`.toLowerCase();
  return (
    blob.includes("xi-api-key") ||
    blob.includes("wavespeed_api_key") ||
    blob.includes("elevenlabs_api_key") ||
    blob.includes("authorization: bearer") ||
    /sk-[a-z0-9]{20,}/i.test(blob)
  );
}

const profileDir = join(outDir, "chromium-profile");
mkdirSync(profileDir, { recursive: true });
const context = await chromium.launchPersistentContext(profileDir, {
  headless: true,
  viewport: { width: 1440, height: 900 },
});
const page = context.pages()[0] || (await context.newPage());

page.on("request", (req) => {
  const url = req.url();
  const headers = req.headers();
  const pathOnly = summarizeUrl(url);
  report.network.browserRequests.push({
    method: req.method(),
    path: pathOnly,
  });

  if (looksLikeKeyLeak(url, headers)) {
    report.network.keyLikeQueryOrHeader = true;
  }

  if (/api\.wavespeed\.ai|api\.elevenlabs\.io/i.test(url)) {
    report.network.providerHostHits += 1;
  }

  if (url.includes("/api/processing/separation") && req.method() === "POST") {
    report.network.separationPosts += 1;
  }
  if (url.includes("/api/processing/separation?") && req.method() === "GET") {
    report.network.separationPolls += 1;
  }
  if (url.includes("/api/processing/transcription") && req.method() === "POST") {
    report.network.transcriptionPosts += 1;
  }
  if (url.includes("/api/processing/instrumental") && req.method() === "GET") {
    report.network.instrumentalGets += 1;
  }
});

let failTranscriptionOnce = true;
await page.route("**/api/processing/transcription", async (route) => {
  if (failTranscriptionOnce && route.request().method() === "POST") {
    failTranscriptionOnce = false;
    await route.fulfill({
      status: 502,
      contentType: "application/json",
      body: JSON.stringify({
        error: {
          code: "PROVIDER_FAILED",
          message: "Simulated transient transcription failure for retry gate.",
          stage: "transcribing",
          retryable: true,
        },
      }),
    });
    return;
  }
  await route.continue();
});

try {
  await page.goto(`${BASE}/create`, { waitUntil: "networkidle" });
  await page.waitForFunction(() =>
    document.body.innerText.includes("WaveSpeed"),
  );

  const config = await page.evaluate(async () => {
    const res = await fetch("/api/processing/config", { cache: "no-store" });
    return res.json();
  });
  report.config = {
    mode: config.mode,
    realConfigured: Boolean(config.realConfigured),
  };
  if (config.mode !== "real" || !config.realConfigured) {
    throw new Error(`Config not ready for live gate: ${JSON.stringify(report.config)}`);
  }

  // Short spoken fixture (~9s) generated locally for the authorized live gate.
  const speechPath = join(process.cwd(), "docs", "fixtures", "live-gate-speech.wav");
  const speechBase64 = readFileSync(speechPath).toString("base64");
  await page.evaluate(async (base64) => {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    const file = new File([bytes], "live-gate-speech.wav", {
      type: "audio/wav",
    });
    window.__karoksSelectFile(file);
  }, speechBase64);

  await page.waitForFunction(() =>
    document.body.innerText.includes("live-gate-speech.wav"),
  );

  // Check both consents
  const checks = page.locator('input[type="checkbox"]');
  await checks.nth(0).check();
  await checks.nth(1).check();
  await page.getByRole("button", { name: "Start processing" }).click();

  // Wait for simulated transcription failure
  await page.waitForFunction(
    () => document.body.innerText.includes("Retry"),
    null,
    { timeout: 10 * 60 * 1000 },
  );
  const postsAfterFail = report.network.separationPosts;
  report.stages.push("failed_transcribing_once");

  await page.getByRole("button", { name: "Retry" }).click();

  await page.waitForFunction(
    () => document.body.innerText.includes("Karaoke ready"),
    null,
    { timeout: 10 * 60 * 1000 },
  );
  report.completed = true;
  report.stages.push("completed");
  report.transcriptionRetryWithoutExtraSeparation =
    report.network.separationPosts === postsAfterFail &&
    report.network.separationPosts === 1 &&
    report.network.transcriptionPosts >= 2;

  await page.screenshot({
    path: join(outDir, "completed-desktop.png"),
    fullPage: false,
  });

  await page.getByRole("link", { name: "Open generated result" }).click();
  await page.waitForURL("**/karaoke/result/edit");
  await page.waitForFunction(
    () => !document.body.innerText.includes("Generated result unavailable"),
    null,
    { timeout: 15000 },
  );
  report.editorLoaded = true;

  // Preview tab for playback / highlighting
  const previewTab = page.getByRole("tab", { name: "Preview" });
  if (await previewTab.count()) {
    await previewTab.click();
  }

  await page.waitForSelector("audio", { state: "attached", timeout: 15000 });
  const audioInfo = await page.evaluate(async () => {
    const audio = document.querySelector("audio");
    if (!audio) return { error: "no-audio" };
    audio.muted = true;
    const playResult = await audio.play().then(
      () => "played",
      (e) => `play-error:${e?.name || "unknown"}`,
    );
    await new Promise((r) => {
      if (audio.readyState >= 2) r();
      else audio.addEventListener("loadeddata", () => r(), { once: true });
      setTimeout(r, 4000);
    });
    if (Number.isFinite(audio.duration) && audio.duration > 0.5) {
      audio.currentTime = Math.min(1.2, Math.max(0.3, audio.duration * 0.25));
    }
    await new Promise((r) => setTimeout(r, 1000));
    const words = document.querySelectorAll(
      ".lyric-word, [data-word-id], .karaoke-word, .karaoke-line span",
    );
    const active =
      document.querySelector(
        "[data-active-word], .lyric-word.is-active, .is-current-word, .word.is-active",
      ) ||
      document.querySelector(".lyric-word[aria-current], [aria-current='true']");
    return {
      readyState: audio.readyState,
      duration: audio.duration,
      currentTime: audio.currentTime,
      paused: audio.paused,
      srcKind: audio.src.startsWith("blob:")
        ? "blob"
        : audio.src.startsWith("/")
          ? "same-origin"
          : "other",
      playResult,
      wordCount: words.length,
      hasActiveWord: Boolean(active),
    };
  });
  report.instrumentalReadyState = audioInfo;
  report.lyricWordsPresent = (audioInfo.wordCount || 0) > 0;
  report.lyricHighlightObserved = Boolean(audioInfo.hasActiveWord);

  await page.screenshot({
    path: join(outDir, "editor-preview.png"),
    fullPage: false,
  });

  // Reload restore from IndexedDB
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForFunction(
    () =>
      document.body.innerText.includes("Edit generated karaoke") ||
      document.body.innerText.includes("Generated result unavailable"),
    null,
    { timeout: 15000 },
  );
  report.reloadRestored = !(await page
    .locator("text=Generated result unavailable")
    .count());

  await page.screenshot({
    path: join(outDir, "reload-restore.png"),
    fullPage: false,
  });
} catch (error) {
  report.errors.push(String(error?.message || error));
  try {
    await page.screenshot({
      path: join(outDir, "error.png"),
      fullPage: true,
    });
  } catch {
    // ignore
  }
} finally {
  await context.close();
}

// Redact request list to same-origin processing paths only for the report file
report.network.browserRequests = report.network.browserRequests
  .filter((r) => r.path.includes("/api/processing/") || r.path.includes("/karaoke/") || r.path.endsWith("/create"))
  .slice(0, 80);

writeFileSync(join(outDir, "report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));

if (
  report.errors.length ||
  !report.completed ||
  !report.reloadRestored ||
  !report.transcriptionRetryWithoutExtraSeparation ||
  report.network.providerHostHits > 0 ||
  report.network.keyLikeQueryOrHeader ||
  report.instrumentalReadyState?.playResult !== "played" ||
  !report.lyricWordsPresent
) {
  process.exitCode = 1;
}
