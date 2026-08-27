/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{astro,html,js,jsx,md,mdx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Clés historiques conservées (les pages existantes se re-colorent d'un coup)
        // brand.blue passe du violet #3200cc au Bleu Congo vif.
        brand: {
          blue: "#1466E0",
          yellow: "#F4C400",
          red: "#D81E27",
          dark: "#08132B",
          ink: "#050B18"
        },
        // Système Bleu Congo
        congo: {
          DEFAULT: "#1466E0",
          bright: "#1E7BFF",
          deep: "#0B47B0",
          nuit: "#08132B",
          night: "#050B18"
        },
        or: "#F4C400",
        feu: "#D81E27",
        // Couleurs drapeau RDC — réservées à la barre bleu/jaune/rouge
        flag: {
          blue: "#007fff",
          red: "#ce1021",
          yellow: "#f7d618"
        }
      },
      fontFamily: {
        // Méga-statements éditoriaux (surdimensionnés)
        mega: ["'Anton'", "'Bebas Neue'", "system-ui", "sans-serif"],
        display: ["'Bebas Neue'", "system-ui", "sans-serif"],
        body: ["'Sora'", "system-ui", "sans-serif"]
      },
      letterSpacing: {
        eyebrow: "0.28em"
      },
      backgroundImage: {
        "hero-glow": "radial-gradient(60% 80% at 80% 0%, rgba(244,196,0,0.22), transparent), radial-gradient(50% 60% at 0% 20%, rgba(20,102,224,0.28), transparent)",
        "congo-night": "linear-gradient(180deg, #08132B 0%, #050B18 100%)"
      },
      boxShadow: {
        glow: "0 20px 60px -30px rgba(244,196,0,0.45)",
        deep: "0 24px 60px -40px rgba(5,11,24,0.55)",
        card: "0 1px 0 rgba(255,255,255,.04), 0 30px 70px -45px rgba(5,11,24,.7)"
      }
    }
  },
  plugins: []
};
