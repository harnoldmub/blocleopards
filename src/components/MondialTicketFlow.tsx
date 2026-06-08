import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, UploadCloud, FileText, Download } from "lucide-react";
import CountrySelectMondial from "./CountrySelectMondial";

// ─── Data ─────────────────────────────────────────────────────────────────────

const US_STATES = [
  { code: "AL", name: "Alabama" }, { code: "AK", name: "Alaska" }, { code: "AZ", name: "Arizona" },
  { code: "AR", name: "Arkansas" }, { code: "CA", name: "Californie" }, { code: "CO", name: "Colorado" },
  { code: "CT", name: "Connecticut" }, { code: "DE", name: "Delaware" }, { code: "FL", name: "Floride" },
  { code: "GA", name: "Géorgie" }, { code: "HI", name: "Hawaï" }, { code: "ID", name: "Idaho" },
  { code: "IL", name: "Illinois" }, { code: "IN", name: "Indiana" }, { code: "IA", name: "Iowa" },
  { code: "KS", name: "Kansas" }, { code: "KY", name: "Kentucky" }, { code: "LA", name: "Louisiane" },
  { code: "ME", name: "Maine" }, { code: "MD", name: "Maryland" }, { code: "MA", name: "Massachusetts" },
  { code: "MI", name: "Michigan" }, { code: "MN", name: "Minnesota" }, { code: "MS", name: "Mississippi" },
  { code: "MO", name: "Missouri" }, { code: "MT", name: "Montana" }, { code: "NE", name: "Nebraska" },
  { code: "NV", name: "Nevada" }, { code: "NH", name: "New Hampshire" }, { code: "NJ", name: "New Jersey" },
  { code: "NM", name: "Nouveau-Mexique" }, { code: "NY", name: "New York" }, { code: "NC", name: "Caroline du Nord" },
  { code: "ND", name: "Dakota du Nord" }, { code: "OH", name: "Ohio" }, { code: "OK", name: "Oklahoma" },
  { code: "OR", name: "Oregon" }, { code: "PA", name: "Pennsylvanie" }, { code: "RI", name: "Rhode Island" },
  { code: "SC", name: "Caroline du Sud" }, { code: "SD", name: "Dakota du Sud" }, { code: "TN", name: "Tennessee" },
  { code: "TX", name: "Texas" }, { code: "UT", name: "Utah" }, { code: "VT", name: "Vermont" },
  { code: "VA", name: "Virginie" }, { code: "WA", name: "Washington" }, { code: "WV", name: "Virginie-Occidentale" },
  { code: "WI", name: "Wisconsin" }, { code: "WY", name: "Wyoming" }, { code: "DC", name: "District of Columbia" }
].sort((a, b) => a.name.localeCompare(b.name));

const MATCHES = [
  { key: "houston", label: "RDC vs Portugal", details: "Houston · 17 Juin 2026", flag: "pt" },
  { key: "guadalajara", label: "RDC vs Colombie", details: "Guadalajara (Mexique) · 23 Juin 2026", flag: "co", notice: "Attention: Match au Mexique (visa Mexique requis)" },
  { key: "atlanta", label: "RDC vs Ouzbékistan", details: "Atlanta · 27 Juin 2026", flag: "uz" }
];

type Step = "identity" | "matches" | "engagement" | "success";

interface FormState {
  firstName: string;
  lastName: string;
  gender: "Homme" | "Femme" | "";
  dateOfBirth: string;
  email: string;
  telephone: string;
  whatsapp: string;
  country: string;
  city: string;
  stateUs: string;
  isDiasporaRdc: boolean | null;
  matchesVises: string[];
  optInMur: boolean;
  documentType: "PASSPORT" | "DRIVER_LICENSE";
  documentFile: File | null;
  portraitFile: File | null;
}

