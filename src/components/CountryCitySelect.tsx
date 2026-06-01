import { useState, useEffect } from "react";
import Select from "react-select";
import { Country, City } from "country-state-city";

const PRIORITY = ["CD","BE","FR","GB","CH","DE","IT","ES","NL","PT","US","CA","AO","CG","CM","SN","CI","GH","TZ","KE"];

// French names for major cities that differ from their English counterparts
const CITY_FR: Record<string, string> = {
  // UK / Irlande
  "London": "Londres", "Edinburgh": "Édimbourg", "Londonderry": "Derry",
  // Belgique
  "Brussels": "Bruxelles", "Antwerp": "Anvers", "Ghent": "Gand",
  "Liege": "Liège", "Leuven": "Louvain", "Bruges": "Bruges",
  // Pays-Bas
  "The Hague": "La Haye",
  // Allemagne
  "Cologne": "Cologne", "Munich": "Munich", "Nuremberg": "Nuremberg",
  "Aix-la-Chapelle": "Aix-la-Chapelle",
  // Autriche
  "Vienna": "Vienne",
  // Suisse
  "Geneva": "Genève", "Bern": "Berne", "Basle": "Bâle",
  // Espagne
  "Seville": "Séville", "Cordoba": "Cordoue", "Zaragoza": "Saragosse",
  "Majorca": "Majorque", "Minorca": "Minorque",
  // Portugal
  "Lisbon": "Lisbonne",
  // Italie
  "Venice": "Venise", "Florence": "Florence", "Naples": "Naples",
  "Genoa": "Gênes", "Padua": "Padoue", "Turin": "Turin",
  // Grèce
  "Athens": "Athènes", "Thessaloniki": "Thessalonique",
  // Pologne
  "Warsaw": "Varsovie", "Cracow": "Cracovie", "Krakow": "Cracovie",
  // Roumanie
  "Bucharest": "Bucarest",
  // Russie / Ukraine
  "Moscow": "Moscou", "Saint Petersburg": "Saint-Pétersbourg",
  "Kiev": "Kiev", "Kyiv": "Kiev",
  // Turquie
  "Istanbul": "Istanbul", "Smyrna": "Smyrne",
  // Scandinavie
  "Copenhagen": "Copenhague", "Gothenburg": "Göteborg",
  // Maroc
  "Fez": "Fès", "Marrakesh": "Marrakech", "Tangier": "Tanger",
  // Algérie
  "Algiers": "Alger",
  // Tunisie
  "Tunis": "Tunis",
  // Égypte
  "Cairo": "Le Caire", "Alexandria": "Alexandrie", "Luxor": "Louxor",
  // Afrique sub-saharienne
  "Abidjan": "Abidjan", "Dakar": "Dakar", "Kinshasa": "Kinshasa",
  "Lubumbashi": "Lubumbashi", "Brazzaville": "Brazzaville",
  "Cape Town": "Le Cap",
  // Moyen-Orient
  "Baghdad": "Bagdad", "Riyadh": "Riyad", "Jeddah": "Djeddah",
  "Damascus": "Damas", "Beirut": "Beyrouth", "Jerusalem": "Jérusalem",
  // Asie
  "Beijing": "Pékin", "Peking": "Pékin",
  "Calcutta": "Calcutta", "Bombay": "Bombay", "Madras": "Madras",
  // Amériques
  "Montreal": "Montréal", "Quebec City": "Québec",
  "New York City": "New York",
};

const frCity = (name: string) => CITY_FR[name] ?? name;

const allCountries = Country.getAllCountries();
const frNames = new Intl.DisplayNames(["fr"], { type: "region" });
const frName = (isoCode: string, fallback: string) => { try { return frNames.of(isoCode) || fallback; } catch { return fallback; } };

const countryOptions = [
  {
    label: "Fréquents",
    options: PRIORITY
      .map((code) => allCountries.find((c) => c.isoCode === code))
      .filter(Boolean)
      .map((c) => { const name = frName(c!.isoCode, c!.name); return { value: c!.isoCode, label: `${c!.flag} ${name}`, name }; }),
  },
  {
    label: "Tous les pays",
    options: allCountries
      .filter((c) => !PRIORITY.includes(c.isoCode))
      .map((c) => { const name = frName(c.isoCode, c.name); return { value: c.isoCode, label: `${c.flag} ${name}`, name }; })
      .sort((a, b) => a.name.localeCompare(b.name, "fr")),
  },
];

