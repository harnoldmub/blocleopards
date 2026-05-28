import { useEffect } from "react";

interface Props {
  message: string;
  detail?: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({ message, detail, confirmLabel = "Supprimer", onConfirm, onCancel }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div
      onClick={onCancel}
      style={{
        position: "fixed", inset: 0, zIndex: 500,
        background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "20px",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#0e1628",
          border: "1.5px solid rgba(255,255,255,0.1)",
          borderRadius: 20,
          padding: "32px 28px",
          maxWidth: 400,
          width: "100%",
          boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
          fontFamily: "'Sora', sans-serif",
        }}
      >
        <div style={{ fontSize: 32, marginBottom: 16, textAlign: "center" }}>🗑</div>
        <h3 style={{
          fontFamily: "'Bebas Neue', sans-serif",
          fontSize: "1.5rem",
          letterSpacing: "0.04em",
          color: "#fff",
          textAlign: "center",
          marginBottom: detail ? 8 : 24,
        }}>
          {message}
        </h3>
        {detail && (
          <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 13, textAlign: "center", marginBottom: 24, lineHeight: 1.5 }}>
            {detail}
          </p>
        )}
        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              flex: 1, padding: "13px",
              background: "transparent",
              border: "1.5px solid rgba(255,255,255,0.12)",
              borderRadius: 12,
              color: "rgba(255,255,255,0.55)",
              fontSize: 13, fontWeight: 600,
              cursor: "pointer",
              fontFamily: "'Sora', sans-serif",
            }}
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={onConfirm}
            style={{
              flex: 1, padding: "13px",
              background: "rgba(248,113,113,0.12)",
              border: "1.5px solid rgba(248,113,113,0.4)",
              borderRadius: 12,
              color: "#f87171",
              fontSize: 13, fontWeight: 700,
              cursor: "pointer",
              fontFamily: "'Sora', sans-serif",
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
