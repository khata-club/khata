import { describe, expect, it, vi } from "vitest";
import {
  HttpError,
  ResponseValidationError,
  TransportError,
  createApiClient,
} from "./index.js";
const id = "123e4567-e89b-42d3-a456-426614174000";
const baseUrl = "https://api.example.com";
function setup(response: Response = Response.json({ id })) {
  const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(response);
  const getAccessToken = vi.fn().mockResolvedValue("synthetic-token");
  return {
    fetch,
    getAccessToken,
    client: createApiClient({ baseUrl, fetch, getAccessToken }),
  };
}
describe("public API client", () => {
  it("validates identity and acquires tokens only for authenticated routes", async () => {
    const { client, fetch, getAccessToken } = setup();
    expect(await client.me()).toEqual({ id });
    const call = fetch.mock.calls[0];
    if (!call) throw new Error("Expected a request");
    const [url, init] = call;
    expect(String(url)).toBe(`${baseUrl}/v1/me`);
    expect(new Headers(init?.headers).get("Authorization")).toBe(
      "Bearer synthetic-token",
    );
    expect(init).toMatchObject({ credentials: "omit", redirect: "error" });
    expect(getAccessToken).toHaveBeenCalledTimes(1);
  });
  it.each(["health", "ready"] as const)("%s is public", async (method) => {
    const { client, fetch, getAccessToken } = setup(
      Response.json({ status: "ok" }),
    );
    expect(await client[method]()).toEqual({ status: "ok" });
    expect(getAccessToken).not.toHaveBeenCalled();
    expect(
      new Headers(fetch.mock.calls[0]?.[1]?.headers).has("Authorization"),
    ).toBe(false);
  });
  it.each([401, 503, 429])("reports safe HTTP %s failures", async (status) => {
    const failure = {
      code: "SAFE_ERROR",
      message: "Service unavailable",
      requestId: id,
    };
    const { client } = setup(Response.json(failure, { status }));
    await expect(client.me()).rejects.toMatchObject({
      name: "HttpError",
      status,
      failure,
    });
  });
  it("does not expose unexpected response bodies in HTTP errors", async () => {
    const { client } = setup(new Response("database secret", { status: 503 }));
    await expect(client.me()).rejects.toEqual(new HttpError(503, undefined));
  });
  it.each([{ id: "bad" }, {}, { id, privateRule: 42 }])(
    "rejects malformed or expanded successful responses %j",
    async (body) => {
      const { client } = setup(Response.json(body));
      await expect(client.me()).rejects.toBeInstanceOf(ResponseValidationError);
    },
  );
  it("rejects malformed JSON", async () => {
    const { client } = setup(
      new Response("{", { headers: { "content-type": "application/json" } }),
    );
    await expect(client.me()).rejects.toBeInstanceOf(ResponseValidationError);
  });
  it("classifies network errors and never retries", async () => {
    const { client, fetch } = setup();
    fetch.mockRejectedValue(new TypeError("network"));
    await expect(client.me()).rejects.toBeInstanceOf(TransportError);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("cancels before token acquisition and forwards active cancellation", async () => {
    const { client, fetch, getAccessToken } = setup();
    await expect(
      client.me({ signal: AbortSignal.abort() }),
    ).rejects.toBeInstanceOf(TransportError);
    expect(fetch).not.toHaveBeenCalled();
    expect(getAccessToken).not.toHaveBeenCalled();
    const controller = new AbortController();
    await client.me({ signal: controller.signal });
    expect(fetch.mock.calls[0]?.[1]?.signal).toBe(controller.signal);
  });
  it("classifies failed token acquisition as transport failure", async () => {
    const { client, fetch, getAccessToken } = setup();
    getAccessToken.mockRejectedValue(new Error("token unavailable"));
    await expect(client.me()).rejects.toBeInstanceOf(TransportError);
    expect(fetch).not.toHaveBeenCalled();
  });
  it.each([
    "http://api.example.com",
    "https://user:password@api.example.com",
    "https://api.example.com/path",
    "https://api.example.com?token=bad",
  ])("rejects unsafe API origins %s", (baseUrl) =>
    expect(() => createApiClient({ baseUrl })).toThrow(TypeError),
  );
  it("cancels while token acquisition is pending", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>();
    const controller = new AbortController();
    const client = createApiClient({
      baseUrl,
      fetch,
      getAccessToken: () => new Promise(() => {}),
    });
    const pending = client.me({ signal: controller.signal });
    controller.abort();
    await expect(pending).rejects.toBeInstanceOf(TransportError);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("rejects undocumented success statuses", async () => {
    const { client } = setup(Response.json({ id }, { status: 201 }));
    await expect(client.me()).rejects.toBeInstanceOf(ResponseValidationError);
  });
  it("accepts a local development origin", () =>
    expect(() =>
      createApiClient({ baseUrl: "http://127.0.0.1:8787" }),
    ).not.toThrow());
});