const lightStyles = (focused: boolean) => ({
  control: (base: any, state: any) => ({
    ...base,
    borderRadius: "12px",
    border: `1px solid ${state.isFocused ? "#f7d618" : "#cbd5e1"}`,
    boxShadow: state.isFocused ? "0 0 0 3px rgba(247,214,24,0.2)" : "none",
    padding: "4px 4px",
    fontFamily: "'Sora', sans-serif",
    fontSize: "14px",
    cursor: "pointer",
    "&:hover": { borderColor: "#f7d618" },
  }),
  menu: (base: any) => ({ ...base, borderRadius: "12px", overflow: "hidden", zIndex: 50 }),
  option: (base: any, state: any) => ({
    ...base,
    fontSize: "14px",
    background: state.isSelected ? "#f7d618" : state.isFocused ? "#fef9c3" : "white",
    color: state.isSelected ? "#07090f" : "#0f172a",
    cursor: "pointer",
  }),
  groupHeading: (base: any) => ({ ...base, fontSize: "10px", letterSpacing: "0.12em", color: "#94a3b8", fontWeight: 700 }),
});

const darkStyles = {
  control: (base: any, state: any) => ({
    ...base,
    borderRadius: "14px",
    border: `1.5px solid ${state.isFocused ? "#f7d618" : "rgba(255,255,255,0.14)"}`,
    background: state.isFocused ? "rgba(247,214,24,0.06)" : "rgba(255,255,255,0.06)",
    boxShadow: state.isFocused ? "0 0 0 3px rgba(247,214,24,0.14)" : "0 2px 10px rgba(0,0,0,0.15)",
    padding: "6px 4px",
    fontFamily: "'Sora', sans-serif",
    fontSize: "15px",
    color: "#fff",
    cursor: "pointer",
    "&:hover": { borderColor: "#f7d618" },
  }),
  input: (base: any) => ({ ...base, color: "#fff", caretColor: "#f7d618" }),
  singleValue: (base: any) => ({ ...base, color: "#fff" }),
  placeholder: (base: any) => ({ ...base, color: "rgba(255,255,255,0.35)" }),
  menu: (base: any) => ({ ...base, background: "#0e1628", borderRadius: "14px", border: "1px solid rgba(255,255,255,0.1)", overflow: "hidden", zIndex: 9999 }),
  menuList: (base: any) => ({ ...base, padding: "4px" }),
  option: (base: any, state: any) => ({
    ...base,
    borderRadius: "10px",
    margin: "2px 0",
    fontSize: "14px",
    background: state.isSelected ? "rgba(247,214,24,0.2)" : state.isFocused ? "rgba(255,255,255,0.07)" : "transparent",
    color: state.isSelected ? "#f7d618" : "#e2e8f0",
    cursor: "pointer",
  }),
  groupHeading: (base: any) => ({ ...base, fontSize: "10px", letterSpacing: "0.12em", color: "rgba(255,255,255,0.3)", fontWeight: 700, padding: "8px 12px 4px" }),
  noOptionsMessage: (base: any) => ({ ...base, color: "rgba(255,255,255,0.4)", fontSize: "13px" }),
};

// ── Light version for /rejoindre form (plain HTML POST) ──────────────────────

