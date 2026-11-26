import { Capacitor, CapacitorHttp } from "@capacitor/core";

const browserFetch = globalThis.fetch.bind(globalThis);
const configuredOrigin = import.meta.env.VITE_TRADEVAULT_API_ORIGIN?.trim();
const API_ORIGIN = (configuredOrigin || "https://tradevault-tradevault.vercel.app").replace(/\/+$/, "");

export class ApiError extends Error {
  status: number;
  code: string;

  constructor(message: string, status = 0, code = "REQUEST_FAILED") {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

function toHeaderRecord(headers?: HeadersInit): Record<string, string> {
  const result: Record<string, string> = {};
  new Headers(headers).forEach((value, key) => {
    result[key] = value;
  });
  return result;
}

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

function requestMethod(input: RequestInfo | URL, init: RequestInit): string {
  if (init.method) return init.method.toUpperCase();
  return input instanceof Request ? input.method.toUpperCase() : "GET";
}

function nativeBody(init: RequestInit): string | undefined {
  if (init.body == null) return undefined;
  if (typeof init.body === "string") return init.body;
  if (init.body instanceof URLSearchParams) return init.body.toString();
  return String(init.body);
}

function abortError(): DOMException {
  return new DOMException("The request was aborted.", "AbortError");
}

export async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const path = requestUrl(input);
  const method = requestMethod(input, init);

  if (!Capacitor.isNativePlatform()) {
    const url = import.meta.env.DEV ? path : `${API_ORIGIN}${path}`;
    return browserFetch(url, { ...init, credentials: "include" });
  }

  const signal = init.signal;
  if (signal?.aborted) throw abortError();

  const headers = toHeaderRecord(init.headers);
  const request = CapacitorHttp.request({
    url: `${API_ORIGIN}${path}`,
    method,
    headers,
    data: nativeBody(init),
    responseType: "json",
    disableRedirects: true,
    connectTimeout: 15_000,
    readTimeout: 50_000,
  });

  let response: Awaited<typeof request>;
  try {
    response = signal
      ? await Promise.race([
          request,
          new Promise<never>((_, reject) => {
            signal.addEventListener("abort", () => reject(abortError()), { once: true });
          }),
        ])
      : await request;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError("Could not reach the TradeVault server. Check your connection and try again.", 0, "NETWORK");
  }

  const location = response.headers.location || response.headers.Location;
  if (response.status >= 300 && response.status < 400 && location?.includes("vercel.com/sso")) {
    throw new ApiError("The TradeVault production API is not publicly reachable yet.", response.status, "SERVER_AUTH_REQUIRED");
  }

  const noContent = response.status === 204 || response.status === 205 || response.status === 304;
  const body = noContent || response.data == null
    ? null
    : typeof response.data === "string"
      ? response.data
      : JSON.stringify(response.data);

  return new Response(body, {
    status: response.status,
    headers: response.headers,
  });
}

export function installMobileFetch(): void {
  const currentFetch = globalThis.fetch;
  if ((currentFetch as typeof fetch & { __tradevaultMobile?: boolean }).__tradevaultMobile) return;

  const mobileFetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const url = requestUrl(input);
    return url.startsWith("/api/") ? apiFetch(input, init) : currentFetch(input, init);
  }) as typeof fetch & { __tradevaultMobile?: boolean };

  mobileFetch.__tradevaultMobile = true;
  globalThis.fetch = mobileFetch;
}

export async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text) return {} as T;

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ApiError(
      response.ok
        ? "The TradeVault server returned an invalid response."
        : "The TradeVault server could not complete the request.",
      response.status,
      "INVALID_RESPONSE",
    );
  }
}

export async function apiError(response: Response, fallback: string): Promise<ApiError> {
  const data = await readJson<{ error?: string; message?: string }>(response).catch(() => ({
    error: undefined,
    message: undefined,
  }));
  return new ApiError(data.message || data.error || fallback, response.status);
}
