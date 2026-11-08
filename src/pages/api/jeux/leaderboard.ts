import type { APIRoute } from "astro";
import { getLeaderboard, getOrCreatePlayer, type ArenaGame, type LeaderboardPeriod } from "../../../lib/arena/champions";

const SESSION_COOKIE_NAME = "bloc_player_session";

export const GET: APIRoute = async ({ cookies, url }) => {
  try {
    const rawGame = url.searchParams.get("game") || "foot";
    const game = (["foot", "basket", "envol"].includes(rawGame) ? rawGame : "foot") as ArenaGame;

    const rawPeriod = url.searchParams.get("period") || "week";
    const period = (["week", "all"].includes(rawPeriod) ? rawPeriod : "week") as LeaderboardPeriod;

    const limit = Math.max(5, Math.min(50, Number(url.searchParams.get("limit")) || 20));

    const rawToken = cookies.get(SESSION_COOKIE_NAME)?.value || null;
    let currentPlayerId: string | null = null;

    if (rawToken) {
      try {
        const { player } = await getOrCreatePlayer(rawToken);
        currentPlayerId = player.id;
      } catch {
        // session invalide / ignorée
      }
    }

    const leaderboard = await getLeaderboard({
      game,
      period,
      currentPlayerId,
      limit
    });

    return new Response(JSON.stringify({ success: true, ...leaderboard }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=10, s-maxage=15"
      }
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err?.message || "Erreur de classement" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
