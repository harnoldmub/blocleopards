import { Resend } from "resend";

const apiKey = import.meta.env.RESEND_API_KEY;
const resend = apiKey ? new Resend(apiKey) : null;

const FROM = import.meta.env.EMAIL_FROM ?? "Bloc Léopards <onboarding@resend.dev>";
const BASE_URL = import.meta.env.PUBLIC_SITE_URL ?? "https://blocleopards.com";

/**
 * Réponse formatée à un message de contact, envoyée depuis le backoffice.
 * Le corps (texte brut, sauts de ligne) est mis en page dans le template Bloc Léopards.
 */
export async function sendContactReply(opts: {
  to: string;
  objet: string;
  body: string;
}): Promise<{ ok: boolean; error?: string }> {
  if (!resend) {
    return { ok: false, error: "RESEND_API_KEY non configurée sur le serveur." };
  }

  const safe = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const bodyHtml = safe(opts.body.trim()).replace(/\n/g, "<br/>");

  const html = `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#07090f;font-family:'Sora',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#07090f;padding:40px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#0d1117;border-radius:20px;border:1px solid rgba(247,214,24,0.25);overflow:hidden;">
        <tr>
          <td style="background:linear-gradient(135deg,#1c2e8f,#07090f);padding:28px 40px;text-align:center;border-bottom:2px solid #f7d618;">
            <p style="margin:0;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#f7d618;font-weight:700;">Bloc Léopards · Support</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 40px;">
            <p style="margin:0 0 18px;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#94a3b8;font-weight:700;">Objet : ${safe(opts.objet)}</p>
            <div style="font-size:15px;color:#e2e8f0;line-height:1.7;">${bodyHtml}</div>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 40px;border-top:1px solid rgba(255,255,255,0.06);text-align:center;">
            <p style="margin:0;font-size:11px;color:#475569;">© 2026 Bloc Léopards · <a href="${BASE_URL}" style="color:#f7d618;text-decoration:none;">blocleopards.com</a></p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  try {
    await resend.emails.send({
      from: FROM,
      to: opts.to,
      subject: `Re: ${opts.objet} — Bloc Léopards`,
      html,
      text: opts.body.trim(),
    });
    return { ok: true };
  } catch (err: any) {
    console.error("Contact reply email error:", err);
    return { ok: false, error: "Échec de l'envoi de l'email." };
  }
}

export async function sendInscriptionConfirmation(opts: {
  to: string;
  firstName: string;
  lastName: string;
  ticketNumber: string;
  matchesVises: string[];
}) {
  const MATCH_LABELS: Record<string, string> = {
    houston: "RDC vs Portugal — Houston (17 Juin 2026)",
    guadalajara: "RDC vs Colombie — Guadalajara (23 Juin 2026)",
    atlanta: "RDC vs Ouzbékistan — Atlanta (27 Juin 2026)",
  };

  const matchList = opts.matchesVises
    .map(k => MATCH_LABELS[k] || k)
    .map(m => `<li style="margin-bottom:6px;padding-left:14px;border-left:3px solid #f7d618;">${m}</li>`)
    .join("");

  const statusUrl = `${BASE_URL}/mondial/tirage?ticket=${encodeURIComponent(opts.ticketNumber)}`;

  const html = `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#07090f;font-family:'Sora',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#07090f;padding:40px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#0d1117;border-radius:20px;border:1px solid rgba(247,214,24,0.25);overflow:hidden;">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#1c2e8f,#07090f);padding:36px 40px;text-align:center;border-bottom:2px solid #f7d618;">
            <p style="margin:0 0 8px;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#f7d618;font-weight:700;">Bloc Léopards · Mondial 2026</p>
            <h1 style="margin:0;font-size:28px;font-weight:800;color:#ffffff;">Inscription confirmée</h1>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 40px;">
            <p style="margin:0 0 20px;font-size:16px;color:#e2e8f0;">Bonjour <strong>${opts.firstName} ${opts.lastName}</strong>,</p>
            <p style="margin:0 0 24px;font-size:14px;color:#94a3b8;line-height:1.7;">
              Ton dossier a bien été reçu et est en cours de vérification par notre équipe. Tu seras notifié(e) des résultats du tirage après publication.
            </p>

            <!-- Ticket number -->
            <div style="background:rgba(247,214,24,0.08);border:1px solid rgba(247,214,24,0.25);border-radius:12px;padding:20px 24px;margin-bottom:24px;text-align:center;">
              <p style="margin:0 0 6px;font-size:11px;letter-spacing:0.15em;text-transform:uppercase;color:#f7d618;font-weight:700;">Ton numéro de candidature</p>
              <p style="margin:0;font-size:22px;font-weight:800;color:#ffffff;font-family:monospace;letter-spacing:0.05em;">${opts.ticketNumber}</p>
            </div>

            <!-- Matches -->
            <div style="margin-bottom:24px;">
              <p style="margin:0 0 12px;font-size:11px;letter-spacing:0.15em;text-transform:uppercase;color:#94a3b8;font-weight:700;">Matchs sélectionnés</p>
              <ul style="margin:0;padding:0 0 0 4px;list-style:none;font-size:14px;color:#e2e8f0;">
                ${matchList}
              </ul>
            </div>

            <!-- CTA -->
            <div style="text-align:center;margin-bottom:28px;">
              <a href="${statusUrl}" style="display:inline-block;padding:14px 32px;background:#f7d618;color:#07090f;font-weight:800;font-size:14px;border-radius:50px;text-decoration:none;">
                Vérifier mon statut de sélection
              </a>
            </div>

            <p style="margin:0;font-size:12px;color:#475569;line-height:1.7;">
              Garde ce lien précieusement : <a href="${statusUrl}" style="color:#f7d618;word-break:break-all;">${statusUrl}</a><br/>
              Il te permettra de savoir si tu es sélectionné(e) après le tirage au sort.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:20px 40px;border-top:1px solid rgba(255,255,255,0.06);text-align:center;">
            <p style="margin:0;font-size:11px;color:#475569;">© 2026 Bloc Léopards · <a href="${BASE_URL}" style="color:#f7d618;text-decoration:none;">blocleopards.com</a></p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  if (!resend) {
    console.warn("RESEND_API_KEY non configurée — email de confirmation non envoyé.");
    return;
  }

  try {
    await resend.emails.send({
      from: FROM,
      to: opts.to,
      subject: `Candidature reçue — ${opts.ticketNumber} | Bloc Léopards Mondial 2026`,
      html,
    });
  } catch (err) {
    console.error("Email send error:", err);
  }
}

