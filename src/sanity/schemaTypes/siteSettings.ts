import { defineField, defineType } from "sanity";

export const siteSettings = defineType({
  name: "siteSettings",
  title: "Parametres du site",
  type: "document",
  fields: [
    defineField({ name: "title", title: "Titre du site", type: "string" }),
    defineField({ name: "description", title: "Description SEO", type: "text", rows: 3 }),
    defineField({ name: "matchDay", title: "Activer le bandeau matchday", type: "boolean" }),
    defineField({ name: "matchDayLabel", title: "Texte du bandeau", type: "string" }),
    defineField({ name: "matchDayCTA", title: "Lien CTA", type: "string" }),
    defineField({ name: "matchDayCTALabel", title: "Label CTA", type: "string" })
  ]
});
