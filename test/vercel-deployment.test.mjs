import test from "node:test";
import assert from "node:assert/strict";
import { backendUrl, backendRedirect, DEFAULT_BACKEND_ORIGIN } from "../src/lib/deployment-backend.mjs";
import { listPublished } from "../src/lib/updates.ts";

const published = {
  id: "published-item", title: "Estudo publicado", summary: "Resumo público",
  relevance: "Relação com a pesquisa", limitations: "Limitações do estudo",
  organization: "Universidade", sourceUrl: "https://example.org/paper",
  type: "research", eventDate: null, publicationDate: "2026-10-01",
  checkedDate: "2026-10-02", publishedAt: "2026-10-02T10:00:00Z",
};

test("backend destinations stay on the configured HTTPS origin", () => {
  assert.equal(backendUrl("/revisao").href, `${DEFAULT_BACKEND_ORIGIN}/revisao`);
  for (const origin of ["http://example.org", "https://user:secret@example.org", "https://example.org/path", "https://example.org?secret=x"]) {
    assert.throws(() => backendUrl("/revisao", origin));
  }
  for (const path of ["https://example.org/", "//example.org/", "/\\example.org/"]) assert.throws(() => backendUrl(path));
});

test("private routes redirect to the existing login without forwarding identity or writes", async () => {
  const request = new Request("https://islands.example/api/editorial/decision?revision=1", {
    method: "POST", headers: { "oai-authenticated-user-id": "forged", authorization: "Bearer forged" }, body: "private action",
  });
  const response = backendRedirect(request, "/api/editorial/decision");
  assert.equal(response.status, 307);
  assert.equal(response.headers.get("location"), `${DEFAULT_BACKEND_ORIGIN}/api/editorial/decision?revision=1`);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("authorization"), null);
  assert.equal(await response.text(), "");
  assert.equal(request.bodyUsed, false);
  assert.equal(backendRedirect(new Request(`${DEFAULT_BACKEND_ORIGIN}/mcp`), "/mcp").status, 503);
});

test("the public feed strips private fields and never forwards browser credentials", async () => {
  const rows = await listPublished(async (url, options) => {
    assert.equal(url.href, `${DEFAULT_BACKEND_ORIGIN}/api/updates`);
    assert.equal(options.redirect, "error");
    assert.equal(options.cache, "no-store");
    assert.deepEqual(options.headers, { Accept: "application/json" });
    return Response.json({ updates: [{ ...published, status: "published", revision: 3, createdAt: "private" }] });
  });
  assert.deepEqual(rows, [published]);
});

test("drafts, unsafe sources and upstream failures cannot become public news", async () => {
  for (const row of [{ ...published, status: "draft" }, { ...published, sourceUrl: "javascript:alert(1)" }]) {
    await assert.rejects(listPublished(async () => Response.json({ updates: [row] })));
  }
  await assert.rejects(listPublished(async () => new Response("unavailable", { status: 503 })));
  await assert.rejects(listPublished(async () => { throw new Error("network unavailable"); }));
});