export async function sendGuadalajaraConfirmation(opts: {
  to: string;
  firstName: string;
  lastName: string;
  reference: string;
}) {
  const html = `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#07090f;font-family:'Sora',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#07090f;padding:40px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#0d1117;border-radius:20px;border:1px solid rgba(247,214,24,0.25);overflow:hidden;">
        <tr>
          <td style="background:linear-gradient(135deg,#1c2e8f,#07090f);padding:36px 40px;text-align:center;border-bottom:2px solid #f7d618;">
            <p style="margin:0 0 8px;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#f7d618;font-weight:700;">Le Bloc de Guadalajara</p>
            <h1 style="margin:0;font-size:26px;font-weight:800;color:#ffffff;">Demande reçue</h1>
            <p style="margin:10px 0 0;font-size:13px;color:#cbd5e1;">RDC vs Colombie — 23 juin 2026, Guadalajara</p>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 40px;">
            <p style="margin:0 0 20px;font-size:16px;color:#e2e8f0;">Bonjour <strong>${opts.firstName} ${opts.lastName}</strong>,</p>
            <p style="margin:0 0 24px;font-size:14px;color:#94a3b8;line-height:1.7;">
              Votre demande d'assistance pour le match RDC – Colombie a bien été reçue. Votre dossier (pièce d'identité et preuve de transport) sera examiné par le Ministère des Sports et Loisirs. Le nombre de places étant limité, une liste finale des bénéficiaires sera arrêtée après vérification.
            </p>
            <div style="background:rgba(247,214,24,0.08);border:1px solid rgba(247,214,24,0.25);border-radius:12px;padding:20px 24px;margin-bottom:24px;text-align:center;">
              <p style="margin:0 0 6px;font-size:11px;letter-spacing:0.15em;text-transform:uppercase;color:#f7d618;font-weight:700;">Votre numéro de demande</p>
              <p style="margin:0;font-size:22px;font-weight:800;color:#ffffff;font-family:monospace;letter-spacing:0.05em;">${opts.reference}</p>
            </div>
            <p style="margin:0;font-size:12px;color:#475569;line-height:1.7;">
              Conservez ce numéro. Toute communication officielle (y compris le billet électronique si vous êtes retenu) se fera à cette adresse email.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 40px;border-top:1px solid rgba(255,255,255,0.06);text-align:center;">
            <p style="margin:0;font-size:11px;color:#475569;">Tous derrière les Léopards — © 2026 Bloc Léopards · <a href="${BASE_URL}" style="color:#f7d618;text-decoration:none;">blocleopards.com</a></p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  if (!resend) {
    console.warn("RESEND_API_KEY non configurée — email Guadalajara non envoyé.");
    return;
  }

  try {
    await resend.emails.send({
      from: FROM,
      to: opts.to,
      subject: `Demande reçue — ${opts.reference} | Bloc de Guadalajara`,
      html,
    });
  } catch (err) {
    console.error("Email Guadalajara send error:", err);
  }
}
