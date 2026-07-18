"use client";

import { useDemoDraft } from "@/hooks/useDemoDraft";
import { KaraokePlayer } from "./KaraokePlayer";

export function DemoKaraokeApp() {
  const { draft } = useDemoDraft();

  return (
    <main
      className="karaoke-page"
      data-bg={draft.theme.backgroundPreset}
    >
      <KaraokePlayer
        transcript={draft.transcript}
        theme={draft.theme}
        showEditLink
      />
    </main>
  );
}
