import { defineConfig } from "astro/config";
import tailwind from "@astrojs/tailwind";

export default defineConfig({
  site: "https://bloc-leopards.example",
  integrations: [tailwind()]
});
