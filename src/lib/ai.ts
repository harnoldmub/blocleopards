// Brouillon de réponse via IA gratuite (Google Gemini — free tier).
// Clé gratuite : https://aistudio.google.com/apikey → variable GEMINI_API_KEY
// Modèle gratuit rapide : gemini-2.0-flash

const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? import.meta.env.GEMINI_API_KEY;
const MODEL = process.env.GEMINI_MODEL ?? import.meta.env.GEMINI_MODEL ?? "gemini-2.0-flash";

const SIGNATURE = `Sportivement,
L'équipe Bloc Léopards`;

// Contexte factuel pour permettre à l'IA de répondre concrètement aux questions.
const KNOWLEDGE = `Informations sur Bloc Léopards (utilise-les seulement si pertinentes, n'invente rien d'autre) :
- Bloc Léopards est le collectif des supporters des Léopards de la RDC (football), mobilisé pour la Coupe du Monde 2026.
- Programme « Le Bloc de Guadalajara » : le Ministère des Sports offre aux supporters sélectionnés un billet gratuit et jusqu'à 2 nuitées d'hébergement pour le match RDC–Colombie (Guadalajara, Mexique). Le dossier se dépose sur la page Mondial du site (pièce d'identité, preuve de réservation de transport, email, numéro WhatsApp).
- Pour rejoindre le Bloc (bénévolat : ambiance/chants, photo & vidéo, photographe, graphiste, monteur vidéo, organisation fan zone, relais diaspora, modération digitale, partenariat local) : formulaire « Rejoindre le Bloc » sur le site.
- Le transport et l'hébergement (hors programme Guadalajara) restent à la charge du supporter.
- Site officiel : blocleopards.com.`;

/** Appel Gemini générique. Retourne le texte, ou null si indisponible. */
async function callGemini(prompt: string): Promise<string | null> {
  if (!GEMINI_API_KEY) {
    console.warn("Gemini: aucune clé configurée (GEMINI_API_KEY).");
    return null;
  }
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
      }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      console.error("Gemini API error:", res.status, JSON.stringify(data)?.slice(0, 300));
      return null;
    }
    const cand = data?.candidates?.[0];
    const text: string = cand?.content?.parts?.map((p: any) => p.text || "").join("").trim() || "";
    if (!text) {
      console.error("Gemini: réponse vide. finishReason=", cand?.finishReason, "raw=", JSON.stringify(data)?.slice(0, 300));
      return null;
    }
    return text;
  } catch (err) {
    console.error("Gemini fetch error:", err);
    return null;
  }
}

const RULES = `Consignes de rédaction :
- Réponds DIRECTEMENT et CONCRÈTEMENT au message ci-dessous : traite la demande ou la question posée, ne te contente pas d'un accusé de réception.
- N'écris pas de réponse générique du type « nous reviendrons vers vous » sauf si la demande exige réellement une vérification humaine.
- Commence par « Bonjour <prénom>, » et termine par « ${SIGNATURE.replace(/\n/g, " / ")} » (sur deux lignes).
- Français, ton chaleureux et professionnel, 3 à 8 phrases.
- Pas de markdown, pas de crochets ni de champs à compléter : le texte doit être prêt à envoyer tel quel.`;

// ─── Réponse à un message de contact ────────────────────────────────────────

interface ContactContext {
  nom: string;
  objet: string;
  message: string;
  consigne?: string;
}

function contactFallback(ctx: ContactContext): string {
  const prenom = ctx.nom.trim().split(/\s+/)[0] || "";
  return `Bonjour ${prenom},

Merci pour votre message concernant « ${ctx.objet} ». Nous avons bien pris connaissance de votre demande et notre équipe revient vers vous très vite avec une réponse détaillée.

N'hésitez pas à nous préciser tout élément utile en attendant.

${SIGNATURE}`;
}

export async function draftContactReply(ctx: ContactContext): Promise<{ draft: string; source: "ai" | "fallback" }> {
  const prompt = `Tu es le responsable du support de Bloc Léopards. Tu réponds par email, en français, à un message reçu via le formulaire de contact.

${KNOWLEDGE}

${RULES}
${ctx.consigne ? `\nConsigne supplémentaire de l'admin à respecter : ${ctx.consigne}` : ""}

Voici le message auquel tu dois répondre :
« Objet : ${ctx.objet}
${ctx.message || "(aucun texte fourni)"} »

Rédige maintenant l'email de réponse adressé à ${ctx.nom}.`;

  const text = await callGemini(prompt);
  return text ? { draft: text, source: "ai" } : { draft: contactFallback(ctx), source: "fallback" };
}

// ─── Réponse à une demande d'adhésion ───────────────────────────────────────

interface AdhesionContext {
  prenom: string;
  nom: string;
  role?: string | null;
  ville?: string | null;
  motivation?: string | null;
  consigne?: string;
}

function adhesionFallback(ctx: AdhesionContext): string {
  return `Bonjour ${ctx.prenom},

Merci d'avoir rejoint le Bloc des Léopards${ctx.role ? ` en tant que ${ctx.role}` : ""} ! Ton engagement compte énormément pour faire vibrer les tribunes derrière la RDC.

Nous revenons très vite vers toi avec les prochaines étapes pour participer.

${SIGNATURE}`;
}

export async function draftAdhesionReply(ctx: AdhesionContext): Promise<{ draft: string; source: "ai" | "fallback" }> {
  const prompt = `Tu es responsable de la communauté Bloc Léopards. Tu réponds par email à une personne qui vient de remplir le formulaire pour rejoindre le Bloc.

${KNOWLEDGE}

${RULES}
- Remercie chaleureusement pour l'engagement, valorise le rôle souhaité et donne une suite concrète (prochaines étapes, invitation à rejoindre le groupe).
${ctx.consigne ? `\nConsigne supplémentaire de l'admin à respecter : ${ctx.consigne}` : ""}

Informations sur le candidat :
- Prénom : ${ctx.prenom}
- Nom : ${ctx.nom}
- Rôle souhaité : ${ctx.role || "non précisé"}
- Ville : ${ctx.ville || "non précisée"}
- Motivation exprimée : ${ctx.motivation || "non précisée"}

Rédige maintenant l'email de réponse adressé à ${ctx.prenom}.`;

  const text = await callGemini(prompt);
  return text ? { draft: text, source: "ai" } : { draft: adhesionFallback(ctx), source: "fallback" };
}
