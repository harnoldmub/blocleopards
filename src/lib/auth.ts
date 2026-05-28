export function isAdminAuthed(cookies: { get: (name: string) => { value: string } | undefined }): boolean {
  const token = cookies.get("admin_session")?.value;
  const expected = import.meta.env.ADMIN_SESSION_TOKEN;
  return Boolean(token && expected && token === expected);
}

export function checkAdminPassword(password: string): boolean {
  return password === import.meta.env.ADMIN_PASSWORD;
}
