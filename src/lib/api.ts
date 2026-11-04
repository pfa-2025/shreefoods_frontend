import { API_URL } from "./env";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface ApiRequestInit extends Omit<RequestInit, "body"> {
  json?: unknown;
}

/** Typed fetch wrapper. Throws ApiError with the server's structured message. */
export async function api<T>(path: string, { json, headers, ...init }: ApiRequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: { ...(json !== undefined ? { "Content-Type": "application/json" } : {}), ...headers },
    body: json !== undefined ? JSON.stringify(json) : undefined,
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string; details?: unknown } | null;
    throw new ApiError(res.status, body?.message ?? res.statusText, body?.details);
  }
  return (await res.json()) as T;
}
