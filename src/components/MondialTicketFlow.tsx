import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

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
  dateOfBirth: string;
  email: string;
  phone: string;
  city: string;
  stateUs: string;
  matchesVises: string[];
  optInMur: boolean;
  documentType: "PASSPORT" | "DRIVER_LICENSE";
  documentFile: File | null;
}

export default function MondialTicketFlow() {
  const [currentStep, setCurrentStep] = useState<Step>("identity");
  const [form, setForm] = useState<FormState>({
    firstName: "",
    lastName: "",
    dateOfBirth: "",
    email: "",
    phone: "",
    city: "",
    stateUs: "",
    matchesVises: [],
    optInMur: false,
    documentType: "PASSPORT",
    documentFile: null
  });

  const [stateSearch, setStateSearch] = useState("");
  const [showStateDropdown, setShowStateDropdown] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [ticketNumber, setTicketNumber] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

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
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return "Adresse email valide requise.";
    if (!form.phone.trim()) return "Numéro de téléphone requis.";
    if (!form.stateUs) return "État de résidence requis.";
    if (!form.city.trim()) return "Ville de résidence requise.";
    if (!form.documentFile) return "Pièce d'identité requise.";
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
    formData.append("date_of_birth", form.dateOfBirth);
    formData.append("email", form.email);
    formData.append("phone", form.phone);
    formData.append("country", "USA");
    formData.append("city", form.city);
    formData.append("state_us", form.stateUs);
    formData.append("matchs_vises", JSON.stringify(form.matchesVises));
    formData.append("opt_in_mur", String(form.optInMur));
    formData.append("document_type", form.documentType);
    if (form.documentFile) {
      formData.append("document", form.documentFile);
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

  // ─── Renders ───────────────────────────────────────────────────────────────

  const filteredStates = US_STATES.filter(s => 
    s.name.toLowerCase().includes(stateSearch.toLowerCase()) ||
    s.code.toLowerCase().includes(stateSearch.toLowerCase())
  );

  return (
    <div className="min-h-screen text-white relative font-sans" style={{ background: "#080c1a" }}>
      
      {/* Top Header Navigation */}
      <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between p-4 bg-[#080c1a]/80 backdrop-blur-md border-b border-white/5">
        {currentStep !== "identity" && currentStep !== "success" ? (
          <button 
            type="button" 
            onClick={prevStep}
            className="px-4 py-2 rounded-full border border-white/10 hover:bg-white/5 text-xs font-semibold"
          >
            ← Retour
          </button>
        ) : <div />}
        <a href="/mondial" className="px-4 py-2 rounded-full border border-white/10 hover:bg-white/5 text-xs font-semibold text-[#f7d618]">
          ← Hub Mondial
        </a>
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
                <p className="text-slate-400 text-xs mt-1">Le tirage au sort Mondial 2026 est exclusivement réservé aux résidents des USA.</p>
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
                    placeholder="john.doe@domain.us"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase text-slate-400 font-bold mb-1.5">Téléphone (US +1) *</label>
                  <input 
                    type="tel" 
                    value={form.phone} 
                    onChange={e => handleTextChange("phone", e.target.value)}
                    className="w-full bg-white/5 border border-white/10 focus:border-[#f7d618] rounded-xl px-4 py-3 text-sm outline-none transition-colors"
                    placeholder="+1 (555) 000-0000"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Searchable State US Selector */}
                  <div className="relative">
                    <label className="block text-[10px] uppercase text-slate-400 font-bold mb-1.5">État de résidence *</label>
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
                      <div className="absolute left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-[#0d1221] border border-white/10 rounded-xl z-20 shadow-xl scrollbar-thin">
                        {filteredStates.length > 0 ? (
                          filteredStates.map(state => (
                            <button
                              key={state.code}
                              type="button"
                              onClick={() => handleStateSelect(state.name)}
                              className="w-full text-left px-4 py-2 hover:bg-white/5 text-xs transition-colors border-b border-white/5 last:border-0"
                            >
                              {state.name} ({state.code})
                            </button>
                          ))
                        ) : (
                          <div className="px-4 py-2 text-xs text-slate-500">Aucun État trouvé</div>
                        )}
                      </div>
                    )}
                  </div>

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

                {/* Document Upload Section */}
                <div>
                  <label className="block text-[10px] uppercase text-slate-400 font-bold mb-2">Pièce justificative de résidence *</label>
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
                        <span className="text-3xl block mb-2">📁</span>
                        <span className="text-xs font-semibold text-slate-300">Glissez-déposez votre document ou cliquez pour parcourir</span>
                        <span className="text-[9px] text-slate-500 block mt-1">Formats acceptés : JPG, PNG, PDF. Max 5 Mo.</span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-4 text-left">
                        {filePreview === "pdf" ? (
                          <span className="text-3xl">📄</span>
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

              <div className="space-y-4 bg-white/5 border border-white/10 rounded-2xl p-5">
                <label className="flex items-start gap-3 cursor-pointer select-none">
                  <input 
                    type="checkbox" 
                    required
                    className="mt-1"
                  />
                  <span className="text-xs text-slate-300 leading-normal">
                    <strong>Une seule inscription autorisée.</strong> Je certifie sur l'honneur que je réside légalement aux USA et que toute fausse déclaration ou tentative de fraude entraînera l'annulation immédiate de ma demande.
                  </span>
                </label>

                <label className="flex items-start gap-3 cursor-pointer select-none">
                  <input 
                    type="checkbox" 
                    required
                    className="mt-1"
                  />
                  <span className="text-xs text-slate-300 leading-normal">
                    J'accepte la politique de confidentialité (RGPD). Je comprends que mon document d'identité est stocké de manière sécurisée et sera supprimé après le tirage.
                  </span>
                </label>

                <label className="flex items-start gap-3 cursor-pointer select-none">
                  <input 
                    type="checkbox" 
                    checked={form.optInMur}
                    onChange={e => handleTextChange("optInMur", e.target.checked)}
                    className="mt-1"
                  />
                  <span className="text-xs text-slate-300 leading-normal">
                    (Optionnel) J'accepte d'apparaître sur le <strong>Mur des Supporters</strong> de la RDC en affichant mon prénom, ma ville et mon État.
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
                Votre candidature pour le tirage au sort a été reçue. Un email de confirmation a été envoyé à {form.email}.
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
                    <span className="font-bold text-white">{form.city}, {form.stateUs} (USA)</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">Matchs visés</span>
                    <span className="font-bold text-[#f7d618] text-right truncate max-w-[180px]">
                      {form.matchesVises.map(m => m.toUpperCase()).join(", ")}
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
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${ticketNumber}`} 
                    alt="QR Code" 
                    className="h-28 w-28 p-1.5 bg-white rounded-lg border border-[#f7d618]/40" 
                  />
                  <span className="text-[10px] text-slate-500 font-bold mt-2 tracking-widest">{ticketNumber}</span>
                </div>
              </div>

              <div className="flex justify-center gap-4">
                <a href="/mondial" className="px-6 py-3 rounded-full border border-white/20 text-xs font-bold hover:bg-white/5 transition-colors">
                  ← Retour au Hub
                </a>
                <a 
                  href={`https://wa.me/?text=${encodeURIComponent("Je participe au tirage au sort du Bloc des Léopards pour la Coupe du Monde 2026 ! Plus d'infos ici : " + (typeof window !== "undefined" ? window.location.origin : "") + "/mondial")}`}
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="px-6 py-3 rounded-full bg-[#25d366] text-white text-xs font-bold hover:bg-[#20ba56] transition-colors"
                >
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
