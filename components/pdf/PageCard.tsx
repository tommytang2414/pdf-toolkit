"use client";

import { RotateCw, Trash2 } from "lucide-react";

interface Props {
  dataUrl: string;
  pageIndex: number;
  width: number;
  height: number;
  selected?: boolean;
  onRotate?: (dir: 90 | -90) => void;
  onDelete?: () => void;
  onClick?: () => void;
  compact?: boolean;
}

export default function PageCard({
  dataUrl,
  pageIndex,
  width,
  height,
  selected,
  onRotate,
  onDelete,
  onClick,
  compact,
}: Props) {
  const label = pageIndex + 1;

  return (
    <div
      onClick={onClick}
      style={{
        position: "relative",
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 6,
        cursor: onClick ? "pointer" : "default",
        flexShrink: 0,
      }}
    >
      {/* Thumbnail */}
      <div
        style={{
          position: "relative",
          width: compact ? 72 : 140,
          height: compact ? 96 : 186,
          borderRadius: 6,
          overflow: "hidden",
          border: selected
            ? "2px solid var(--accent)"
            : "1px solid var(--border)",
          boxShadow: selected
            ? "0 0 0 3px rgba(124,58,237,0.2)"
            : "0 2px 8px rgba(0,0,0,0.4)",
          background: "#18181b",
          transition: "border-color 0.15s, box-shadow 0.15s",
        }}
      >
        <img
          src={dataUrl}
          alt={`Page ${label}`}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            display: "block",
            pointerEvents: "none",
          }}
        />

        {/* Page number badge */}
        <div
          style={{
            position: "absolute",
            bottom: 4,
            right: 4,
            background: "rgba(0,0,0,0.7)",
            borderRadius: 4,
            padding: "1px 6px",
            fontSize: 11,
            fontFamily: "var(--font-geist-mono)",
            color: "#fafafa",
          }}
        >
          {label}
        </div>

        {/* Selected overlay */}
        {selected && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(124,58,237,0.15)",
            }}
          />
        )}
      </div>

      {/* Actions — shown on hover / always visible on touch */}
      {(onRotate || onDelete) && !compact && (
        <div style={{ display: "flex", gap: 4 }}>
          {onRotate && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRotate(90);
              }}
              title="Rotate 90° CW"
              style={actionBtn}
            >
              <RotateCw size={13} />
            </button>
          )}
          {onDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              title="Remove page"
              style={{ ...actionBtn, color: "#f87171" }}
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

const actionBtn: React.CSSProperties = {
  background: "var(--bg-secondary)",
  border: "1px solid var(--border)",
  borderRadius: 5,
  padding: "3px 6px",
  color: "var(--text-muted)",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  transition: "background 0.15s, color 0.15s",
};