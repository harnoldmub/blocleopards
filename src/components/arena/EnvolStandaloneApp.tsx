import { useEffect, useState } from "react";
import EnvolGameView from "./EnvolGameView";

export default function EnvolStandaloneApp() {
  const [player, setPlayer] = useState<{ id: string; nickname: string; public_tag: string } | null>(null);
  const [opponent, setOpponent] = useState<{ name: string; tag?: string; scoreToBeat: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Décodage d'un éventuel lien de défi dans l'URL (?match=... ou ?defi=...)
    try {
      const sp = new URLSearchParams(window.location.search);
      const matchRaw = sp.get("match") || sp.get("defi");
      if (matchRaw && matchRaw.length < 600) {
        const decoded = JSON.parse(atob(matchRaw.replace(/-/g, "+").replace(/_/g, "/")));
        if (decoded && (decoded.g === "envol" || Number.isFinite(Number(decoded.s)))) {
          setOpponent({
            name: decoded.n || "Un ami",
            tag: decoded.t ? String(decoded.t).slice(0, 8) : undefined,
            scoreToBeat: Math.max(0, Math.round(Number(decoded.s || decoded.p || 0)))
          });
        }
      }
    } catch {}

    // 2. Récupération ou création de la session joueur anonyme persistante
    fetch("/api/jeux/session")
      .then((r) => r.json())
      .then((res) => {
        if (res?.success && res.player) {
          setPlayer(res.player);
        } else {
          // Secours local si le serveur ne répond pas
          let localName = "Supporter";
          let localTag = "243";
          try {
            const savedName = localStorage.getItem("bloc_player_name");
            if (savedName) localName = savedName;
            const savedTag = localStorage.getItem("bloc_player_tag");
            if (savedTag) localTag = savedTag;
          } catch {}
          setPlayer({ id: "local", nickname: localName, public_tag: localTag });
        }
      })
      .catch(() => {
        setPlayer({ id: "offline", nickname: "Supporter", public_tag: "243" });
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading || !player) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-[#070e24] text-white">
        <div className="h-10 w-10 animate-spin rounded-full border-3 border-[var(--a-gold)] border-t-transparent" />
        <span className="mt-4 text-[13px] font-extrabold uppercase tracking-widest text-white/70">
          Chargement d'Envol 243…
        </span>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#070e24]">
      <EnvolGameView
        playerName={player.nickname}
        playerTag={player.public_tag}
        opponent={opponent}
        onExit={() => {
          window.location.href = "/jeux";
        }}
        onScoreSubmitted={() => {
          // Rafraîchir les données de session en arrière-plan
          fetch("/api/jeux/session")
            .then((r) => r.json())
            .then((res) => {
              if (res?.success && res.player) setPlayer(res.player);
            })
            .catch(() => {});
        }}
      />
    </div>
  );
}
