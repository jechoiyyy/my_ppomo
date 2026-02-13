const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080/api/v1";

type Tokens = {
  accessToken: string;
  refreshToken: string;
};

export function getTokens(): Tokens | null {
  const raw = localStorage.getItem("pomodoro.tokens");
  return raw ? (JSON.parse(raw) as Tokens) : null;
}

export function setTokens(tokens: Tokens | null): void {
  if (!tokens) {
    localStorage.removeItem("pomodoro.tokens");
    return;
  }
  localStorage.setItem("pomodoro.tokens", JSON.stringify(tokens));
}

async function refreshAccessToken(): Promise<string | null> {
  const tokens = getTokens();
  if (!tokens?.refreshToken) return null;

  const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken: tokens.refreshToken })
  });

  if (!res.ok) {
    setTokens(null);
    return null;
  }

  const data = (await res.json()) as { accessToken: string; refreshToken: string };
  setTokens(data);
  return data.accessToken;
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const tokens = getTokens();
  const headers = new Headers(init?.headers ?? {});

  if (!headers.has("Content-Type") && init?.body) {
    headers.set("Content-Type", "application/json");
  }

  if (tokens?.accessToken) {
    headers.set("Authorization", `Bearer ${tokens.accessToken}`);
  }

  let res = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });

  if (res.status === 401 && tokens?.refreshToken) {
    const newAccess = await refreshAccessToken();
    if (newAccess) {
      headers.set("Authorization", `Bearer ${newAccess}`);
      res = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
    }
  }

  if (!res.ok) {
    let payload: unknown = null;
    try {
      payload = await res.json();
    } catch {
      payload = null;
    }
    const detail =
      payload && typeof payload === "object" && "detail" in payload
        ? String((payload as { detail?: unknown }).detail ?? "Request failed")
        : `Request failed (${res.status})`;
    throw new Error(detail);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return (await res.json()) as T;
}

export const apiBase = API_BASE_URL;
