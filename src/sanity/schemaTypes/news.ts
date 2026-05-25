import { defineField, defineType } from "sanity";

export const news = defineType({
  name: "news",
  title: "Actualites",
  type: "document",
  fields: [
    defineField({ name: "title", title: "Titre", type: "string", validation: (Rule) => Rule.required() }),
    defineField({
      name: "slug",
      title: "Slug",
      type: "slug",
      options: { source: "title", maxLength: 96 },
      validation: (Rule) => Rule.required()
    }),
    defineField({ name: "description", title: "Description courte", type: "text", rows: 3 }),
    defineField({ name: "date", title: "Date", type: "date", validation: (Rule) => Rule.required() }),
    defineField({ name: "image", title: "Image principale", type: "image", options: { hotspot: true } }),
    defineField({ name: "videoUrl", title: "Video URL", type: "url" }),
    defineField({ name: "audioUrl", title: "Audio URL", type: "url" }),
    defineField({ name: "sourceTitle", title: "Nom de la source", type: "string" }),
    defineField({ name: "sourceUrl", title: "URL source", type: "url" }),
    defineField({ name: "tags", title: "Tags", type: "array", of: [{ type: "string" }] }),
    defineField({ name: "body", title: "Contenu", type: "array", of: [{ type: "block" }] })
  ]
});
