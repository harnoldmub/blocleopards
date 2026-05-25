import { defineField, defineType } from "sanity";

export const event = defineType({
  name: "event",
  title: "Evenements",
  type: "document",
  fields: [
    defineField({ name: "title", title: "Titre", type: "string", validation: (Rule) => Rule.required() }),
    defineField({ name: "slug", title: "Slug", type: "slug", options: { source: "title", maxLength: 96 } }),
    defineField({ name: "description", title: "Description", type: "text", rows: 3 }),
    defineField({ name: "date", title: "Date", type: "date", validation: (Rule) => Rule.required() }),
    defineField({ name: "time", title: "Heure", type: "string" }),
    defineField({ name: "location", title: "Lieu", type: "string" }),
    defineField({ name: "cta", title: "CTA", type: "string" }),
    defineField({ name: "mapUrl", title: "Lien carte", type: "url" }),
    defineField({ name: "image", title: "Image", type: "image", options: { hotspot: true } }),
    defineField({ name: "body", title: "Contenu", type: "array", of: [{ type: "block" }] })
  ]
});
