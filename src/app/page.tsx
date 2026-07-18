import Link from "next/link";

export default function HomePage() {
  return (
    <main className="home">
      <div className="home-panel">
        <h1 className="home-brand">Karoks</h1>
        <p className="home-copy">
          Turn a track into timed karaoke lyrics — or explore the prepared demo
          player and editor.
        </p>
        <div className="home-actions">
          <Link className="home-cta" href="/create">
            Create karaoke
          </Link>
          <Link className="home-cta home-cta-secondary" href="/karaoke/demo">
            Open demo player
          </Link>
        </div>
      </div>
    </main>
  );
}
