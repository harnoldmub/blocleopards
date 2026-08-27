const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

// Si la cle secrete n'est pas configuree (dev local), on laisse passer sans bloquer les formulaires.
export async function verifyTurnstile(token: string, ip?: string | null): Promise<boolean> {
  const secret = import.meta.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  if (!token) return false;

  try {
    const res = await fetch(VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        secret,
        response: token,
        ...(ip ? { remoteip: ip } : {}),
      }),
    });
    const data = await res.json();
    return data.success === true;
  } catch (err) {
    console.error("[turnstile] verification echouee", err);
    return false;
  }
}
