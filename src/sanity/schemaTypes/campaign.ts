import { defineField, defineType } from "sanity";

export const campaign = defineType({
  name: "campaign",
  title: "Campagnes",
  type: "document",
  fields: [
    defineField({ name: "title", title: "Titre", type: "string", validation: (Rule) => Rule.required() }),
    defineField({ name: "description", title: "Description", type: "text", rows: 3 }),
    defineField({ name: "hashtag", title: "Hashtag", type: "string" }),
    defineField({ name: "status", title: "Statut", type: "string" }),
    defineField({ name: "image", title: "Image", type: "image", options: { hotspot: true } })
  ]
});
