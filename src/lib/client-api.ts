const TOKEN_KEY = "college_library_session_token";

let memoryToken: string | null = null;
let loaded = false;

export class ApiError extends Error {
  status: number;
  reason?: string;
  constructor(message: string, status: number, reason?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.reason = reason;
  }
}

function readStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  for (const store of ["localStorage", "sessionStorage"] as const) {
    try {
      const value = window[store].getItem(TOKEN_KEY);
      if (value) return value;
    } catch {
      // Storage can be blocked in partitioned iframes / private windows.
    }
  }
  return null;
}

export function getSessionToken(): string | null {
  if (!loaded) {
    loaded = true;
    memoryToken = readStoredToken();
  }
  return memoryToken;
}

export function setSessionToken(token: string | null) {
  memoryToken = token;
  loaded = true;
  if (typeof window === "undefined") return;
  for (const store of ["localStorage", "sessionStorage"] as const) {
    try {
      if (token) window[store].setItem(TOKEN_KEY, token);
      else window[store].removeItem(TOKEN_KEY);
    } catch {
      // Fall back to the in-memory token for this page session.
    }
  }
}

export function clearSessionToken() {
  setSessionToken(null);
}

export async function apiFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const usedToken = getSessionToken();
  const response = await fetch(url, {
    cache: "no-store",
    credentials: "include",
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      // Bearer fallback keeps the session alive when third-party cookies are blocked.
      ...(usedToken ? { Authorization: `Bearer ${usedToken}` } : {}),
      ...options.headers,
    },
  });

  const payload = await response.json().catch(() => ({})) as T & { error?: string; token?: string; reason?: string };

  // A freshly issued token always wins (login, register, reset, profile/password change).
  if (payload && typeof payload.token === "string" && payload.token) {
    setSessionToken(payload.token);
  } else if (response.status === 401 && payload?.reason && getSessionToken() === usedToken) {
    // Only invalidate when the server rejected *this* credential. An unrelated
    // anonymous request must never wipe a token issued by a newer sign-in.
    clearSessionToken();
  }

  if (!response.ok) throw new ApiError(payload?.error || "Something went wrong. Please try again.", response.status, payload?.reason);
  return payload;
}

export function apiPost<T>(url: string, body: Record<string, unknown>, method = "POST") {
  return apiFetch<T>(url, { method, body: JSON.stringify(body) });
}
