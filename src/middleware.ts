import { defineMiddleware } from "astro:middleware";

// Pass-through middleware — l'auth admin est gérée page par page via isAdminAuthed()
export const onRequest = defineMiddleware((_context, next) => {
  return next();
});
