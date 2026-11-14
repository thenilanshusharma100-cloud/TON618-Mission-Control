const API_BASE = import.meta.env.VITE_API_BASE ?? "/api"

export class ApiError extends Error {
  status: number
  code: string | null

  constructor(message: string, status: number, code: string | null = null) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.code = code
  }
}

async function readError(response: Response): Promise<ApiError> {
  let message = `Request failed: ${response.status} ${response.statusText}`
  let code: string | null = null

  try {
    const payload = (await response.json()) as { detail?: unknown }
    if (payload.detail && typeof payload.detail === "object" && !Array.isArray(payload.detail)) {
      const detail = payload.detail as { code?: unknown; message?: unknown }
      if (typeof detail.message === "string") message = detail.message
      if (typeof detail.code === "string") code = detail.code
    }
  } catch {
    // Non-JSON error body: keep the status-line message.
  }

  return new ApiError(message, response.status, code)
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { Accept: "application/json", ...init?.headers },
  })

  if (!response.ok) {
    throw await readError(response)
  }

  return (await response.json()) as T
}

export function fetchJson<T>(path: string): Promise<T> {
  return requestJson<T>(path)
}

export function postJson<T>(path: string, body: unknown): Promise<T> {
  return requestJson<T>(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

export function putJson<T>(path: string, body: unknown): Promise<T> {
  return requestJson<T>(path, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

export { API_BASE }
