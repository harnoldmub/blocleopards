const MIN_MS = 3000;

export function isSpam(formData: FormData): boolean {
  if (formData.get("_hp")) return true;
  const t = parseInt((formData.get("_t") as string) || "0");
  if (t && Date.now() - t < MIN_MS) return true;
  return false;
}