export default function MondialTicketFlow() {
  const [currentStep, setCurrentStep] = useState<Step>("identity");
  const [form, setForm] = useState<FormState>({
    firstName: "",
    lastName: "",
    gender: "",
    dateOfBirth: "",
    email: "",
    telephone: "",
    whatsapp: "",
    country: "États-Unis",
    city: "",
    stateUs: "",
    isDiasporaRdc: null,
    matchesVises: [],
    optInMur: false,
    documentType: "PASSPORT",
    documentFile: null,
    portraitFile: null
  });

  const [stateSearch, setStateSearch] = useState("");
  const [showStateDropdown, setShowStateDropdown] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [portraitPreview, setPortraitPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [ticketNumber, setTicketNumber] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const portraitInputRef = useRef<HTMLInputElement>(null);

  // ─── Handlers ───────────────────────────────────────────────────────────────

  const handleTextChange = (key: keyof FormState, val: any) => {
    setForm(prev => ({ ...prev, [key]: val }));
    setError(null);
  };

  const handleStateSelect = (stateName: string) => {
    setForm(prev => ({ ...prev, stateUs: stateName }));
    setStateSearch(stateName);
    setShowStateDropdown(false);
    setError(null);
  };

  const processFile = (file: File) => {
    const allowed = ["image/jpeg", "image/png", "application/pdf"];
    if (!allowed.includes(file.type)) {
      setError("Format de fichier non supporté. Utilisez du JPG, PNG ou PDF.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Fichier trop volumineux. Taille max : 5 Mo.");
      return;
    }
    
    setForm(prev => ({ ...prev, documentFile: file }));
    setError(null);

    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFilePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setFilePreview("pdf");
    }
  };

  const processPortraitFile = (file: File) => {
    const allowed = ["image/jpeg", "image/png"];
    if (!allowed.includes(file.type)) {
      setError("Photo portrait invalide. Utilisez une image JPG ou PNG.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Photo trop volumineuse. Taille max : 5 Mo.");
      return;
    }

    setForm(prev => ({ ...prev, portraitFile: file }));
    setError(null);

    const reader = new FileReader();
    reader.onloadend = () => {
      setPortraitPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const handlePortraitInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processPortraitFile(e.target.files[0]);
    }
  };

  const handleMatchToggle = (key: string) => {
    setForm(prev => {
      const exists = prev.matchesVises.includes(key);
      const next = exists 
        ? prev.matchesVises.filter(m => m !== key)
        : [...prev.matchesVises, key];
      return { ...prev, matchesVises: next };
    });
    setError(null);
  };

  // ─── Navigation & Validation ───────────────────────────────────────────────

  const validateIdentity = () => {
    if (!form.firstName.trim() || !form.lastName.trim()) return "Prénom et nom requis.";
    if (!form.dateOfBirth) return "Date de naissance requise.";
    if (!form.gender) return "Genre requis.";
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return "Adresse email valide requise.";
    if (!form.telephone.trim()) return "Numéro de téléphone requis.";
    if (!form.country) return "Pays de résidence requis.";
    if (form.country === "États-Unis" && !form.stateUs) return "État de résidence requis.";
    if (!form.city.trim()) return "Ville de résidence requise.";
    if (form.isDiasporaRdc === null) return "Veuillez indiquer si vous êtes membre de la diaspora RDC.";
    if (!form.documentFile) return "Pièce d'identité requise.";
    if (!form.portraitFile) return "Photo portrait requise pour croiser avec la pièce d'identité.";
    return null;
  };

  const nextStep = () => {
    if (currentStep === "identity") {
      const err = validateIdentity();
      if (err) {
        setError(err);
        return;
      }
      setCurrentStep("matches");
    } else if (currentStep === "matches") {
      if (form.matchesVises.length === 0) {
        setError("Veuillez sélectionner au moins un match.");
        return;
      }
      setCurrentStep("engagement");
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const prevStep = () => {
    if (currentStep === "matches") setCurrentStep("identity");
    else if (currentStep === "engagement") setCurrentStep("matches");
  };

  const submitForm = async () => {
    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append("first_name", form.firstName);
    formData.append("last_name", form.lastName);
    formData.append("gender", form.gender);
    formData.append("date_of_birth", form.dateOfBirth);
    formData.append("email", form.email);
    formData.append("telephone", form.telephone);
    if (form.whatsapp) formData.append("whatsapp", form.whatsapp);
    formData.append("country", form.country);
    formData.append("city", form.city);
    if (form.stateUs) formData.append("state_us", form.stateUs);
    formData.append("is_diaspora_rdc", String(form.isDiasporaRdc === true));
    formData.append("matchs_vises", JSON.stringify(form.matchesVises));
    formData.append("opt_in_mur", String(form.optInMur));
    formData.append("document_type", form.documentType);
    if (form.documentFile) {
      formData.append("document", form.documentFile);
    }
    if (form.portraitFile) {
      formData.append("portrait", form.portraitFile);
    }

    try {
      const res = await fetch("/api/mondial/inscrire", {
        method: "POST",
        body: formData
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Une erreur est survenue lors de l'inscription.");
        return;
      }
      setTicketNumber(data.ticketNumber);
      setCurrentStep("success");
    } catch {
      setError("Impossible de joindre le serveur. Vérifiez votre connexion.");
    } finally {
      setLoading(false);
    }
  };

  const downloadConfirmationCard = async () => {
    if (!ticketNumber) return;

    const width = 1080;
    const height = 1500;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const loadImage = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });

    const roundRect = (x: number, y: number, w: number, h: number, r: number) => {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    };

    const drawLabelValue = (label: string, value: string, y: number, color = "#ffffff") => {
      ctx.font = "700 28px Arial";
      ctx.fillStyle = "rgba(226,232,240,0.62)";
      ctx.fillText(label, 90, y);
      ctx.font = "800 34px Arial";
      ctx.fillStyle = color;
      ctx.textAlign = "right";
      ctx.fillText(value, width - 90, y);
      ctx.textAlign = "left";
    };

    const drawWrappedCentered = (text: string, y: number, maxWidth: number, lineHeight: number) => {
      const words = text.split(" ");
      const lines: string[] = [];
      let line = "";
      words.forEach((word) => {
        const next = line ? `${line} ${word}` : word;
        if (ctx.measureText(next).width > maxWidth && line) {
          lines.push(line);
          line = word;
        } else {
          line = next;
        }
      });
      if (line) lines.push(line);
      lines.forEach((textLine, index) => ctx.fillText(textLine, width / 2, y + index * lineHeight));
    };

    const bg = ctx.createLinearGradient(0, 0, 0, height);
    bg.addColorStop(0, "#1c2e8f");
    bg.addColorStop(0.55, "#0a1230");
    bg.addColorStop(1, "#07090f");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = "#f7d618";
    ctx.fillRect(0, 0, width, 18);
    ctx.fillRect(0, height - 18, width, 18);

    roundRect(56, 64, width - 112, height - 128, 54);
    ctx.fillStyle = "rgba(7,9,15,0.42)";
    ctx.fill();
    ctx.strokeStyle = "rgba(247,214,24,0.35)";
    ctx.lineWidth = 3;
    ctx.stroke();

    try {
      const logo = await loadImage("/brand/logo.png");
      const ratio = logo.width / logo.height;
      const logoHeight = 110;
      ctx.drawImage(logo, width / 2 - (logoHeight * ratio) / 2, 110, logoHeight * ratio, logoHeight);
    } catch {
      ctx.fillStyle = "#f7d618";
      ctx.font = "900 40px Arial";
      ctx.textAlign = "center";
      ctx.fillText("BLOC LÉOPARDS", width / 2, 170);
    }

    ctx.textAlign = "center";
    ctx.fillStyle = "#f7d618";
    ctx.font = "900 34px Arial";
    ctx.fillText("COUPE DU MONDE 2026", width / 2, 280);
    ctx.fillStyle = "#ffffff";
    ctx.font = "900 72px Arial";
    ctx.fillText("CARTE D'INSCRIPTION", width / 2, 365);

    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(90, 435);
    ctx.lineTo(width - 90, 435);
    ctx.stroke();

    drawLabelValue("Candidat", `${form.firstName} ${form.lastName}`, 520);
    drawLabelValue("Résidence", `${form.city}${form.stateUs ? `, ${form.stateUs}` : ""}`, 605);
    drawLabelValue("Numéro", ticketNumber, 690, "#f7d618");

    ctx.fillStyle = "rgba(226,232,240,0.62)";
    ctx.font = "700 28px Arial";
    ctx.textAlign = "center";
    ctx.fillText("Matchs visés", width / 2, 790);
    ctx.fillStyle = "#ffffff";
    ctx.font = "900 34px Arial";
    drawWrappedCentered(selectedMatchLabels, 845, width - 180, 48);

    try {
      const qr = await loadImage(`https://api.qrserver.com/v1/create-qr-code/?size=420x420&data=${encodeURIComponent(statusUrl)}`);
      roundRect(width / 2 - 230, 1010, 460, 460, 32);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      ctx.drawImage(qr, width / 2 - 200, 1040, 400, 400);
    } catch {
      roundRect(width / 2 - 230, 1010, 460, 180, 32);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      ctx.fillStyle = "#07090f";
      ctx.font = "800 26px Arial";
      ctx.textAlign = "center";
      drawWrappedCentered(statusUrl, 1075, 360, 34);
    }

    ctx.fillStyle = "rgba(226,232,240,0.75)";
    ctx.font = "700 26px Arial";
    ctx.textAlign = "center";
    ctx.fillText("Scanne le QR code ou garde cette carte en capture.", width / 2, 1360);
    ctx.fillStyle = "rgba(247,214,24,0.9)";
    ctx.font = "800 24px Arial";
    drawWrappedCentered(statusUrl, 1412, width - 180, 34);

    const link = document.createElement("a");
    link.download = `bloc-leopards-${ticketNumber}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  // ─── Renders ───────────────────────────────────────────────────────────────

  const filteredStates = US_STATES.filter(s => 
    s.name.toLowerCase().includes(stateSearch.toLowerCase()) ||
    s.code.toLowerCase().includes(stateSearch.toLowerCase())
  );
  const statusPath = ticketNumber ? `/mondial/tirage?ticket=${encodeURIComponent(ticketNumber)}` : "/mondial/tirage";
  const statusUrl = typeof window !== "undefined" ? `${window.location.origin}${statusPath}` : statusPath;
  const selectedMatchLabels = form.matchesVises
    .map((key) => MATCHES.find((match) => match.key === key)?.label || key)
    .join(", ");

  return (
    <div className="min-h-screen text-white relative font-sans" style={{ background: "#080c1a" }}>
      
      {/* Top Header Navigation */}
      <div className="fixed top-0 left-0 right-0 z-50 flex items-center bg-[#080c1a]/90 backdrop-blur-md border-b border-white/5" style={{ padding: "10px 16px", minHeight: 60 }}>
        {/* Back button */}
        <div style={{ width: 80, flexShrink: 0 }}>
          {currentStep !== "identity" && currentStep !== "success" && (
            <button
              type="button"
              onClick={prevStep}
              className="px-3 py-1.5 rounded-full border border-white/10 hover:bg-white/5 text-xs font-semibold"
            >
              ← Retour
            </button>
          )}
        </div>

        {/* Logos centered */}
        <div className="flex-1 flex items-center justify-center gap-3">
          <img src="/brand/logo.png" alt="Bloc Léopards" style={{ height: 44, width: "auto", objectFit: "contain", filter: "drop-shadow(0 0 8px rgba(247,214,24,0.3))" }} />
          <div style={{ width: 1, height: 28, background: "rgba(255,255,255,0.2)" }} />
          <img src="/brand/logo-min-sport-white.webp" alt="Ministère des Sports" style={{ height: 36, width: "auto", objectFit: "contain", opacity: 0.95 }} />
        </div>

        {/* Hub link */}
        <div style={{ width: 80, flexShrink: 0, textAlign: "right" }}>
          <a href="/mondial" className="text-[10px] font-semibold text-[#f7d618] hover:underline">
            Hub →
          </a>
        </div>
      </div>

      <div className="max-w-xl mx-auto px-4 pt-24 pb-16 flex flex-col justify-center min-h-[90vh]">
        <AnimatePresence mode="wait">
          
          {/* STEP 1: IDENTITY */}
          {currentStep === "identity" && (
            <motion.div
              key="step-identity"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3 }}
            >
              <div className="mb-6">
                <span className="text-[10px] uppercase tracking-[0.2em] text-[#f7d618] font-bold">Étape 1 de 3</span>
                <h2 className="font-bebas text-4xl text-white tracking-wide mt-1">VÉRIFICATION DE RÉSIDENCE & IDENTITÉ</h2>
                <p className="text-slate-400 text-xs mt-1">Ouvert à la diaspora RDC dans le monde entier. Remplis chaque champ avec soin.</p>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] uppercase text-slate-400 font-bold mb-1.5">Prénom *</label>
                    <input 
                      type="text" 
                      value={form.firstName} 
                      onChange={e => handleTextChange("firstName", e.target.value)}
                      className="w-full bg-white/5 border border-white/10 focus:border-[#f7d618] rounded-xl px-4 py-3 text-sm outline-none transition-colors"
                      placeholder="John"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase text-slate-400 font-bold mb-1.5">Nom *</label>
                    <input 
                      type="text" 
                      value={form.lastName} 
                      onChange={e => handleTextChange("lastName", e.target.value)}
                      className="w-full bg-white/5 border border-white/10 focus:border-[#f7d618] rounded-xl px-4 py-3 text-sm outline-none transition-colors"
                      placeholder="Doe"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] uppercase text-slate-400 font-bold mb-2">Genre *</label>
                  <div className="flex gap-3">
                    {(["Homme", "Femme"] as const).map(g => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => handleTextChange("gender", g)}
                        className={`flex-1 py-3 rounded-xl text-xs font-bold border transition-all ${form.gender === g ? "bg-[#f7d618]/10 border-[#f7d618] text-[#f7d618]" : "bg-white/5 border-white/10 text-slate-400 hover:border-white/20"}`}
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] uppercase text-slate-400 font-bold mb-1.5">Date de naissance *</label>
                  <input
                    type="date"
                    value={form.dateOfBirth}
                    onChange={e => handleTextChange("dateOfBirth", e.target.value)}
                    className="w-full bg-white/5 border border-white/10 focus:border-[#f7d618] rounded-xl px-4 py-3 text-sm outline-none transition-colors text-slate-300"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase text-slate-400 font-bold mb-1.5">Email *</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={e => handleTextChange("email", e.target.value)}
                    className="w-full bg-white/5 border border-white/10 focus:border-[#f7d618] rounded-xl px-4 py-3 text-sm outline-none transition-colors"
                    placeholder="john.doe@email.com"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] uppercase text-slate-400 font-bold mb-1.5">Téléphone *</label>
                    <input
                      type="tel"
                      value={form.telephone}
                      onChange={e => handleTextChange("telephone", e.target.value)}
                      className="w-full bg-white/5 border border-white/10 focus:border-[#f7d618] rounded-xl px-4 py-3 text-sm outline-none transition-colors"
                      placeholder="+1 (555) 000-0000"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase text-slate-400 font-bold mb-1.5">WhatsApp</label>
                    <input
                      type="tel"
                      value={form.whatsapp}
                      onChange={e => handleTextChange("whatsapp", e.target.value)}
                      className="w-full bg-white/5 border border-white/10 focus:border-[#f7d618] rounded-xl px-4 py-3 text-sm outline-none transition-colors"
                      placeholder="+1 (555) 000-0000"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] uppercase text-slate-400 font-bold mb-1.5">Pays de résidence *</label>
                  <CountrySelectMondial
                    value={form.country}
                    onChange={v => {
                      handleTextChange("country", v);
                      if (v !== "États-Unis") handleTextChange("stateUs", "");
                    }}
                  />
                </div>

                <div className={`grid gap-4 ${form.country === "États-Unis" ? "grid-cols-2" : "grid-cols-1"}`}>
                  {form.country === "États-Unis" && (
                    <div className="relative">
                      <label className="block text-[10px] uppercase text-slate-400 font-bold mb-1.5">État *</label>
                      <input
                        type="text"
                        value={form.stateUs || stateSearch}
                        onChange={e => {
                          handleTextChange("stateUs", "");
                          setStateSearch(e.target.value);
                          setShowStateDropdown(true);
                        }}
                        onFocus={() => setShowStateDropdown(true)}
                        className="w-full bg-white/5 border border-white/10 focus:border-[#f7d618] rounded-xl px-4 py-3 text-sm outline-none transition-colors"
                        placeholder="Ex: Texas"
                      />
                      {showStateDropdown && (
                        <div className="absolute left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-[#0d1221] border border-white/10 rounded-xl z-20 shadow-xl">
                          {filteredStates.length > 0 ? filteredStates.map(state => (
                            <button
                              key={state.code}
                              type="button"
                              onClick={() => handleStateSelect(state.name)}
                              className="w-full text-left px-4 py-2 hover:bg-white/5 text-xs transition-colors border-b border-white/5 last:border-0"
                            >
                              {state.name} ({state.code})
                            </button>
                          )) : (
                            <div className="px-4 py-2 text-xs text-slate-500">Aucun État trouvé</div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  <div>
                    <label className="block text-[10px] uppercase text-slate-400 font-bold mb-1.5">Ville *</label>
                    <input
                      type="text"
                      value={form.city}
                      onChange={e => handleTextChange("city", e.target.value)}
                      className="w-full bg-white/5 border border-white/10 focus:border-[#f7d618] rounded-xl px-4 py-3 text-sm outline-none transition-colors"
                      placeholder="Ex: Houston"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] uppercase text-slate-400 font-bold mb-2">Êtes-vous membre de la diaspora RDC ? *</label>
                  <div className="flex gap-3">
                    {[{ val: true, label: "Oui" }, { val: false, label: "Non" }].map(opt => (
                      <button
                        key={String(opt.val)}
                        type="button"
                        onClick={() => handleTextChange("isDiasporaRdc", opt.val)}
                        className={`flex-1 py-3 rounded-xl text-xs font-bold border transition-all ${form.isDiasporaRdc === opt.val ? "bg-[#f7d618]/10 border-[#f7d618] text-[#f7d618]" : "bg-white/5 border-white/10 text-slate-400 hover:border-white/20"}`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Document Upload Section */}
                <div>
                  <label className="block text-[10px] uppercase text-slate-400 font-bold mb-2">Pièce d'identité *</label>
                  <div className="flex gap-4 mb-3">
                    <button 
                      type="button"
                      onClick={() => handleTextChange("documentType", "PASSPORT")}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${form.documentType === "PASSPORT" ? "bg-[#f7d618]/10 border-[#f7d618] text-[#f7d618]" : "bg-white/5 border-white/10 text-slate-400"}`}
                    >
                      Passeport
                    </button>
                    <button 
                      type="button"
                      onClick={() => handleTextChange("documentType", "DRIVER_LICENSE")}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${form.documentType === "DRIVER_LICENSE" ? "bg-[#f7d618]/10 border-[#f7d618] text-[#f7d618]" : "bg-white/5 border-white/10 text-slate-400"}`}
                    >
                      Permis de conduire US
                    </button>
                  </div>

                  {/* Drag and Drop Zone */}
                  <div 
                    onDragEnter={handleDrag}
                    onDragOver={handleDrag}
                    onDragLeave={handleDrag}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${dragActive ? "border-[#f7d618] bg-[#f7d618]/5" : "border-white/10 bg-white/5 hover:border-white/20"}`}
                  >
                    <input 
                      type="file" 
                      ref={fileInputRef}
                      onChange={handleFileInput}
                      accept="image/jpeg,image/png,application/pdf"
                      className="hidden" 
                    />
                    
                    {!form.documentFile ? (
                      <div>
                        <div className="flex justify-center mb-2 text-slate-400"><UploadCloud size={28} /></div>
                        <span className="text-xs font-semibold text-slate-300">Glissez-déposez votre document ou cliquez pour parcourir</span>
                        <span className="text-[9px] text-slate-500 block mt-1">Formats acceptés : JPG, PNG, PDF. Max 5 Mo.</span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-4 text-left">
                        {filePreview === "pdf" ? (
                          <FileText size={28} className="text-slate-300" />
                        ) : filePreview ? (
                          <img src={filePreview} alt="Preview" className="h-12 w-12 object-cover rounded border border-white/10" />
                        ) : null}
                        <div>
                          <p className="text-xs font-bold text-white max-w-[200px] truncate">{form.documentFile.name}</p>
                          <p className="text-[10px] text-[#f7d618] font-semibold">Document prêt pour le chiffrement</p>
                        </div>
                        <button 
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setForm(prev => ({ ...prev, documentFile: null }));
                            setFilePreview(null);
                          }}
                          className="ml-auto text-xs text-red-400 hover:text-red-300 font-bold"
                        >
                          Retirer
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Portrait Upload Section */}
                <div>
                  <label className="block text-[10px] uppercase text-slate-400 font-bold mb-2">Photo portrait récente *</label>
                  <button
                    type="button"
                    onClick={() => portraitInputRef.current?.click()}
                    className="w-full border-2 border-dashed rounded-2xl p-6 text-left cursor-pointer transition-all border-white/10 bg-white/5 hover:border-white/20"
                  >
                    <input
                      type="file"
                      ref={portraitInputRef}
                      onChange={handlePortraitInput}
                      accept="image/jpeg,image/png"
                      className="hidden"
                    />

                    {!form.portraitFile ? (
                      <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f7d618]/10 text-[#f7d618]">
                          <Camera size={24} />
                        </div>
                        <div>
                          <span className="text-xs font-semibold text-slate-300">Ajoutez un selfie ou une photo récente</span>
                          <span className="text-[9px] text-slate-500 block mt-1">Visage visible, photo nette. Formats acceptés : JPG, PNG. Max 5 Mo.</span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-4">
                        {portraitPreview && (
                          <img src={portraitPreview} alt="Photo portrait" className="h-16 w-16 object-cover rounded-2xl border border-white/10" />
                        )}
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-white truncate">{form.portraitFile.name}</p>
                          <p className="text-[10px] text-[#f7d618] font-semibold">Photo prête pour comparaison visuelle</p>
                        </div>
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation();
                            setForm(prev => ({ ...prev, portraitFile: null }));
                            setPortraitPreview(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              e.stopPropagation();
                              setForm(prev => ({ ...prev, portraitFile: null }));
                              setPortraitPreview(null);
                            }
                          }}
                          className="ml-auto text-xs text-red-400 hover:text-red-300 font-bold"
                        >
                          Retirer
                        </span>
                      </div>
                    )}
                  </button>
                </div>
              </div>

              {error && <div className="mt-4 p-3 rounded-xl bg-red-950/40 border border-red-500/20 text-xs text-red-300">{error}</div>}

              <button 
                type="button" 
                onClick={nextStep}
                className="w-full mt-6 py-4 rounded-xl bg-[#f7d618] text-[#07090f] font-bebas text-lg tracking-wider font-bold hover:bg-yellow-400 transition-colors shadow-[0_4px_20px_rgba(247,214,24,0.3)]"
              >
                Étape Suivante →
              </button>
            </motion.div>
          )}

          {/* STEP 2: MATCH SELECTION */}
          {currentStep === "matches" && (
            <motion.div
              key="step-matches"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3 }}
            >
              <div className="mb-6">
                <span className="text-[10px] uppercase tracking-[0.2em] text-[#f7d618] font-bold">Étape 2 de 3</span>
                <h2 className="font-bebas text-4xl text-white tracking-wide mt-1">CHOISIR LES MATCHS VISÉS</h2>
                <p className="text-slate-400 text-xs mt-1">Sélectionnez le ou les matchs pour lesquels vous souhaitez participer au tirage.</p>
              </div>

              <div className="space-y-4">
                {MATCHES.map(match => {
                  const selected = form.matchesVises.includes(match.key);
                  return (
                    <div 
                      key={match.key}
                      onClick={() => handleMatchToggle(match.key)}
                      className={`relative overflow-hidden p-5 rounded-2xl border cursor-pointer transition-all flex justify-between items-center ${selected ? "border-[#f7d618] bg-[#f7d618]/5" : "border-white/10 bg-white/5 hover:border-white/20"}`}
                    >
                      <div className="flex items-center gap-4">
                        <img src={`/flags/${match.flag}.png`} alt="" className="h-8 w-auto rounded shadow object-cover" />
                        <div>
                          <h4 className="font-bebas text-xl text-white tracking-wide">{match.label}</h4>
                          <p className="text-xs text-slate-400">{match.details}</p>
                          {match.notice && <span className="text-[10px] text-yellow-400/80 block mt-1">{match.notice}</span>}
                        </div>
                      </div>
                      <div className={`h-6 w-6 rounded-full border flex items-center justify-center transition-all ${selected ? "border-[#f7d618] bg-[#f7d618] text-[#07090f] font-bold" : "border-white/20"}`}>
                        {selected && "✓"}
                      </div>
                    </div>
                  );
                })}
              </div>

              {error && <div className="mt-4 p-3 rounded-xl bg-red-950/40 border border-red-500/20 text-xs text-red-300">{error}</div>}

              <button 
                type="button" 
                onClick={nextStep}
                className="w-full mt-6 py-4 rounded-xl bg-[#f7d618] text-[#07090f] font-bebas text-lg tracking-wider font-bold hover:bg-yellow-400 transition-colors shadow-[0_4px_20px_rgba(247,214,24,0.3)]"
              >
                Étape Suivante →
              </button>
            </motion.div>
          )}

          {/* STEP 3: COMMITMENT & SUBMIT */}
          {currentStep === "engagement" && (
            <motion.div
              key="step-engagement"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3 }}
            >
              <div className="mb-6">
                <span className="text-[10px] uppercase tracking-[0.2em] text-[#f7d618] font-bold">Étape 3 de 3</span>
                <h2 className="font-bebas text-4xl text-white tracking-wide mt-1">ENGAGEMENT & CONFIDENTIALITÉ</h2>
                <p className="text-slate-400 text-xs mt-1">Veuillez accepter les règles du tirage au sort pour finaliser l'inscription.</p>
              </div>

              <div className="space-y-3 bg-white/5 border border-white/10 rounded-2xl p-5">
                <p className="text-[10px] uppercase tracking-[0.15em] text-slate-400 font-bold mb-4">Confirmations d'éligibilité *</p>

                {[
                  "Je confirme avoir au moins 18 ans.",
                  "Je suis membre de la diaspora congolaise (RDC) ou je soutiens les Léopards.",
                  "Je certifie être autorisé(e) à entrer légalement dans le pays où se joue le match choisi.",
                  "Je n'ai jamais reçu de billet gratuit via le Bloc Léopards pour un match de la sélection RDC.",
                  "Je m'engage à ne pas revendre, transférer ou céder le billet à des fins commerciales.",
                  "J'accepte de fournir un document d'identité valide pour vérification.",
                ].map((text, i) => (
                  <label key={i} className="flex items-start gap-3 cursor-pointer select-none group">
                    <input type="checkbox" required className="mt-0.5 accent-[#f7d618] flex-shrink-0" />
                    <span className="text-xs text-slate-300 leading-normal">{text}</span>
                  </label>
                ))}

                <div className="border-t border-white/10 pt-3 mt-2">
                  <label className="flex items-start gap-3 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={form.optInMur}
                      onChange={e => handleTextChange("optInMur", e.target.checked)}
                      className="mt-0.5 accent-[#f7d618] flex-shrink-0"
                    />
                    <span className="text-xs text-slate-400 leading-normal">
                      <span className="text-slate-300 font-semibold">Optionnel —</span> J'accepte d'apparaître sur le Mur des Supporters avec mon prénom et ma ville.
                    </span>
                  </label>
                </div>
              </div>

              <div className="mt-4 space-y-3 bg-white/5 border border-white/10 rounded-2xl p-5">
                <p className="text-[10px] uppercase tracking-[0.15em] text-slate-400 font-bold mb-3">Conformité</p>
                <label className="flex items-start gap-3 cursor-pointer select-none">
                  <input type="checkbox" required className="mt-0.5 accent-[#f7d618] flex-shrink-0" />
                  <span className="text-xs text-slate-300 leading-normal">
                    Je confirme être en conformité avec les règles d'immigration du pays de destination du match sélectionné.
                  </span>
                </label>
                <label className="flex items-start gap-3 cursor-pointer select-none">
                  <input type="checkbox" required className="mt-0.5 accent-[#f7d618] flex-shrink-0" />
                  <span className="text-xs text-slate-300 leading-normal">
                    J'accepte la politique de confidentialité (RGPD). Mon document d'identité sera supprimé définitivement après la publication du tirage.
                  </span>
                </label>
              </div>

              {error && <div className="mt-4 p-3 rounded-xl bg-red-950/40 border border-red-500/20 text-xs text-red-300">{error}</div>}

              <button 
                type="button" 
                onClick={submitForm}
                disabled={loading}
                className="w-full mt-6 py-4 rounded-xl bg-[#f7d618] text-[#07090f] font-bebas text-lg tracking-wider font-bold hover:bg-yellow-400 transition-colors shadow-[0_4px_20px_rgba(247,214,24,0.3)] flex items-center justify-center gap-2"
              >
                {loading ? (
                  <span className="w-5 h-5 border-2 border-[#07090f] border-t-transparent rounded-full animate-spin"></span>
                ) : (
                  "Valider ma Candidature"
                )}
              </button>
            </motion.div>
          )}

          {/* SUCCESS STEP: DIGITAL TICKET */}
          {currentStep === "success" && (
            <motion.div
              key="step-success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4 }}
              className="text-center"
            >
              <div className="text-5xl mb-4" style={{color:"#f7d618"}}>★</div>
              <h2 className="font-bebas text-4xl text-[#f7d618] tracking-wide mb-2">INSCRIPTION ENREGISTRÉE !</h2>
              <p className="text-xs text-slate-400 max-w-sm mx-auto mb-8 leading-normal">
                Votre dossier a bien été reçu. Gardez cette page en capture d'écran et utilisez le lien ci-dessous pour vérifier si vous êtes sélectionné(e) après publication.
              </p>

              {/* Digital ticket card */}
              <div className="relative max-w-sm mx-auto bg-gradient-to-b from-[#1c2e8f] to-[#07090f] border border-[#f7d618]/30 rounded-3xl overflow-hidden shadow-2xl p-6 mb-8">
                {/* Yellow decorative border glow */}
                <div className="absolute top-0 inset-x-0 h-1 bg-[#f7d618]"></div>
                
                <div className="flex justify-between items-center mb-6">
                  <div className="text-left">
                    <span className="text-[9px] uppercase tracking-wider text-slate-400 block font-bold">Ticket Officiel</span>
                    <span className="font-bebas text-xl text-white tracking-wide">BLOC DES LÉOPARDS</span>
                  </div>
                  <img src="/brand/logo.png" alt="RDC" className="h-10 w-auto" />
                </div>

                <div className="space-y-3 text-left border-y border-white/10 py-4 mb-4">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">Candidat</span>
                    <span className="font-bold text-white">{form.firstName} {form.lastName}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">Résidence</span>
                    <span className="font-bold text-white">
                      {form.city}{form.stateUs ? `, ${form.stateUs}` : ""} — {form.country}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">Matchs visés</span>
                    <span className="font-bold text-[#f7d618] text-right truncate max-w-[180px]">
                      {selectedMatchLabels}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">Statut pièce</span>
                    <span className="font-bold text-yellow-400">En cours de vérification</span>
                  </div>
                </div>

                {/* QR Code section */}
                <div className="flex flex-col items-center py-2">
                  <img 
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(statusUrl)}`} 
                    alt="QR Code du lien de vérification" 
                    className="h-28 w-28 p-1.5 bg-white rounded-lg border border-[#f7d618]/40" 
                  />
                  <span className="text-[10px] text-slate-500 font-bold mt-2 tracking-widest">{ticketNumber}</span>
                </div>
              </div>

              <div className="max-w-sm mx-auto rounded-2xl border border-[#f7d618]/20 bg-[#f7d618]/10 p-4 text-left mb-6">
                <p className="text-[10px] uppercase tracking-[0.16em] text-[#f7d618] font-bold mb-2">Lien de vérification</p>
                <a href={statusPath} className="block text-xs text-white underline break-all">
                  {statusUrl}
                </a>
                <p className="text-[10px] text-slate-300 mt-3 leading-relaxed">
                  Fais une capture d'écran de cette confirmation. Après le tirage, ouvre ce lien pour savoir si tu es sélectionné(e).
                </p>
              </div>

              <div className="flex flex-col justify-center gap-3 sm:flex-row">
                <a href="/mondial" className="px-6 py-3 rounded-full border border-white/20 text-xs font-bold hover:bg-white/5 transition-colors">
                  ← Retour au Hub
                </a>
                <button
                  type="button"
                  onClick={downloadConfirmationCard}
                  className="px-6 py-3 rounded-full bg-[#f7d618] text-[#07090f] text-xs font-bold hover:bg-yellow-400 transition-colors inline-flex items-center justify-center gap-2"
                >
                  <Download size={14} />
                  Télécharger la carte
                </button>
                <a 
                  href={`https://wa.me/?text=${encodeURIComponent(`Voici mon lien pour vérifier ma sélection Bloc Léopards Mondial 2026 : ${statusUrl}`)}`}
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="px-6 py-3 rounded-full bg-[#25d366] text-white text-xs font-bold hover:bg-[#20ba56] transition-colors"
                >
                  Partager mon lien WhatsApp
                </a>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
