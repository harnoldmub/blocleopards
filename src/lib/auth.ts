import { createHmac, pbkdf2Sync, randomBytes } from "crypto";

const PBKDF2_ITERATIONS = 10_000;

export const ADMIN_SECTIONS = [
  { id: "dashboard",    label: "Dashboard",   icon: "dashboard"    },
  { id: "stats",        label: "Statistiques", icon: "bar-chart"   },
  { id: "mondial",      label: "Mondial USA",  icon: "globe"        },
  { id: "guadalajara",  label: "Guadalajara",  icon: "plane"        },
  { id: "adhesions",    label: "Adhésions",    icon: "users"        },
  { id: "supporters",   label: "Supporters",   icon: "list"         },
  { id: "contacts",     label: "Messages",     icon: "mail"         },
  { id: "newsletter",   label: "Newsletter",   icon: "send"         },
  { id: "articles",     label: "Articles",     icon: "newspaper"    },
];

type Cookies = { get: (name: string) => { value: string } | undefined };
type WritableCookies = { set: (name: string, value: string, opts: object) => void };
type DeletableCookies = { delete: (name: string, opts: object) => void };

function getSecret(): string {
  return import.meta.env.ADMIN_SESSION_TOKEN ?? "dev-secret";
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, 64, "sha512").toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const [salt, hash] = stored.split(":");
    if (!salt || !hash) return false;
    const derived = pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, 64, "sha512").toString("hex");
    return derived === hash;
  } catch {
    return false;
  }
}

function signPermissions(permissions: string[]): string {
  const json = JSON.stringify(permissions);
  const b64 = Buffer.from(json).toString("base64");
  const sig = createHmac("sha256", getSecret()).update(json).digest("hex");
  return `${b64}|${sig}`;
}

function parseSignedPermissions(value: string): string[] {
  try {
    const [b64, sig] = value.split("|");
    const json = Buffer.from(b64, "base64").toString();
    const expected = createHmac("sha256", getSecret()).update(json).digest("hex");
    if (sig !== expected) return [];
    return JSON.parse(json) as string[];
  } catch {
    return [];
  }
}

export function isAdminAuthed(cookies: Cookies): boolean {
  const token = cookies.get("admin_session")?.value;
  const expected = import.meta.env.ADMIN_SESSION_TOKEN;
  return Boolean(token && expected && token === expected);
}

export function getSessionRole(cookies: Cookies): string {
  return cookies.get("admin_role")?.value ?? "super";
}

export function getSessionPermissions(cookies: Cookies): string[] {
  const raw = cookies.get("admin_permissions")?.value;
  if (!raw) {
    if (getSessionRole(cookies) === "super") return ["*"];
    return [];
  }
  return parseSignedPermissions(raw);
}

export function hasPermission(cookies: Cookies, section: string): boolean {
  const perms = getSessionPermissions(cookies);
  return perms.includes("*") || perms.includes(section);
}

export function isSuperAdmin(cookies: Cookies): boolean {
  return getSessionRole(cookies) === "super";
}

export function setSessionCookies(cookies: WritableCookies, role: string, permissions: string[], user: string): void {
  const opts = {
    httpOnly: true,
    secure: import.meta.env.PROD,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  };
  cookies.set("admin_session", import.meta.env.ADMIN_SESSION_TOKEN, opts);
  cookies.set("admin_role", role, opts);
  cookies.set("admin_permissions", signPermissions(permissions), opts);
  cookies.set("admin_user", user, opts);
}

export function getSessionUser(cookies: Cookies): string {
  return cookies.get("admin_user")?.value ?? getSessionRole(cookies);
}

export function clearSessionCookies(cookies: DeletableCookies): void {
  const opts = { path: "/" };
  cookies.delete("admin_session", opts);
  cookies.delete("admin_role", opts);
  cookies.delete("admin_permissions", opts);
  cookies.delete("admin_user", opts);
}

export function checkAdminPassword(password: string): boolean {
  return password === import.meta.env.ADMIN_PASSWORD;
}
