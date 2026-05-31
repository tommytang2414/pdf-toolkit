import Link from "next/link";

const tools = [
  {
    href: "/merge",
    title: "Merge PDFs",
    description: "Combine multiple PDFs into one. Drag to reorder before merging.",
    tag: "Combine",
    img: "/images/icon-merge.jpeg",
  },
  {
    href: "/split",
    title: "Split PDF",
    description: "Extract specific pages or split by range into separate files.",
    tag: "Extract",
    img: "/images/icon-split.jpeg",
  },
  {
    href: "/toolkit",
    title: "Full Toolkit",
    description: "Merge, reorder, rotate, and delete — all in one place.",
    tag: "All-in-one",
    img: "/images/icon-toolkit.jpeg",
  },
];

export default function HomePage() {
  return (
    <div className="ambient-bg" style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 24px", gap: 64 }}>
      {/* Header */}
      <div style={{ textAlign: "center", maxWidth: 520 }}>
        <span className="tag" style={{ display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 28 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z" stroke="var(--accent)" strokeWidth="2" fill="none" />
            <path d="M12 8v4l3 3" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" />
          </svg>
          100% browser-side — files never leave your device
        </span>

        <h1 style={{ fontSize: "clamp(44px, 9vw, 80px)", fontWeight: 700, letterSpacing: "-0.04em", lineHeight: 1.05, margin: "0 0 18px" }}>
          <span style={{ color: "var(--accent)" }}>PDF</span>
          <br />
          <span style={{ color: "var(--text)", fontStyle: "italic", fontWeight: 300 }}>Toolkit</span>
        </h1>
        <p style={{ fontSize: 17, color: "var(--text-muted)", lineHeight: 1.6, margin: 0 }}>
          Merge, split, rotate, and reorder — your PDFs never leave your browser.
        </p>
      </div>

      {/* Tool cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16, width: "100%", maxWidth: 860 }}>
        {tools.map((tool) => (
          <Link key={tool.href} href={tool.href} style={{ textDecoration: "none" }}>
            <div
              className="card-glow"
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border)",
                borderRadius: 20,
                padding: "24px 22px",
                display: "flex",
                flexDirection: "column",
                gap: 14,
                cursor: "pointer",
                transition: "all 0.25s ease",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ width: 64, height: 64, borderRadius: 14, overflow: "hidden", background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
                  <img src={tool.img} alt={tool.title} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                </div>
                <span className="tag">{tool.tag}</span>
              </div>

              <div>
                <h2 style={{ fontSize: 17, fontWeight: 600, margin: "0 0 6px", letterSpacing: "-0.01em" }}>{tool.title}</h2>
                <p style={{ fontSize: 13.5, color: "var(--text-muted)", margin: 0, lineHeight: 1.55 }}>{tool.description}</p>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--accent)", fontWeight: 500, marginTop: 2 }}>
                Open tool
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Footer */}
      <p style={{ fontSize: 11.5, color: "#3a3530", fontFamily: "var(--font-mono)", letterSpacing: "0.04em" }}>
        Built with pdf-lib &amp; pdfjs-dist
      </p>
    </div>
  );
}