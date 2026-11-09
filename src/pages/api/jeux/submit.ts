import type { APIRoute } from "astro";
import { getOrCreatePlayer, recordGameMatch, type ArenaGame } from "../../../lib/arena/champions";

const SESSION_COOKIE_NAME = "bloc_player_session";

export const POST: APIRoute = async ({ request, cookies, url }) => {
  try {
    const rawToken = cookies.get(SESSION_COOKIE_NAME)?.value || null;
    const body = await request.json().catch(() => ({}));

    const game = String(body.game || "") as ArenaGame;
    if (!["foot", "basket", "envol"].includes(game)) {
      return new Response(
        JSON.stringify({ success: false, error: "Jeu invalide" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const score = Number(body.score);
    if (!Number.isFinite(score) || score < 0) {
      return new Response(
        JSON.stringify({ success: false, error: "Score invalide" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const initialNickname = body.nickname ? String(body.nickname) : undefined;
    const { player } = await getOrCreatePlayer(rawToken, initialNickname);

    // Si un pseudo a été passé et est différent du pseudo en base, on le synchronise
    if (body.nickname && String(body.nickname).trim() && String(body.nickname).trim() !== player.nickname) {
      const { updatePlayerNickname } = await import("../../../lib/arena/champions");
      const updated = await updatePlayerNickname(player.id, String(body.nickname));
      if (updated) {
        player.nickname = updated.nickname;
      }
    }

    const nonce = body.nonce ? String(body.nonce) : undefined;
    const details = typeof body.details === "object" && body.details !== null ? body.details : {};

    const matchResult = await recordGameMatch({
      playerId: player.id,
      game,
      score,
      details,
      nonce
    });

    const origin = url.origin || "https://blocleopards.com";
    const challengePayload = {
      m: matchResult.matchId,
      g: game,
      s: matchResult.score,
      n: player.nickname,
      t: player.public_tag
    };
    const challengeCode = Buffer.from(JSON.stringify(challengePayload)).toString("base64url");
    const challengeUrl = `${origin}/jeux?match=${challengeCode}`;

    return new Response(
      JSON.stringify({
        success: true,
        player: {
          id: player.id,
          nickname: player.nickname,
          public_tag: player.public_tag
        },
        result: matchResult,
        challengeUrl
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err?.message || "Erreur de validation" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};

