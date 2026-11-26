import { createApp, route } from "@rest-rpc/server";

import { cors, requestContext, sendErrors } from "./interceptors.ts";

const app = createApp(
  {
    ok: route.get("/ok").handler(() => "ok"),
    missing: route.get("/missing").handler(() => {
      throw { code: "P2025", message: "Record to update not found." };
    }),
  },
  { interceptors: [requestContext, cors, sendErrors] },
);

const get = (path: string, init?: RequestInit) =>
  app.fetch(new Request(`http://localhost${path}`, init));

describe("api interceptors", () => {
  it("adds a request id and open CORS headers", async () => {
    const response = await get("/ok");

    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    expect(response.headers.get("x-request-id")).toBeTruthy();
  });

  it("answers preflights with the headers the browser asks for", async () => {
    const response = await get("/ok", {
      method: "OPTIONS",
      headers: { "access-control-request-headers": "authorization,accept-language" },
    });

    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-headers")).toBe(
      "authorization,accept-language",
    );
  });

  it("maps a Prisma not-found to 404, with CORS headers", async () => {
    const response = await get("/missing");

    expect(response.status).toBe(404);
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
  });
});
