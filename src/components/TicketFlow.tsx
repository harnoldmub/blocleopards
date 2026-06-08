import { useState, useCallback } from "react";
import type { ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Cake, MapPin, Mail, MessageCircle, Flag, User, Ticket, AlertTriangle } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type MatchKey = "rdc-denmark" | "rdc-chili";
type Step = "match" | "name" | "location" | "contact" | "confirm" | "success";

interface FormState {
  matchKey: MatchKey | "";
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  country: string;
  countryCode: string;
  city: string;
  email: string;
  phone: string;
}

// ─── Match data ───────────────────────────────────────────────────────────────

const MATCHES: Record<MatchKey, { away: string; awayFlagCode: string; date: string; venue: string; glow: string }> = {
  "rdc-denmark": {
    away: "DANEMARK",
    awayFlagCode: "dk",
    date: "3 JUIN 2026",
    venue: "LIÈGE · BELGIQUE",
    glow: "rgba(0,120,255,0.55)",
  },
  "rdc-chili": {
    away: "CHILI",
    awayFlagCode: "cl",
    date: "9 JUIN 2026",
    venue: "MARBELLA · ESPAGNE",
    glow: "rgba(206,16,33,0.55)",
  },
};

const FlagImg = ({ code, size = 48 }: { code: string; size?: number }) => (
  <img
    src={`/flags/${code}.png`}
    height={size}
    width="auto"
    alt={code.toUpperCase()}
    style={{ display: "block", borderRadius: 4, boxShadow: "0 2px 12px rgba(0,0,0,0.4)" }}
  />
);

const STEP_ORDER: Step[] = ["match", "name", "location", "contact", "confirm", "success"];
const PROGRESS_STEPS: Step[] = ["name", "location", "contact", "confirm"];

// ─── Animation variants ───────────────────────────────────────────────────────

const pageVariants = {
  initial: { opacity: 1, y: 24, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
  exit: { opacity: 0, y: -16, scale: 0.98, transition: { duration: 0.2, ease: "easeIn" } },
};

const cardVariants = {
  initial: { opacity: 1, y: 32 },
  animate: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.45, ease: [0.22, 1, 0.36, 1] },
  }),
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function StadiumBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden" style={{ zIndex: 0 }}>
      {/* Light beams */}
      <div
        className="absolute"
        style={{
          top: "-10%",
          left: "-5%",
          width: "55%",
          height: "70%",
          background: "conic-gradient(from 200deg at 20% 0%, rgba(247,214,24,0.08) 0deg, transparent 40deg)",
          filter: "blur(2px)",
        }}
      />
      <div
        className="absolute"
        style={{
          top: "-10%",
          right: "-5%",
          width: "55%",
          height: "70%",
          background: "conic-gradient(from -20deg at 80% 0%, rgba(0,127,255,0.09) 0deg, transparent 40deg)",
          filter: "blur(2px)",
        }}
      />
      {/* Ambient glow pools */}
      <div
        className="absolute"
        style={{
          bottom: "0",
          left: "50%",
          transform: "translateX(-50%)",
          width: "80%",
          height: "40%",
          background: "radial-gradient(ellipse at center bottom, rgba(28,46,143,0.18) 0%, transparent 70%)",
        }}
      />
      {/* Stars */}
      {Array.from({ length: 40 }).map((_, i) => (
        <div
          key={i}
          className="absolute rounded-full"
          style={{
            width: Math.random() * 2 + 1 + "px",
            height: Math.random() * 2 + 1 + "px",
            top: Math.random() * 70 + "%",
            left: Math.random() * 100 + "%",
            background: "rgba(255,255,255,0.6)",
            animation: `twinkle ${2 + Math.random() * 3}s ease-in-out infinite`,
            animationDelay: Math.random() * 3 + "s",
          }}
        />
      ))}
    </div>
  );
}

