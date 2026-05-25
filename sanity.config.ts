import { defineConfig } from "sanity";
import { structureTool } from "sanity/structure";
import { schemaTypes } from "./src/sanity/schemaTypes";

const projectId = process.env.SANITY_STUDIO_PROJECT_ID || "replace-with-sanity-project-id";
const dataset = process.env.SANITY_STUDIO_DATASET || "production";

export default defineConfig({
  name: "bloc-leopards",
  title: "Bloc Leopards Backoffice",
  projectId,
  dataset,
  basePath: "/studio",
  plugins: [structureTool()],
  schema: {
    types: schemaTypes
  }
});