export default function CountryCitySelect() {
  const [countryCode, setCountryCode] = useState("");
  const [countryName, setCountryName] = useState("");
  const [cityOption, setCityOption] = useState<{ value: string; label: string } | null>(null);
  const [cityOptions, setCityOptions] = useState<{ value: string; label: string }[]>([]);

  useEffect(() => {
    if (countryCode) {
      const list = City.getCitiesOfCountry(countryCode) || [];
      const opts = list
        .sort((a, b) => a.name.localeCompare(b.name, "fr"))
        .map((c) => ({ value: c.name, label: frCity(c.name) }));
      setCityOptions(opts);
      setCityOption(null);
    } else {
      setCityOptions([]);
      setCityOption(null);
    }
  }, [countryCode]);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Hidden inputs for form submission */}
      <input type="hidden" name="pays" value={countryName} />
      <input type="hidden" name="ville" value={cityOption?.value || ""} />

      <div className="grid gap-2">
        <span className="font-semibold text-slate-700 text-sm">Pays</span>
        <Select
          options={countryOptions}
          placeholder="🔍 Rechercher un pays..."
          noOptionsMessage={() => "Aucun résultat"}
          styles={lightStyles(false)}
          onChange={(opt: any) => {
            setCountryCode(opt?.value || "");
            setCountryName(opt?.name || "");
          }}
          isClearable
        />
      </div>

      <div className="grid gap-2">
        <span className="font-semibold text-slate-700 text-sm">Ville *</span>
        {cityOptions.length > 0 ? (
          <Select
            options={cityOptions}
            value={cityOption}
            placeholder="🔍 Rechercher une ville..."
            noOptionsMessage={() => "Aucun résultat"}
            styles={lightStyles(false)}
            onChange={(opt: any) => setCityOption(opt)}
            isClearable
            isDisabled={!countryCode}
          />
        ) : (
          <input
            name="ville"
            required
            placeholder={countryCode ? "Entrez votre ville" : "Sélectionne d'abord un pays"}
            className="rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-brand-yellow focus:ring-4 focus:ring-brand-yellow/20"
            onChange={(e) => setCityOption({ value: e.target.value, label: e.target.value })}
          />
        )}
      </div>
    </div>
  );
}

// ── Dark version for TicketFlow (controlled React state) ─────────────────────

export function CountryCitySelectDark({
  countryCode,
  countryName,
  city,
  onCountryChange,
  onCityChange,
}: {
  countryCode: string;
  countryName: string;
  city: string;
  onCountryChange: (name: string, code: string) => void;
  onCityChange: (v: string) => void;
}) {
  const [cityOptions, setCityOptions] = useState<{ value: string; label: string }[]>([]);

  useEffect(() => {
    if (countryCode) {
      const list = City.getCitiesOfCountry(countryCode) || [];
      setCityOptions(
        list.sort((a, b) => a.name.localeCompare(b.name, "fr")).map((c) => ({ value: c.name, label: c.name }))
      );
    } else {
      setCityOptions([]);
    }
  }, [countryCode]);

  const labelStyle = { display: "block", fontSize: "11px", letterSpacing: "0.18em", textTransform: "uppercase" as const, color: "rgba(255,255,255,0.5)", marginBottom: "8px", fontFamily: "'Sora', sans-serif", fontWeight: 700 };

  return (
    <>
      <div className="mb-4">
        <label style={labelStyle}>Pays <span style={{ color: "#ce1021" }}>*</span></label>
        <Select
          options={countryOptions}
          value={countryCode ? { value: countryCode, label: `${Country.getCountryByCode(countryCode)?.flag} ${frName(countryCode, countryName)}`, name: frName(countryCode, countryName) } : null}
          placeholder="🔍 Rechercher un pays..."
          noOptionsMessage={() => "Aucun résultat"}
          styles={darkStyles}
          onChange={(opt: any) => onCountryChange(opt?.name || "", opt?.value || "")}
          isClearable
        />
      </div>
      <div className="mb-4">
        <label style={labelStyle}>Ville <span style={{ color: "#ce1021" }}>*</span></label>
        {cityOptions.length > 0 ? (
          <Select
            options={cityOptions}
            value={city ? { value: city, label: frCity(city) } : null}
            placeholder="🔍 Rechercher une ville..."
            noOptionsMessage={() => "Aucun résultat"}
            styles={darkStyles}
            onChange={(opt: any) => onCityChange(opt?.value || "")}
            isClearable
            isDisabled={!countryCode}
          />
        ) : (
          <input
            value={city}
            placeholder={countryCode ? "Entrez votre ville" : "Sélectionne d'abord un pays"}
            onChange={(e) => onCityChange(e.target.value)}
            style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1.5px solid rgba(255,255,255,0.14)", borderRadius: "14px", padding: "16px 18px", color: "#fff", fontSize: "15px", fontFamily: "'Sora', sans-serif", outline: "none", caretColor: "#f7d618" }}
          />
        )}
      </div>
    </>
  );
}
