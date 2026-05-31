import Link from "next/link";

const tools = [
  {
    href: "/merge",
    title: "Merge PDFs",
    description: "Drop multiple files. Pick the order. One PDF out.",
    tag: "Combine",
    img: "/images/icon-merge.jpeg",
  },
  {
    href: "/split",
    title: "Split PDF",
    description: "Select pages or type a range like 1-3, 5, 7-9.",
    tag: "Extract",
    img: "/images/icon-split.jpeg",
  },
  {
    href: "/toolkit",
    title: "Full Toolkit",
    description: "Merge + reorder + rotate + delete — all at once.",
    tag: "All-in-one",
    img: "/images/icon-toolkit.jpeg",
  },
];

export default function HomePage() {
  return (
    <div className="ambient-bg" style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 24px" }}>
      {/* Hero */}
      <div style={{ textAlign: "center", maxWidth: 520, marginBottom: 64 }}>
        {/* Badge */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 28 }}>
          <span className="tag" style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
                fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
            </svg>
            No upload. No tracking. 100% local.
          </span>
        </div>

        {/* Logo mark */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14,
            background: "linear-gradient(135deg, #d97706 0%, #f59e0b 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 0 30px rgba(217,119,6,0.35), 0 0 60px rgba(217,119,6,0.12)",
          }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
              <path d="M14 2H6C4.9 2 4 2.9 4 4V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V8L14 2Z"
                fill="#07070a" stroke="#07070a" strokeWidth="1.5" strokeLinejoin="round"/>
              <path d="M14 2V8H20" stroke="#f59e0b" strokeWidth="1.5" strokeLinejoin="round"/>
              <line x1="8" y1="13" x2="16" y2="13" stroke="#d97706" strokeWidth="1.5" strokeLinecap="round"/>
              <line x1="8" y1="17" x2="13" y2="17" stroke="#d97706" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
        </div>

        {/* Heading */}
        <h1 style={{ fontSize: "clamp(42px, 8vw, 72px)", fontWeight: 700, letterSpacing: "-0.04em", lineHeight: 1.05, margin: "0 0 16px" }}>
          <span style={{ color: "var(--accent)" }}>PDF</span>
          <br />
          <span style={{ color: "var(--text)", fontStyle: "italic", fontWeight: 300 }}>Toolkit</span>
        </h1>

        {/* Byline */}
        <p style={{ fontSize: 16, color: "var(--text-muted)", lineHeight: 1.65, margin: "0 0 32px" }}>
          Merge, split, rotate, reorder.
          <br />Your files never leave your browser.
        </p>

        {/* Maker credit */}
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 22, height: 22, borderRadius: "50%", background: "var(--accent)",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#07070a"
          }}>T</div>
          <span style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>by tommytang</span>
        </div>
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
      <div style={{ marginTop: 80, display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <a href="https://github.com/tommytang2414/pdf-toolkit" target="_blank" rel="noopener noreferrer"
            style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--text-muted)", fontSize: 12, textDecoration: "none", fontFamily: "var(--font-mono)" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
            </svg>
            View source
          </a>
          <span style={{ color: "var(--border)", fontSize: 10 }}>·</span>
          <span style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>Built with pdf-lib & pdfjs-dist</span>
        </div>
        <p style={{ fontSize: 11, color: "#3a3530", fontFamily: "var(--font-mono)", letterSpacing: "0.04em" }}>
          Open source · No tracking · No data stored
        </p>
      </div>
    </div>
  );
}