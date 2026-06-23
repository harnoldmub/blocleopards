import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { UploadCloud, FileText, Plane } from "lucide-react";
import CountrySelectMondial from "./CountrySelectMondial";

const PREFIXES = [
  { code: "+1",   flag: "us", name: "USA / Canada" },
  { code: "+243", flag: "cd", name: "RDC" },
  { code: "+242", flag: "cg", name: "Congo" },
  { code: "+33",  flag: "fr", name: "France" },
  { code: "+32",  flag: "be", name: "Belgique" },
  { code: "+44",  flag: "gb", name: "Royaume-Uni" },
  { code: "+41",  flag: "ch", name: "Suisse" },
  { code: "+49",  flag: "de", name: "Allemagne" },
  { code: "+52",  flag: "mx", name: "Mexique" },
  { code: "+27",  flag: "za", name: "Afrique du Sud" },
];

const TRANSPORT_OPTIONS = [
  { key: "avion", label: "Avion" },
  { key: "autocar", label: "Autocar / Bus" },
  { key: "voiture", label: "Voiture" },
  { key: "autre", label: "Autre" },
];

interface FormState {
  firstName: string;
  lastName: string;
  email: string;
  telephone: string;
  country: string;
  city: string;
  transportType: string;
  needsLodging: boolean;
  identityFile: File | null;
  transportFile: File | null;
}

