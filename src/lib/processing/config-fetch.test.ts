import { describe, expect, it, vi } from "vitest";
import { fetchClientProcessingConfig } from "./real-provider";

describe("fetchClientProcessingConfig", () => {
  it("returns ready mock only for an explicit server mock response", async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({ mode: "mock", realConfigured: false }),
    );
    const result = await fetchClientProcessingConfig(fetchImpl as typeof fetch);
    expect(result).toEqual({
      status: "ready",
      config: { mode: "mock", realConfigured: false },
    });
  });

  it("returns ready real for an explicit server real response", async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({ mode: "real", realConfigured: true }),
    );
    const result = await fetchClientProcessingConfig(fetchImpl as typeof fetch);
    expect(result).toEqual({
      status: "ready",
      config: { mode: "real", realConfigured: true },
    });
  });

  it("does not fall back to mock on HTTP failure", async () => {
    const fetchImpl = vi.fn(async () => new Response("nope", { status: 500 }));
    const result = await fetchClientProcessingConfig(fetchImpl as typeof fetch);
    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.message).toMatch(/configuration/i);
    }
  });

  it("does not fall back to mock on network failure", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("offline");
    });
    const result = await fetchClientProcessingConfig(fetchImpl as typeof fetch);
    expect(result.status).toBe("error");
  });

  it("rejects invalid mode payloads", async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({ mode: "something-else", realConfigured: true }),
    );
    const result = await fetchClientProcessingConfig(fetchImpl as typeof fetch);
    expect(result.status).toBe("error");
  });
});
