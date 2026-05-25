import { defineField, defineType } from "sanity";

export const galleryImage = defineType({
  name: "galleryImage",
  title: "Galerie",
  type: "document",
  fields: [
    defineField({ name: "title", title: "Titre interne", type: "string", validation: (Rule) => Rule.required() }),
    defineField({ name: "category", title: "Categorie", type: "string" }),
    defineField({ name: "image", title: "Image", type: "image", options: { hotspot: true }, validation: (Rule) => Rule.required() }),
    defineField({ name: "alt", title: "Texte alternatif", type: "string" })
  ]
});
