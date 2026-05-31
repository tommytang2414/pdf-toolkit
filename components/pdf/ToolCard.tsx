"use client";

import Link from "next/link";

interface ToolCardProps {
  href: string;
  title: string;
  description: string;
  badge: string;
  icon: React.ReactNode;
}

export default function ToolCard({ href, title, description, badge, icon }: ToolCardProps) {
  return (
    <Link href={href} style={{ textDecoration: "none" }}>
      <div
        style={{
          background: "var(--bg-secondary)",
          border: "1px solid var(--border)",
          borderRadius: 16,
          padding: "28px 24px",
          display: "flex",
          flexDirection: "column",
          gap: 12,
          cursor: "pointer",
          transition: "border-color 0.2s, box-shadow 0.2s, transform 0.2s",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLDivElement).style.borderColor = "var(--accent)";
          (e.currentTarget as HTMLDivElement).style.boxShadow =
            "0 0 0 1px var(--accent), 0 8px 32px rgba(124,58,237,0.15)";
          (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border)";
          (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
          (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 12,
              background: "rgba(124,58,237,0.1)",
              border: "1px solid rgba(124,58,237,0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--accent)",
            }}
          >
            {icon}
          </div>
          <span
            style={{
              fontSize: 11,
              fontFamily: "var(--font-geist-mono)",
              background: "rgba(124,58,237,0.12)",
              color: "var(--accent)",
              border: "1px solid rgba(124,58,237,0.25)",
              borderRadius: 100,
              padding: "2px 10px",
            }}
          >
            {badge}
          </span>
        </div>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 600, margin: "0 0 6px", letterSpacing: "-0.02em" }}>
            {title}
          </h2>
          <p style={{ fontSize: 14, color: "var(--text-muted)", margin: 0, lineHeight: 1.5 }}>
            {description}
          </p>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 13,
            color: "var(--accent)",
            fontWeight: 500,
            marginTop: 4,
          }}
        >
          Open tool
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </Link>
  );
}