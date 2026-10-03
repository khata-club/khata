import type { components } from "./generated/schema.js";
import {
  validateFailure,
  validateIdentity,
  validateStatus,
} from "./generated/validators.js";

export type { components, paths } from "./generated/schema.js";
export type Identity = components["schemas"]["Identity"];
export type Status = components["schemas"]["Status"];
export type Failure = components["schemas"]["Failure"];

export class TransportError extends Error {
  override readonly name = "TransportError";
  constructor(cause: unknown) {
    super("The API request could not be completed", { cause });
  }
}
export class HttpError extends Error {
  override readonly name = "HttpError";
  constructor(
    readonly status: number,
    readonly failure: Failure | undefined,
  ) {
    super(failure?.message ?? `API returned HTTP ${status}`);
  }
}
export class ResponseValidationError extends Error {
  override readonly name = "ResponseValidationError";
  constructor(readonly status: number) {
    super("The API response does not match its public contract");
  }
}
export interface ClientOptions {
  baseUrl: string;
  fetch?: typeof globalThis.fetch;
  getAccessToken?: (
    signal?: AbortSignal,
  ) => string | undefined | Promise<string | undefined>;
}
export interface RequestOptions {
  signal?: AbortSignal;
}

function abortable<T>(
  value: T | Promise<T>,
  signal: AbortSignal | undefined,
): Promise<T> {
  if (!signal) return Promise.resolve(value);
  return new Promise<T>((resolve, reject) => {
    const abort = () => {
      cleanup();
      reject(signal.reason);
    };
    const cleanup = () => signal.removeEventListener("abort", abort);
    if (signal.aborted) {
      reject(signal.reason);
      return;
    }
    signal.addEventListener("abort", abort, { once: true });
    Promise.resolve(value).then(
      (result) => {
        cleanup();
        resolve(result);
      },
      (error: unknown) => {
        cleanup();
        reject(error);
      },
    );
  });
}

/** No session storage or retries. Callers own token acquisition and retry policy. */
export function createApiClient(options: ClientOptions) {
  const base = new URL(options.baseUrl);
  const local = ["localhost", "127.0.0.1"].includes(base.hostname);
  if (
    (base.protocol !== "https:" && !(local && base.protocol === "http:")) ||
    base.username ||
    base.password ||
    base.pathname !== "/" ||
    base.search ||
    base.hash
  )
    throw new TypeError(
      "baseUrl must be an HTTPS origin, or a local HTTP origin",
    );
  const fetcher = options.fetch ?? globalThis.fetch;

  async function request<T>(
    path: string,
    validate: (value: unknown) => value is T,
    authenticated: boolean,
    requestOptions: RequestOptions = {},
  ): Promise<T> {
    let response: Response;
    try {
      requestOptions.signal?.throwIfAborted();
      const headers = new Headers({ Accept: "application/json" });
      if (authenticated) {
        const token = await abortable(
          options.getAccessToken?.(requestOptions.signal),
          requestOptions.signal,
        );
        requestOptions.signal?.throwIfAborted();
        if (token) headers.set("Authorization", `Bearer ${token}`);
      }
      response = await fetcher(new URL(path, base), {
        method: "GET",
        headers,
        credentials: "omit",
        redirect: "error",
        ...(requestOptions.signal ? { signal: requestOptions.signal } : {}),
      });
    } catch (error) {
      throw new TransportError(error);
    }
    let payload: unknown;
    try {
      if (
        !response.headers
          .get("content-type")
          ?.toLowerCase()
          .startsWith("application/json")
      ) {
        if (!response.ok) throw new HttpError(response.status, undefined);
        throw new ResponseValidationError(response.status);
      }
      payload = await response.json();
    } catch (error) {
      if (
        error instanceof HttpError ||
        error instanceof ResponseValidationError
      )
        throw error;
      // A cancelled/failed body stream is a transport failure, malformed JSON a contract failure.
      if (error instanceof SyntaxError)
        throw new ResponseValidationError(response.status);
      throw new TransportError(error);
    }
    if (!response.ok)
      throw new HttpError(
        response.status,
        validateFailure(payload) ? payload : undefined,
      );
    if (response.status !== 200 || !validate(payload))
      throw new ResponseValidationError(response.status);
    return payload;
  }
  return {
    health: (requestOptions?: RequestOptions) =>
      request("/healthz", validateStatus, false, requestOptions),
    ready: (requestOptions?: RequestOptions) =>
      request("/readyz", validateStatus, false, requestOptions),
    me: (requestOptions?: RequestOptions) =>
      request("/v1/me", validateIdentity, true, requestOptions),
  };
}
