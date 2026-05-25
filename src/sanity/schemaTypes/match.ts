import { defineField, defineType } from "sanity";

export const match = defineType({
  name: "match",
  title: "Matchs",
  type: "document",
  fields: [
    defineField({ name: "opponent", title: "Adversaire", type: "string", validation: (Rule) => Rule.required() }),
    defineField({ name: "date", title: "Date", type: "date", validation: (Rule) => Rule.required() }),
    defineField({ name: "time", title: "Heure", type: "string" }),
    defineField({ name: "location", title: "Lieu", type: "string" }),
    defineField({ name: "callToAction", title: "Message mobilisation", type: "text", rows: 3 }),
    defineField({ name: "sourceUrl", title: "URL source", type: "url" }),
    defineField({ name: "image", title: "Image", type: "image", options: { hotspot: true } })
  ]
});