function ProgressBar({ step }: { step: Step }) {
  const idx = PROGRESS_STEPS.indexOf(step);
  if (idx < 0) return null;
  const pct = ((idx + 1) / PROGRESS_STEPS.length) * 100;
  const labels = ["Identité", "Localisation", "Contact", "Confirmation"];
  return (
    <div className="mb-8">
      <div className="flex justify-between mb-2">
        {PROGRESS_STEPS.map((s, i) => (
          <span
            key={s}
            style={{
              fontSize: "10px",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: i <= idx ? "#f7d618" : "rgba(255,255,255,0.3)",
              fontFamily: "'Sora', sans-serif",
              fontWeight: i <= idx ? 700 : 400,
              transition: "color 0.3s ease",
            }}
          >
            {labels[i]}
          </span>
        ))}
      </div>
      <div className="h-1 rounded-full" style={{ background: "rgba(255,255,255,0.1)" }}>
        <motion.div
          className="h-1 rounded-full"
          style={{ background: "linear-gradient(90deg, #f7d618, #ffab00)", boxShadow: "0 0 12px rgba(247,214,24,0.6)" }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
    </div>
  );
}

function StepQuestion({ text }: { text: string }) {
  return (
    <motion.h2
      initial={{ opacity: 1, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1, duration: 0.4 }}
      style={{
        fontFamily: "'Bebas Neue', sans-serif",
        fontSize: "clamp(2rem, 7vw, 3.2rem)",
        lineHeight: 1.1,
        letterSpacing: "0.04em",
        marginBottom: "32px",
        color: "#fff",
        textShadow: "0 2px 24px rgba(247,214,24,0.18)",
      }}
    >
      {text}
    </motion.h2>
  );
}

function StyledInput({
  label,
  value,
  onChange,
  type = "text",
  autoFocus,
  required,
  pattern,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  autoFocus?: boolean;
  required?: boolean;
  pattern?: string;
  inputMode?: React.InputHTMLAttributes<HTMLInputElement>["inputMode"];
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div className="mb-4">
      <label
        style={{
          display: "block",
          fontSize: "11px",
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: focused ? "#f7d618" : "rgba(255,255,255,0.5)",
          marginBottom: "8px",
          fontFamily: "'Sora', sans-serif",
          fontWeight: 700,
          transition: "color 0.2s ease",
        }}
      >
        {label} {required && <span style={{ color: "#ce1021" }}>*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoFocus={autoFocus}
        required={required}
        pattern={pattern}
        inputMode={inputMode}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          width: "100%",
          background: focused ? "rgba(247,214,24,0.06)" : "rgba(255,255,255,0.06)",
          border: `1.5px solid ${focused ? "#f7d618" : "rgba(255,255,255,0.14)"}`,
          borderRadius: "14px",
          padding: "16px 18px",
          color: "#fff",
          fontSize: "16px",
          fontFamily: "'Sora', sans-serif",
          fontWeight: 500,
          outline: "none",
          transition: "all 0.2s ease",
          boxShadow: focused ? "0 0 0 3px rgba(247,214,24,0.14), 0 4px 20px rgba(0,0,0,0.2)" : "0 2px 10px rgba(0,0,0,0.15)",
          caretColor: "#f7d618",
        }}
      />
    </div>
  );
}

function LocationInput({
  label,
  value,
  onChange,
  placeholder,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  required?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div className="mb-4">
      <label style={{ display: "block", fontSize: "11px", letterSpacing: "0.18em", textTransform: "uppercase", color: focused ? "#f7d618" : "rgba(255,255,255,0.5)", marginBottom: "8px", fontFamily: "'Sora', sans-serif", fontWeight: 700, transition: "color 0.2s" }}>
        {label} {required && <span style={{ color: "#ce1021" }}>*</span>}
      </label>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          width: "100%",
          background: focused ? "rgba(247,214,24,0.06)" : "rgba(255,255,255,0.06)",
          border: `1.5px solid ${focused ? "#f7d618" : "rgba(255,255,255,0.14)"}`,
          borderRadius: "14px",
          padding: "16px 18px",
          color: "#fff",
          fontSize: "16px",
          fontFamily: "'Sora', sans-serif",
          fontWeight: 500,
          outline: "none",
          transition: "all 0.2s ease",
          boxShadow: focused ? "0 0 0 3px rgba(247,214,24,0.14)" : "0 2px 10px rgba(0,0,0,0.15)",
          caretColor: "#f7d618",
        }}
      />
    </div>
  );
}