function UploadZone({ label, hint, file, preview, onPick, onClear, accent }: {
  label: string; hint: string; file: File | null; preview: string | null;
  onPick: (f: File) => void; onClear: () => void; accent: React.ReactNode;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);

  return (
    <div>
      <label className="block text-[10px] uppercase text-slate-400 font-bold mb-2">{label}</label>
      <div
        onDragEnter={e => { e.preventDefault(); setDrag(true); }}
        onDragOver={e => { e.preventDefault(); setDrag(true); }}
        onDragLeave={e => { e.preventDefault(); setDrag(false); }}
        onDrop={e => { e.preventDefault(); setDrag(false); if (e.dataTransfer.files?.[0]) onPick(e.dataTransfer.files[0]); }}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${drag ? "border-[#f7d618] bg-[#f7d618]/5" : "border-white/10 bg-white/5 hover:border-white/20"}`}
      >
        <input type="file" ref={inputRef} accept="image/jpeg,image/png,application/pdf" className="hidden"
          onChange={e => { if (e.target.files?.[0]) onPick(e.target.files[0]); }} />
        {!file ? (
          <div>
            <div className="flex justify-center mb-2 text-slate-400">{accent}</div>
            <span className="text-xs font-semibold text-slate-300">Glissez-déposez ou cliquez pour parcourir</span>
            <span className="text-[9px] text-slate-500 block mt-1">{hint}</span>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-4 text-left">
            {preview === "pdf" ? <FileText size={28} className="text-slate-300" />
              : preview ? <img src={preview} alt="" className="h-12 w-12 object-cover rounded border border-white/10" /> : null}
            <div className="min-w-0">
              <p className="text-xs font-bold text-white max-w-[200px] truncate">{file.name}</p>
              <p className="text-[10px] text-[#f7d618] font-semibold">Document prêt</p>
            </div>
            <button type="button" onClick={e => { e.stopPropagation(); onClear(); }}
              className="ml-auto text-xs text-red-400 hover:text-red-300 font-bold">Retirer</button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function GuadalajaraFlow() {
  const [form, setForm] = useState<FormState>({
    firstName: "", lastName: "", email: "", telephone: "",
    country: "Canada", city: "", transportType: "", needsLodging: false,
    identityFile: null, transportFile: null,
  });
  const [phonePrefix, setPhonePrefix] = useState("+1");
  const [showPrefix, setShowPrefix] = useState(false);
  const prefixRef = useRef<HTMLDivElement>(null);
  const [idPreview, setIdPreview] = useState<string | null>(null);
  const [transportPreview, setTransportPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [reference, setReference] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [hp, setHp] = useState(""); // honeypot anti-bot (doit rester vide)
  const mountedAt = useRef(Date.now());

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (prefixRef.current && !prefixRef.current.contains(e.target as Node)) setShowPrefix(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const set = (key: keyof FormState, val: any) => { setForm(p => ({ ...p, [key]: val })); setError(null); };

  const makePreview = (file: File, setter: (v: string | null) => void) => {
    if (file.type === "application/pdf") { setter("pdf"); return; }
    const reader = new FileReader();
    reader.onloadend = () => setter(reader.result as string);
    reader.readAsDataURL(file);
  };

  const pickFile = (file: File, key: "identityFile" | "transportFile", setter: (v: string | null) => void) => {
    const allowed = ["image/jpeg", "image/png", "application/pdf"];
    if (!allowed.includes(file.type)) { setError("Format non supporté. Utilisez JPG, PNG ou PDF."); return; }
    if (file.size > 8 * 1024 * 1024) { setError("Fichier trop volumineux. Max 8 Mo."); return; }
    set(key, file);
    makePreview(file, setter);
  };

  const validate = () => {
    if (!form.firstName.trim() || !form.lastName.trim()) return "Prénom et nom requis.";
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return "Adresse email valide requise.";
    if (!form.telephone.trim()) return "Numéro de téléphone (WhatsApp de préférence) requis.";
    if (!form.identityFile) return "Pièce d'identité requise.";
    if (!form.transportFile) return "Preuve de réservation de transport requise.";
    return null;
  };

  const submit = async () => {
    const err = validate();
    if (err) { setError(err); return; }
    setLoading(true);
    setError(null);

    const phoneVal = form.telephone.trim();
    const fullPhone = phoneVal.startsWith("+") ? phoneVal : `${phonePrefix} ${phoneVal}`.trim();

    const fd = new FormData();
    fd.append("first_name", form.firstName);
    fd.append("last_name", form.lastName);
    fd.append("email", form.email);
    fd.append("phone", fullPhone);
    fd.append("whatsapp", fullPhone);
    fd.append("country", form.country);
    fd.append("city", form.city);
    fd.append("transport_type", form.transportType);
    fd.append("needs_lodging", String(form.needsLodging));
    if (form.identityFile) fd.append("identity", form.identityFile);
    if (form.transportFile) fd.append("transport_proof", form.transportFile);
    fd.append("_hp", hp);
    fd.append("_t", String(mountedAt.current));

    try {
      const res = await fetch("/api/mondial/guadalajara", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Une erreur est survenue."); return; }
      setReference(data.reference);
      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setError("Impossible de joindre le serveur. Vérifiez votre connexion.");
    } finally {
      setLoading(false);
    }
  };

  const currentPrefix = PREFIXES.find(p => p.code === phonePrefix) || PREFIXES[0];

  return (
    <div className="min-h-screen text-white relative font-sans" style={{ background: "#080c1a" }}>
      <div className="fixed top-0 left-0 right-0 z-50 flex items-center bg-[#080c1a]/90 backdrop-blur-md border-b border-white/5" style={{ padding: "10px 16px", minHeight: 60 }}>
        <div style={{ width: 80, flexShrink: 0 }} />
        <div className="flex-1 flex items-center justify-center gap-3">
          <img src="/brand/logo.png" alt="Bloc Léopards" style={{ height: 44, width: "auto", objectFit: "contain", filter: "drop-shadow(0 0 8px rgba(247,214,24,0.3))" }} />
          <div style={{ width: 1, height: 28, background: "rgba(255,255,255,0.2)" }} />
          <img src="/brand/logo-min-sport-white.webp" alt="Ministère des Sports" style={{ height: 36, width: "auto", objectFit: "contain", opacity: 0.95 }} />
        </div>
        <div style={{ width: 80, flexShrink: 0, textAlign: "right" }}>
          <a href="/mondial" className="text-[10px] font-semibold text-[#f7d618] hover:underline">Hub →</a>
        </div>
      </div>

      <div className="max-w-xl mx-auto px-4 pt-24 pb-16 flex flex-col justify-center min-h-[90vh]">
        <AnimatePresence mode="wait">
          {!submitted ? (
            <motion.div key="form" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} transition={{ duration: 0.3 }}>
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <img src="/flags/cd.png" alt="RDC" className="h-6 w-auto rounded shadow object-cover" />
                  <span className="font-bebas text-lg text-slate-300">VS</span>
                  <img src="/flags/co.png" alt="Colombie" className="h-6 w-auto rounded shadow object-cover" />
                </div>
                <span className="text-[10px] uppercase tracking-[0.2em] text-[#f7d618] font-bold">Programme diaspora · Ministère des Sports</span>
                <h2 className="font-bebas text-4xl text-white tracking-wide mt-1">LE BLOC DE GUADALAJARA</h2>
                <p className="text-slate-400 text-xs mt-2 leading-relaxed">
                  Pour le match RDC – Colombie du 23 juin 2026 à Guadalajara (Mexique), le Ministère met à disposition des supporters sélectionnés un <span className="text-slate-200 font-semibold">billet de match gratuit</span> et jusqu'à <span className="text-slate-200 font-semibold">2 nuitées d'hébergement</span>. Soumettez votre demande ci-dessous.
                </p>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] uppercase text-slate-400 font-bold mb-1.5">Prénom *</label>
                    <input type="text" value={form.firstName} onChange={e => set("firstName", e.target.value)}
                      className="w-full bg-white/5 border border-white/10 focus:border-[#f7d618] rounded-xl px-4 py-3 text-sm outline-none transition-colors" />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase text-slate-400 font-bold mb-1.5">Nom *</label>
                    <input type="text" value={form.lastName} onChange={e => set("lastName", e.target.value)}
                      className="w-full bg-white/5 border border-white/10 focus:border-[#f7d618] rounded-xl px-4 py-3 text-sm outline-none transition-colors" />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] uppercase text-slate-400 font-bold mb-1.5">Email *</label>
                  <input type="email" value={form.email} onChange={e => set("email", e.target.value)}
                    className="w-full bg-white/5 border border-white/10 focus:border-[#f7d618] rounded-xl px-4 py-3 text-sm outline-none transition-colors" />
                  <p className="text-[10px] text-slate-500 mt-1">Le billet électronique sera envoyé à cette adresse si vous êtes retenu.</p>
                </div>

                <div>
                  <label className="block text-[10px] uppercase text-slate-400 font-bold mb-1.5">Téléphone / WhatsApp *</label>
                  <div className="flex gap-2 relative" ref={prefixRef}>
                    <div className="relative">
                      <button type="button" onClick={() => setShowPrefix(o => !o)}
                        className="h-full flex items-center gap-1.5 bg-white/5 border border-white/10 hover:border-white/20 rounded-xl px-3 outline-none transition-colors text-sm font-semibold" style={{ minWidth: 90 }}>
                        <img src={`/flags/${currentPrefix.flag}.png`} alt="" style={{ height: 18, width: 24 }} className="object-cover rounded shadow-sm" />
                        <span className="text-white text-xs">{currentPrefix.code}</span>
                        <span className="text-[10px] text-slate-400">▼</span>
                      </button>
                      {showPrefix && (
                        <div className="absolute left-0 mt-1 max-h-60 overflow-y-auto bg-[#0d1221] border border-white/12 rounded-xl z-30 shadow-2xl" style={{ width: 220 }}>
                          {PREFIXES.map(p => (
                            <button key={p.code} type="button" onClick={() => { setPhonePrefix(p.code); setShowPrefix(false); }}
                              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 border-b border-white/5 last:border-0 text-left text-xs transition-colors">
                              <img src={`/flags/${p.flag}.png`} alt="" style={{ height: 18, width: 24 }} className="object-cover rounded shadow-sm" />
                              <span className="font-bold text-white text-xs w-10">{p.code}</span>
                              <span className="text-slate-400 text-[11px] truncate">{p.name}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <input type="tel" value={form.telephone} onChange={e => set("telephone", e.target.value)}
                      className="flex-1 bg-white/5 border border-white/10 focus:border-[#f7d618] rounded-xl px-4 py-3 text-sm outline-none transition-colors" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] uppercase text-slate-400 font-bold mb-1.5">Pays de résidence</label>
                    <CountrySelectMondial value={form.country} onChange={v => set("country", v)} />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase text-slate-400 font-bold mb-1.5">Ville</label>
                    <input type="text" value={form.city} onChange={e => set("city", e.target.value)}
                      className="w-full bg-white/5 border border-white/10 focus:border-[#f7d618] rounded-xl px-4 py-3 text-sm outline-none transition-colors" />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] uppercase text-slate-400 font-bold mb-2">Moyen de transport prévu vers Guadalajara</label>
                  <div className="grid grid-cols-4 gap-2">
                    {TRANSPORT_OPTIONS.map(t => (
                      <button key={t.key} type="button" onClick={() => set("transportType", t.key)}
                        className={`py-2.5 rounded-xl text-xs font-bold border transition-all ${form.transportType === t.key ? "bg-[#f7d618]/10 border-[#f7d618] text-[#f7d618]" : "bg-white/5 border-white/10 text-slate-400 hover:border-white/20"}`}>
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                <UploadZone
                  label="Pièce d'identité (passeport ou pièce officielle) *"
                  hint="JPG, PNG ou PDF. Max 8 Mo."
                  file={form.identityFile} preview={idPreview}
                  onPick={f => pickFile(f, "identityFile", setIdPreview)}
                  onClear={() => { set("identityFile", null); setIdPreview(null); }}
                  accent={<UploadCloud size={28} />}
                />

                <UploadZone
                  label="Preuve de réservation de transport *"
                  hint="Billet d'avion, autocar ou autre. JPG, PNG ou PDF. Max 8 Mo."
                  file={form.transportFile} preview={transportPreview}
                  onPick={f => pickFile(f, "transportFile", setTransportPreview)}
                  onClear={() => { set("transportFile", null); setTransportPreview(null); }}
                  accent={<Plane size={28} />}
                />

                <label className="flex items-start gap-3 cursor-pointer select-none bg-white/5 border border-white/10 rounded-2xl p-4">
                  <input type="checkbox" checked={form.needsLodging} onChange={e => set("needsLodging", e.target.checked)}
                    className="mt-0.5 accent-[#f7d618] flex-shrink-0" />
                  <span className="text-xs text-slate-300 leading-normal">
                    Je souhaite bénéficier des nuitées d'hébergement à Guadalajara (jusqu'à 2 nuits, selon disponibilité).
                  </span>
                </label>

                <div className="space-y-3 bg-white/5 border border-white/10 rounded-2xl p-5">
                  <p className="text-[10px] uppercase tracking-[0.15em] text-slate-400 font-bold mb-1">Engagement *</p>
                  <label className="flex items-start gap-3 cursor-pointer select-none">
                    <input type="checkbox" required className="mt-0.5 accent-[#f7d618] flex-shrink-0" />
                    <span className="text-xs text-slate-300 leading-normal">Je certifie être en règle avec les conditions d'entrée au Mexique (visa/documents nécessaires).</span>
                  </label>
                  <label className="flex items-start gap-3 cursor-pointer select-none">
                    <input type="checkbox" required className="mt-0.5 accent-[#f7d618] flex-shrink-0" />
                    <span className="text-xs text-slate-300 leading-normal">J'accepte que mes informations soient utilisées pour l'attribution des billets, la réservation d'hébergement et la sécurité, conformément au communiqué du Ministère.</span>
                  </label>
                </div>
              </div>

              {/* Honeypot anti-bot — invisible aux humains */}
              <input type="text" name="_hp" value={hp} onChange={(e) => setHp(e.target.value)} tabIndex={-1} autoComplete="off" aria-hidden="true"
                style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }} />

              {error && <div className="mt-4 p-3 rounded-xl bg-red-950/40 border border-red-500/20 text-xs text-red-300">{error}</div>}

              <button type="button" onClick={submit} disabled={loading}
                className="w-full mt-6 py-4 rounded-xl bg-[#f7d618] text-[#07090f] font-bebas text-lg tracking-wider font-bold hover:bg-yellow-400 transition-colors shadow-[0_4px_20px_rgba(247,214,24,0.3)] flex items-center justify-center gap-2">
                {loading ? <span className="w-5 h-5 border-2 border-[#07090f] border-t-transparent rounded-full animate-spin" /> : "Envoyer ma demande"}
              </button>
            </motion.div>
          ) : (
            <motion.div key="success" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }} className="text-center">
              <div className="text-5xl mb-4" style={{ color: "#f7d618" }}>★</div>
              <h2 className="font-bebas text-4xl text-[#f7d618] tracking-wide mb-2">DEMANDE ENVOYÉE !</h2>
              <p className="text-xs text-slate-400 max-w-sm mx-auto mb-8 leading-normal">
                Votre demande pour le Bloc de Guadalajara a bien été reçue. Le Ministère examinera votre dossier. Conservez votre numéro de demande.
              </p>

              <div className="relative max-w-sm mx-auto bg-gradient-to-b from-[#1c2e8f] to-[#07090f] border border-[#f7d618]/30 rounded-3xl overflow-hidden shadow-2xl p-6 mb-8">
                <div className="absolute top-0 inset-x-0 h-1 bg-[#f7d618]" />
                <div className="flex justify-between items-center mb-6">
                  <div className="text-left">
                    <span className="text-[9px] uppercase tracking-wider text-slate-400 block font-bold">Demande officielle</span>
                    <span className="font-bebas text-xl text-white tracking-wide">BLOC DE GUADALAJARA</span>
                  </div>
                  <img src="/brand/logo.png" alt="RDC" className="h-10 w-auto" />
                </div>
                <div className="space-y-3 text-left border-y border-white/10 py-4 mb-4">
                  <div className="flex justify-between text-xs"><span className="text-slate-400">Demandeur</span><span className="font-bold text-white">{form.firstName} {form.lastName}</span></div>
                  <div className="flex justify-between text-xs"><span className="text-slate-400">Match</span><span className="font-bold text-white">RDC vs Colombie</span></div>
                  <div className="flex justify-between text-xs"><span className="text-slate-400">Date</span><span className="font-bold text-white">23 juin 2026 · Guadalajara</span></div>
                  <div className="flex justify-between text-xs"><span className="text-slate-400">Statut</span><span className="font-bold text-yellow-400">En cours de vérification</span></div>
                </div>
                <div className="text-center py-2">
                  <span className="text-[10px] text-slate-400 block font-bold">Numéro de demande</span>
                  <span className="font-bebas text-2xl text-[#f7d618] tracking-widest">{reference}</span>
                </div>
              </div>

              <div className="flex flex-col justify-center gap-3 sm:flex-row">
                <a href="/mondial" className="px-6 py-3 rounded-full border border-white/20 text-xs font-bold hover:bg-white/5 transition-colors">← Retour au Hub</a>
                <a href={`https://wa.me/?text=${encodeURIComponent(`J'ai soumis ma demande pour le Bloc de Guadalajara (RDC vs Colombie). Réf : ${reference}`)}`}
                  target="_blank" rel="noopener noreferrer"
                  className="px-6 py-3 rounded-full bg-[#25d366] text-white text-xs font-bold hover:bg-[#20ba56] transition-colors">
                  Partager sur WhatsApp
                </a>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
