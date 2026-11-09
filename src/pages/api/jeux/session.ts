import type { APIRoute } from "astro";
import { getOrCreatePlayer, updatePlayerNickname, getPlayerRecords } from "../../../lib/arena/champions";

const SESSION_COOKIE_NAME = "bloc_player_session";
const ONE_YEAR_SECS = 365 * 24 * 60 * 60;

export const GET: APIRoute = async ({ cookies, url }) => {
  try {
    const rawToken = cookies.get(SESSION_COOKIE_NAME)?.value || null;
    const initialName = url.searchParams.get("name") || null;

    const { player, isNew } = await getOrCreatePlayer(rawToken, initialName);

    // Poser / renouveler le cookie pour 1 an
    cookies.set(SESSION_COOKIE_NAME, player.session_token, {
      path: "/",
      maxAge: ONE_YEAR_SECS,
      sameSite: "lax",
      httpOnly: true,
      secure: import.meta.env.PROD
    });

    const records = await getPlayerRecords(player.id);

    return new Response(
      JSON.stringify({
        success: true,
        player: {
          id: player.id,
          nickname: player.nickname,
          public_tag: player.public_tag,
          created_at: player.created_at,
          records
        },
        isNew
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err?.message || "Erreur de session" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const rawToken = cookies.get(SESSION_COOKIE_NAME)?.value || null;
    if (!rawToken) {
      return new Response(
        JSON.stringify({ success: false, error: "Session inexistante" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    const body = await request.json().catch(() => ({}));
    const newNickname = String(body.nickname || "").trim();

    const { validatePlayerNickname } = await import("../../../lib/arena/moderation");
    const check = validatePlayerNickname(newNickname);
    if (!check.ok) {
      return new Response(
        JSON.stringify({ success: false, error: check.error || "Pseudo non autorisé" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const { player } = await getOrCreatePlayer(rawToken);
    const updated = await updatePlayerNickname(player.id, newNickname);

    if (!updated) {
      return new Response(
        JSON.stringify({ success: false, error: "Joueur introuvable" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    const records = await getPlayerRecords(updated.id);

    return new Response(
      JSON.stringify({
        success: true,
        player: {
          id: updated.id,
          nickname: updated.nickname,
          public_tag: updated.public_tag,
          records
        }
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err?.message || "Erreur serveur" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};

