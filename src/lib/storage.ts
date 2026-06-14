import { AwsClient } from "aws4fetch";

const ENDPOINT = import.meta.env.S3_ENDPOINT;
const REGION = import.meta.env.S3_REGION || "auto";
const BUCKET = import.meta.env.S3_BUCKET;
const ACCESS_KEY_ID = import.meta.env.S3_ACCESS_KEY_ID;
const SECRET_ACCESS_KEY = import.meta.env.S3_SECRET_ACCESS_KEY;

/** Le stockage objet est-il configuré ? Sinon on retombe sur le stockage DB (bytea). */
export const hasObjectStorage = Boolean(ENDPOINT && BUCKET && ACCESS_KEY_ID && SECRET_ACCESS_KEY);

let client: AwsClient | null = null;
function getClient(): AwsClient {
  if (!client) {
    client = new AwsClient({
      accessKeyId: ACCESS_KEY_ID,
      secretAccessKey: SECRET_ACCESS_KEY,
      region: REGION,
      service: "s3",
    });
  }
  return client;
}

function objectUrl(key: string): string {
  const base = ENDPOINT.replace(/\/$/, "");
  const cleanKey = key.replace(/^\//, "");
  return `${base}/${BUCKET}/${cleanKey}`;
}

/** Téléverse un objet. Retourne la clé de stockage. */
export async function putObject(key: string, body: Buffer | Uint8Array, contentType: string): Promise<string> {
  if (!hasObjectStorage) throw new Error("Stockage objet non configuré (variables S3_* manquantes).");
  const res = await getClient().fetch(objectUrl(key), {
    method: "PUT",
    body,
    headers: { "Content-Type": contentType, "Content-Length": String(body.byteLength) },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Échec upload S3 (${res.status}): ${text.slice(0, 200)}`);
  }
  return key;
}

/** Récupère un objet. Retourne le buffer et le content-type, ou null si absent. */
export async function getObject(key: string): Promise<{ body: Buffer; contentType: string } | null> {
  if (!hasObjectStorage) return null;
  const res = await getClient().fetch(objectUrl(key), { method: "GET" });
  if (res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Échec lecture S3 (${res.status}): ${text.slice(0, 200)}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  return { body: buf, contentType: res.headers.get("content-type") || "application/octet-stream" };
}

/** Supprime un objet (best-effort). */
export async function deleteObject(key: string): Promise<void> {
  if (!hasObjectStorage) return;
  try {
    await getClient().fetch(objectUrl(key), { method: "DELETE" });
  } catch (err) {
    console.error("Échec suppression S3:", err);
  }
}

/** Génère une clé de stockage organisée par préfixe et date. */
export function buildStorageKey(prefix: string, filename: string): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `${prefix}/${y}/${m}/${filename}`;
}
