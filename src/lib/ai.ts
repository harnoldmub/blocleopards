// Brouillon de réponse via IA gratuite (Google Gemini — free tier).
// Clé gratuite : https://aistudio.google.com/apikey → variable GEMINI_API_KEY
// Modèle gratuit rapide : gemini-2.0-flash

const GEMINI_API_KEY = import.meta.env.GEMINI_API_KEY;
const MODEL = import.meta.env.GEMINI_MODEL ?? "gemini-2.0-flash";

interface ContactContext {
  nom: string;
  objet: string;
  message: string;
  consigne?: string; // instruction optionnelle de l'admin (ton, points à inclure)
}

/** Brouillon de secours si l'IA n'est pas configurée ou indisponible. */
function fallbackDraft(ctx: ContactContext): string {
  const prenom = ctx.nom.trim().split(/\s+/)[0] || "";
  return `Bonjour ${prenom},

Merci pour votre message concernant « ${ctx.objet} ». Nous avons bien pris connaissance de votre demande.

[Votre réponse ici]

Sportivement,
L'équipe Bloc Léopards`;
}

export async function draftContactReply(ctx: ContactContext): Promise<{ draft: string; source: "ai" | "fallback" }> {
  if (!GEMINI_API_KEY) {
    return { draft: fallbackDraft(ctx), source: "fallback" };
  }

  const prompt = `Tu es le responsable du support de "Bloc Léopards", le collectif des supporters des Léopards de la RDC (football).
Rédige une réponse par email, en français, chaleureuse mais professionnelle, au message ci-dessous.

Règles :
- Commence par "Bonjour <prénom>," et termine par "Sportivement,\\nL'équipe Bloc Léopards".
- Reste concis (3 à 6 phrases), clair et utile.
- Ne réinvente pas d'informations : si tu manques d'infos, invite poliment à préciser ou indique qu'on revient vers eux.
- Pas de markdown, pas de placeholders entre crochets, juste le texte de l'email.
${ctx.consigne ? `- Consigne de l'admin à respecter : ${ctx.consigne}` : ""}

Message reçu :
- Nom : ${ctx.nom}
- Objet : ${ctx.objet}
- Message : ${ctx.message}`;

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
      return { draft: fallbackDraft(ctx), source: "fallback" };
    }
    const data = await res.json();
    const text: string = data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("").trim() || "";
    if (!text) return { draft: fallbackDraft(ctx), source: "fallback" };
    return { draft: text, source: "ai" };
  } catch (err) {
    console.error("Gemini draft error:", err);
    return { draft: fallbackDraft(ctx), source: "fallback" };
  }
}
