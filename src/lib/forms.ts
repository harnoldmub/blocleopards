export function formValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export function redirectTo(path: string, status = "success") {
  return new Response(null, {
    status: 303,
    headers: {
      Location: `${path}?status=${status}`
    }
  });
}
