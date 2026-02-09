/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{astro,html,js,jsx,md,mdx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          blue: "#3200cc",
          yellow: "#d9a700",
          red: "#d23f00",
          dark: "#0b0f1f",
          ink: "#101622"
        }
      },
      fontFamily: {
        display: ["'Bebas Neue'", "system-ui", "sans-serif"],
        body: ["'Sora'", "system-ui", "sans-serif"]
      },
      backgroundImage: {
        "hero-glow": "radial-gradient(60% 80% at 80% 0%, rgba(242,194,0,0.25), transparent), radial-gradient(50% 60% at 0% 20%, rgba(28,46,143,0.2), transparent)",
        "stadium": "linear-gradient(135deg, #ffffff, #f5f7ff), radial-gradient(circle at 20% 20%, rgba(28,46,143,0.12), transparent 55%), radial-gradient(circle at 80% 10%, rgba(242,194,0,0.18), transparent 45%)"
      },
      boxShadow: {
        glow: "0 20px 60px -30px rgba(242,194,0,0.45)",
        deep: "0 24px 60px -40px rgba(15,23,42,0.35)"
      }
    }
  },
  plugins: []
};
