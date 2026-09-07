export interface ApiEnvelope<T> {
  data?: T;
  error?: { code: string; message: string };
}

export async function apiFetch<T>(url: string, options?: RequestInit): Promise<ApiEnvelope<T>> {
  const res = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) },
  });
  const body = (await res.json().catch(() => ({}))) as ApiEnvelope<T>;
  if (!res.ok && !body.error) {
    return { error: { code: "UNKNOWN", message: res.statusText } };
  }
  return body;
}
