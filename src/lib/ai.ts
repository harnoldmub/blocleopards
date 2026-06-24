// Brouillon de réponse via IA gratuite (Google Gemini — free tier).
// Clé gratuite : https://aistudio.google.com/apikey → variable GEMINI_API_KEY
// Modèle gratuit rapide : gemini-2.0-flash

const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? import.meta.env.GEMINI_API_KEY;
const MODEL = process.env.GEMINI_MODEL ?? import.meta.env.GEMINI_MODEL ?? "gemini-2.0-flash";

const SIGNATURE = `Sportivement,
L'équipe Bloc Léopards`;

/** Appel Gemini générique. Retourne le texte, ou null si indisponible. */
async function callGemini(prompt: string): Promise<string | null> {
  if (!GEMINI_API_KEY) return null;
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 600 },
      }),
    });
    if (!res.ok) {
      console.error("Gemini API error:", res.status, await res.text().catch(() => ""));
      return null;
    }
    const data = await res.json();
    const text: string = data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("").trim() || "";
    return text || null;
  } catch (err) {
    console.error("Gemini draft error:", err);
    return null;
  }
}

const RULES = `Règles :
- Commence par "Bonjour <prénom>," et termine par "${SIGNATURE.replace(/\n/g, "\\n")}".
- Reste concis (3 à 6 phrases), clair et utile.
- Ne réinvente pas d'informations : si tu manques d'infos, invite poliment à préciser ou indique qu'on revient vers eux.
- Pas de markdown, pas de placeholders entre crochets, juste le texte de l'email.`;

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

Merci pour votre message concernant « ${ctx.objet} ». Nous avons bien pris connaissance de votre demande.

[Votre réponse ici]

${SIGNATURE}`;
}

export async function draftContactReply(ctx: ContactContext): Promise<{ draft: string; source: "ai" | "fallback" }> {
  const prompt = `Tu es le responsable du support de "Bloc Léopards", le collectif des supporters des Léopards de la RDC (football).
Rédige une réponse par email, en français, chaleureuse mais professionnelle, au message ci-dessous.

${RULES}
${ctx.consigne ? `- Consigne de l'admin à respecter : ${ctx.consigne}` : ""}

Message reçu :
- Nom : ${ctx.nom}
- Objet : ${ctx.objet}
- Message : ${ctx.message}`;

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

Merci d'avoir rejoint le Bloc des Léopards${ctx.role ? ` en tant que ${ctx.role}` : ""} ! Nous sommes ravis de t'accueillir.

[Votre réponse ici]

${SIGNATURE}`;
}

export async function draftAdhesionReply(ctx: AdhesionContext): Promise<{ draft: string; source: "ai" | "fallback" }> {
  const prompt = `Tu es responsable de la communauté "Bloc Léopards", le collectif des supporters des Léopards de la RDC (football).
Rédige une réponse par email, en français, chaleureuse et motivante, à une personne qui vient de remplir le formulaire pour rejoindre le Bloc.

${RULES}
- Remercie la personne pour son engagement et donne envie de participer.
${ctx.consigne ? `- Consigne de l'admin à respecter : ${ctx.consigne}` : ""}

Candidat :
- Prénom : ${ctx.prenom}
- Nom : ${ctx.nom}
- Rôle souhaité : ${ctx.role || "non précisé"}
- Ville : ${ctx.ville || "non précisée"}
- Motivation : ${ctx.motivation || "non précisée"}`;

  const text = await callGemini(prompt);
  return text ? { draft: text, source: "ai" } : { draft: adhesionFallback(ctx), source: "fallback" };
}