function PrimaryButton({ children, onClick, disabled, loading }: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      whileTap={{ scale: 0.97 }}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      style={{
        width: "100%",
        padding: "18px 32px",
        background: hovered ? "#ffcf00" : "#f7d618",
        border: "none",
        borderRadius: "16px",
        color: "#080c1a",
        fontFamily: "'Bebas Neue', sans-serif",
        fontSize: "20px",
        letterSpacing: "0.08em",
        cursor: disabled || loading ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        boxShadow: hovered ? "0 8px 40px rgba(247,214,24,0.5), 0 0 0 2px rgba(247,214,24,0.3)" : "0 4px 24px rgba(247,214,24,0.3)",
        transition: "all 0.2s ease",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "10px",
      }}
    >
      {loading ? (
        <span style={{ display: "inline-block", width: 18, height: 18, border: "2px solid #080c1a", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      ) : children}
    </motion.button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function TicketFlow() {
  const [step, setStep] = useState<Step>("match");
  const [form, setForm] = useState<FormState>({
    matchKey: "",
    firstName: "",
    lastName: "",
    dateOfBirth: "",
    country: "",
    countryCode: "",
    city: "",
    email: "",
    phone: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const set = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setError(null);
  }, []);

  const goTo = (s: Step) => {
    setError(null);
    setStep(s);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const selectMatch = (key: MatchKey) => {
    set("matchKey", key);
    setTimeout(() => goTo("name"), 180);
  };

  const submitName = () => {
    if (!form.firstName.trim() || !form.lastName.trim()) {
      setError("Renseigne ton prénom et ton nom pour continuer.");
      return;
    }
    if (!form.dateOfBirth) {
      setError("Renseigne ta date de naissance pour continuer.");
      return;
    }
    goTo("location");
  };

  const submitLocation = () => {
    if (!form.country.trim() || !form.city.trim()) {
      setError("Indique ton pays et ta ville pour continuer.");
      return;
    }
    goTo("contact");
  };

  const submitContact = () => {
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email);
    if (!emailOk) {
      setError("Saisis un email valide pour qu'on puisse te recontacter.");
      return;
    }
    goTo("confirm");
  };

  const submitRegistration = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/billets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          match_key: form.matchKey,
          first_name: form.firstName,
          last_name: form.lastName,
          date_of_birth: form.dateOfBirth || undefined,
          email: form.email,
          phone: form.phone || undefined,
          country: form.country,
          country_code: form.countryCode,
          city: form.city,
          source: "formulaire",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Erreur. Réessaie dans un instant.");
        return;
      }
      goTo("success");
    } catch {
      setError("Connexion impossible. Vérifie ta connexion internet.");
    } finally {
      setLoading(false);
    }
  };

  const match = form.matchKey ? MATCHES[form.matchKey] : null;

  return (
    <div style={{ minHeight: "100vh", position: "relative", fontFamily: "'Sora', sans-serif" }}>
      <style>{`
        @keyframes twinkle { 0%,100% { opacity:0.3; transform:scale(0.8); } 50% { opacity:1; transform:scale(1.2); } }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes float { 0%,100% { transform:translateY(0); } 50% { transform:translateY(-12px); } }
        @keyframes pulse-ring { 0% { transform:scale(0.9); opacity:0.8; } 70% { transform:scale(1.6); opacity:0; } 100% { opacity:0; } }
        ::-webkit-scrollbar { width:4px; } ::-webkit-scrollbar-track { background:transparent; } ::-webkit-scrollbar-thumb { background:rgba(247,214,24,0.3); border-radius:4px; }
      `}</style>

      <StadiumBackground />

      {/* Top bar — back + home */}
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: "rgba(8,12,26,0.7)", backdropFilter: "blur(12px)" }}>
        {step !== "match" && step !== "success" ? (
          <button
            type="button"
            onClick={() => goTo(STEP_ORDER[STEP_ORDER.indexOf(step) - 1])}
            style={{
              display: "flex", alignItems: "center", gap: "6px",
              background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: "40px", padding: "8px 14px", color: "rgba(255,255,255,0.7)",
              fontFamily: "'Sora', sans-serif", fontSize: "13px", cursor: "pointer",
            }}
          >
            ← Retour
          </button>
        ) : (
          <div />
        )}
        <a
          href="/"
          style={{
            display: "flex", alignItems: "center", gap: 6,
            background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: "40px", padding: "8px 14px", color: "rgba(255,255,255,0.7)",
            fontFamily: "'Sora', sans-serif", fontSize: "13px", textDecoration: "none",
          }}
        >
          ← Accueil
        </a>
      </div>

      <div style={{ position: "relative", zIndex: 10, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: "100px 16px 48px" }}>
        <AnimatePresence mode="wait">

          {/* ── STEP: match selection ── */}
          {step === "match" && (
            <motion.div key="match" variants={pageVariants} initial="initial" animate="animate" exit="exit" style={{ width: "100%", maxWidth: "820px", textAlign: "center" }}>
              <motion.div
                initial={{ opacity: 1, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                style={{ marginBottom: "16px", animation: "float 4s ease-in-out infinite", display: "flex", justifyContent: "center" }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                  <img src="/brand/logo.png" alt="Bloc Léopards" style={{ height: "72px", width: "auto", filter: "drop-shadow(0 4px 24px rgba(247,214,24,0.4))" }} />
                  <img src="/brand/logo-min-sport-white.webp" alt="Ministère des Sports" style={{ height: "52px", width: "auto", filter: "brightness(0) invert(1) drop-shadow(0 2px 8px rgba(255,255,255,0.3))" }} />
                </div>
              </motion.div>
              <motion.h1
                initial={{ opacity: 1, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.5 }}
                style={{
                  fontFamily: "'Bebas Neue', sans-serif",
                  fontSize: "clamp(2.4rem, 8vw, 5rem)",
                  letterSpacing: "0.05em",
                  lineHeight: 1,
                  color: "#fff",
                  marginBottom: "16px",
                  textShadow: "0 2px 32px rgba(247,214,24,0.2)",
                }}
              >
                Rejoins le Bloc<br />
                <span style={{ color: "#f7d618" }}>des Léopards</span>
              </motion.h1>
              <motion.p
                initial={{ opacity: 1 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.25, duration: 0.5 }}
                style={{ color: "rgba(255,255,255,0.6)", fontSize: "16px", marginBottom: "48px", maxWidth: "480px", margin: "0 auto 48px" }}
              >
                Demande ta place pour pousser la RDC vers la victoire.
              </motion.p>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(300px, 100%), 1fr))", gap: "16px", marginTop: "40px" }}>
                {(Object.entries(MATCHES) as [MatchKey, typeof MATCHES[MatchKey]][]).map(([key, m], i) => (
                  <MatchCard key={key} matchKey={key} match={m} index={i} onSelect={() => selectMatch(key)} />
                ))}
              </div>
            </motion.div>
          )}

          {/* ── STEP: name ── */}
          {step === "name" && (
            <motion.div key="name" variants={pageVariants} initial="initial" animate="animate" exit="exit" style={{ width: "100%", maxWidth: "480px" }}>
              <ProgressBar step="name" />
              {match && <MatchBadge match={match} />}
              <StepQuestion text={`Supporter,\nquel est ton nom ?`} />
              <StyledInput label="Prénom" value={form.firstName} onChange={(v) => set("firstName", v)} autoFocus required />
              <StyledInput label="Nom" value={form.lastName} onChange={(v) => set("lastName", v)} required />
              <StyledInput label="Date de naissance" value={form.dateOfBirth} onChange={(v) => set("dateOfBirth", v)} type="date" required />
              {error && <ErrorMsg msg={error} />}
              <div style={{ marginTop: "24px" }}>
                <PrimaryButton onClick={submitName}>Continuer →</PrimaryButton>
              </div>
            </motion.div>
          )}

          {/* ── STEP: location ── */}
          {step === "location" && (
            <motion.div key="location" variants={pageVariants} initial="initial" animate="animate" exit="exit" style={{ width: "100%", maxWidth: "480px" }}>
              <ProgressBar step="location" />
              {match && <MatchBadge match={match} />}
              <StepQuestion text={`Où est basé\nton bloc ?`} />
              <LocationInput
                label="Pays"
                value={form.country}
                onChange={(v) => { set("country", v); set("countryCode", ""); }}
                placeholder="Ex: RDC, Belgique, France..."
                required
              />
              <LocationInput
                label="Ville"
                value={form.city}
                onChange={(v) => set("city", v)}
                placeholder="Ex: Kinshasa, Liège, Bruxelles..."
                required
              />
              {error && <ErrorMsg msg={error} />}
              <div style={{ marginTop: "24px" }}>
                <PrimaryButton onClick={submitLocation}>Continuer →</PrimaryButton>
              </div>
            </motion.div>
          )}

          {/* ── STEP: contact ── */}
          {step === "contact" && (
            <motion.div key="contact" variants={pageVariants} initial="initial" animate="animate" exit="exit" style={{ width: "100%", maxWidth: "480px" }}>
              <ProgressBar step="contact" />
              {match && <MatchBadge match={match} />}
              <StepQuestion text={`Comment peut-on\nte contacter ?`} />
              <StyledInput label="Email" value={form.email} onChange={(v) => set("email", v)} type="email" autoFocus required inputMode="email" />
              <StyledInput label="WhatsApp (optionnel)" value={form.phone} onChange={(v) => set("phone", v)} type="tel" inputMode="tel" />
              <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", marginTop: "12px", padding: "12px 14px", background: "rgba(247,214,24,0.07)", borderRadius: "12px", border: "1px solid rgba(247,214,24,0.15)" }}>
                <span style={{ flexShrink: 0, marginTop: "2px", color: "#fbbf24" }}><AlertTriangle size={15} /></span>
                <p style={{ color: "rgba(255,255,255,0.65)", fontSize: "13px", margin: 0, lineHeight: 1.55 }}>
                  <strong style={{ color: "#f7d618" }}>Une seule demande par supporter.</strong> Si tu as déjà envoyé une demande pour ce match, la tienne est enregistrée.
                </p>
              </div>
              {error && <ErrorMsg msg={error} />}
              <div style={{ marginTop: "24px" }}>
                <PrimaryButton onClick={submitContact}>Continuer →</PrimaryButton>
              </div>
            </motion.div>
          )}

          {/* ── STEP: confirm ── */}
          {step === "confirm" && (
            <motion.div key="confirm" variants={pageVariants} initial="initial" animate="animate" exit="exit" style={{ width: "100%", maxWidth: "480px" }}>
              <ProgressBar step="confirm" />
              <StepQuestion text={`Prêt à faire\nvibrer le stade ?`} />
              <div style={{
                background: "rgba(255,255,255,0.04)",
                border: "1.5px solid rgba(255,255,255,0.1)",
                borderRadius: "20px",
                padding: "24px",
                marginBottom: "24px",
              }}>
                <p style={{ color: "rgba(255,255,255,0.45)", fontSize: "11px", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: "16px", fontWeight: 700 }}>Récapitulatif</p>
                {match && (
                  <SummaryRow icon={<Flag size={15} />} label="Match" value={`RDC vs ${match.away} · ${match.date}`} />
                )}
                <SummaryRow icon={<User size={15} />} label="Supporter" value={`${form.firstName} ${form.lastName}`} />
                {form.dateOfBirth && <SummaryRow icon={<Cake size={15} />} label="Naissance" value={new Date(form.dateOfBirth).toLocaleDateString("fr-FR")} />}
                {form.country && <SummaryRow icon={<MapPin size={15} />} label="Bloc" value={`${form.city ? form.city + ", " : ""}${form.country}`} />}
                <SummaryRow icon={<Mail size={15} />} label="Contact" value={form.email} />
                {form.phone && <SummaryRow icon={<MessageCircle size={15} />} label="WhatsApp" value={form.phone} />}
              </div>
              {error && <ErrorMsg msg={error} />}
              <PrimaryButton onClick={submitRegistration} loading={loading}>
                Rejoindre le Bloc
              </PrimaryButton>
            </motion.div>
          )}

          {/* ── STEP: success ── */}
          {step === "success" && (
            <motion.div key="success" variants={pageVariants} initial="initial" animate="animate" exit="exit" style={{ width: "100%", maxWidth: "520px", textAlign: "center" }}>
              <motion.div
                initial={{ scale: 0.5, rotate: -20 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.1, duration: 0.5, type: "spring", stiffness: 200 }}
                style={{ marginBottom: "24px", display: "inline-block", color: "#f7d618" }}
              >
                <Trophy size={80} strokeWidth={1.2} />
              </motion.div>
              <motion.h2
                initial={{ opacity: 1, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.4 }}
                style={{
                  fontFamily: "'Bebas Neue', sans-serif",
                  fontSize: "clamp(2.5rem, 8vw, 4.2rem)",
                  letterSpacing: "0.05em",
                  color: "#f7d618",
                  marginBottom: "16px",
                }}
              >
                Mission accomplie !
              </motion.h2>
              <motion.p
                initial={{ opacity: 1 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3, duration: 0.4 }}
                style={{ color: "rgba(255,255,255,0.75)", fontSize: "17px", lineHeight: 1.65, marginBottom: "36px" }}
              >
                Ta demande est enregistrée dans le Bloc des Léopards.<br />
                Si tu es sélectionné·e, nous te contacterons rapidement.
              </motion.p>
              <motion.p
                initial={{ opacity: 1, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4, duration: 0.4 }}
                style={{
                  fontFamily: "'Bebas Neue', sans-serif",
                  fontSize: "2rem",
                  color: "#007fff",
                  marginBottom: "40px",
                  letterSpacing: "0.08em",
                }}
              >
                <img src="/flags/cd.png" height={28} style={{ verticalAlign: "middle", borderRadius: 3, marginRight: 8 }} alt="RDC" /> Allez les Léopards ! <img src="/flags/cd.png" height={28} style={{ verticalAlign: "middle", borderRadius: 3, marginLeft: 8 }} alt="RDC" />
              </motion.p>
              <motion.div initial={{ opacity: 1, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} style={{ display: "flex", gap: "12px", flexWrap: "wrap", justifyContent: "center" }}>
                <a
                  href="/"
                  style={{
                    display: "inline-block",
                    padding: "15px 28px",
                    background: "rgba(255,255,255,0.08)",
                    border: "1px solid rgba(255,255,255,0.15)",
                    borderRadius: "14px",
                    color: "#fff",
                    fontFamily: "'Sora', sans-serif",
                    fontWeight: 600,
                    fontSize: "14px",
                    textDecoration: "none",
                    transition: "all 0.2s ease",
                  }}
                >
                  ← Retour à l'accueil
                </a>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent("Je rejoins le Bloc des Léopards pour soutenir la RDC ! Tu peux faire ta demande ici : " + (typeof window !== "undefined" ? window.location.origin : "") + "/mondial")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "inline-block",
                    padding: "15px 28px",
                    background: "#25d366",
                    border: "none",
                    borderRadius: "14px",
                    color: "#fff",
                    fontFamily: "'Sora', sans-serif",
                    fontWeight: 700,
                    fontSize: "14px",
                    textDecoration: "none",
                  }}
                >
                  <MessageCircle size={16} style={{ marginRight: 8, verticalAlign: "middle" }} />
                  Partager sur WhatsApp
                </a>
              </motion.div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}

// ─── Helper sub-components ────────────────────────────────────────────────────

function MatchCard({ matchKey, match, index, onSelect }: {
  matchKey: MatchKey;
  match: typeof MATCHES[MatchKey];
  index: number;
  onSelect: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <motion.div
      custom={index}
      variants={cardVariants}
      initial="initial"
      animate="animate"
      whileHover={{ scale: 1.02, y: -4 }}
      whileTap={{ scale: 0.98 }}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      style={{
        background: hovered ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.04)",
        border: `1.5px solid ${hovered ? "rgba(247,214,24,0.4)" : "rgba(255,255,255,0.1)"}`,
        borderRadius: "24px",
        padding: "clamp(16px, 4vw, 32px) clamp(14px, 3.5vw, 24px)",
        cursor: "pointer",
        boxShadow: hovered ? `0 20px 60px -20px ${match.glow}, 0 0 0 1px rgba(247,214,24,0.15)` : "0 8px 32px rgba(0,0,0,0.3)",
        transition: "background 0.2s ease, border-color 0.2s ease, box-shadow 0.3s ease",
        backdropFilter: "blur(12px)",
        position: "relative",
        overflow: "hidden",
      }}
      onClick={onSelect}
    >
      {/* glow blob */}
      <div style={{ position: "absolute", inset: 0, opacity: hovered ? 0.6 : 0.2, background: `radial-gradient(ellipse at 50% 0%, ${match.glow} 0%, transparent 70%)`, transition: "opacity 0.3s ease", pointerEvents: "none" }} />

      <div style={{ position: "relative" }}>
        <div style={{ fontSize: "11px", letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)", marginBottom: "20px", fontWeight: 600 }}>
          Amical International
        </div>

        {/* Score board style */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px", gap: "12px" }}>
          <div style={{ textAlign: "center", flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
            <FlagImg code="cd" size={42} />
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "22px", letterSpacing: "0.08em", color: "#fff", marginTop: 6 }}>RDC</div>
          </div>
          <div style={{
            background: "rgba(0,0,0,0.4)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: "12px",
            padding: "12px 20px",
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: "28px",
            color: "rgba(255,255,255,0.6)",
            letterSpacing: "0.12em",
            flexShrink: 0,
          }}>
            VS
          </div>
          <div style={{ textAlign: "center", flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
            <FlagImg code={match.awayFlagCode} size={42} />
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "22px", letterSpacing: "0.08em", color: "#fff", marginTop: 6 }}>{match.away}</div>
          </div>
        </div>

        <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: "16px", marginBottom: "24px" }}>
          <div style={{ color: "rgba(255,255,255,0.85)", fontWeight: 700, fontSize: "15px", marginBottom: "4px" }}>{match.date}</div>
          <div style={{ color: "rgba(255,255,255,0.45)", fontSize: "13px", letterSpacing: "0.06em" }}>{match.venue}</div>
        </div>

        <motion.button
          type="button"
          whileTap={{ scale: 0.96 }}
          style={{
            width: "100%",
            padding: "16px",
            background: hovered ? "#f7d618" : "rgba(247,214,24,0.12)",
            border: hovered ? "none" : "1.5px solid rgba(247,214,24,0.3)",
            borderRadius: "14px",
            color: hovered ? "#080c1a" : "#f7d618",
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: "18px",
            letterSpacing: "0.08em",
            cursor: "pointer",
            transition: "all 0.2s ease",
            boxShadow: hovered ? "0 6px 30px rgba(247,214,24,0.4)" : "none",
          }}
        >
          Gagne ton billet →
        </motion.button>
      </div>
    </motion.div>
  );
}

