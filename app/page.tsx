import ToolCard from "@/components/pdf/ToolCard";

const tools = [
  {
    href: "/merge",
    title: "Merge PDFs",
    description: "Combine multiple PDFs into a single file. Drag to reorder before merging.",
    badge: "Combine",
    icon: (
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="10" height="18" rx="1.5" />
        <rect x="11" y="3" width="10" height="18" rx="1.5" />
        <path d="M7 12h10" />
        <path d="M12 9l3 3-3 3" />
      </svg>
    ),
  },
  {
    href: "/split",
    title: "Split PDF",
    description: "Extract specific pages or split by page ranges into separate files.",
    badge: "Extract",
    icon: (
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M12 3v18" />
        <path d="M8 8.5l2 1.5-2 1.5" />
        <path d="M16 13.5l-2 1.5 2 1.5" />
      </svg>
    ),
  },
  {
    href: "/toolkit",
    title: "Full Toolkit",
    description: "Merge, reorder, rotate, and delete — all in one page. Maximum control.",
    badge: "All-in-one",
    icon: (
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2l3 7h7l-5.5 4.5 2 7L12 17l-6.5 3.5 2-7L2 9h7z" />
      </svg>
    ),
  },
];

export default function HomePage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 24px",
        gap: 56,
      }}
    >
      {/* Header */}
      <div style={{ textAlign: "center", maxWidth: 520 }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            background: "var(--bg-secondary)",
            border: "1px solid var(--border)",
            borderRadius: 100,
            padding: "6px 16px",
            marginBottom: 24,
            fontSize: 13,
            color: "var(--text-muted)",
            fontFamily: "var(--font-geist-mono)",
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="var(--accent)" stroke="none">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" stroke="var(--accent)" strokeWidth="2" fill="none" />
          </svg>
          100% browser-side — no uploads, no servers
        </div>

        <h1
          style={{
            fontSize: "clamp(40px, 8vw, 72px)",
            fontWeight: 700,
            letterSpacing: "-0.04em",
            lineHeight: 1.05,
            margin: "0 0 16px",
            background: "linear-gradient(160deg, #fafafa 30%, #a78bfa)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          PDF Toolkit
        </h1>
        <p
          style={{
            fontSize: 17,
            color: "var(--text-muted)",
            lineHeight: 1.6,
            margin: 0,
          }}
        >
          Merge, split, rotate, and reorder — your PDFs never leave your device.
        </p>
      </div>

      {/* Tool cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 16,
          width: "100%",
          maxWidth: 900,
        }}
      >
        {tools.map((tool) => (
          <ToolCard key={tool.href} {...tool} />
        ))}
      </div>

      {/* Footer tagline */}
      <p
        style={{
          fontSize: 12,
          color: "#3f3f46",
          fontFamily: "var(--font-geist-mono)",
          textAlign: "center",
        }}
      >
        Built with pdf-lib &amp; pdfjs-dist · all processing happens in your browser
      </p>
    </main>
  );
}