function MatchBadge({ match }: { match: typeof MATCHES[MatchKey] }) {
  return (
    <motion.div
      initial={{ opacity: 1, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "8px",
        background: "rgba(247,214,24,0.1)",
        border: "1px solid rgba(247,214,24,0.25)",
        borderRadius: "40px",
        padding: "8px 14px",
        marginBottom: "24px",
        fontSize: "13px",
        color: "#f7d618",
        fontWeight: 600,
      }}
    >
      RDC vs {match.away} · {match.date}
    </motion.div>
  );
}

function SummaryRow({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
      <span style={{ flexShrink: 0, marginTop: "2px", color: "rgba(255,255,255,0.5)", display: "flex" }}>{icon}</span>
      <div>
        <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 600, marginBottom: "2px" }}>{label}</div>
        <div style={{ color: "#fff", fontSize: "14px", fontWeight: 500, wordBreak: "break-all" }}>{value}</div>
      </div>
    </div>
  );
}

function ErrorMsg({ msg }: { msg: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        marginTop: "12px",
        padding: "12px 14px",
        background: "rgba(206,16,33,0.12)",
        border: "1px solid rgba(206,16,33,0.3)",
        borderRadius: "12px",
        color: "#ff6b7a",
        fontSize: "13px",
        lineHeight: 1.5,
      }}
    >
      {msg}
    </motion.div>
  );
}
