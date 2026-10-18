// The public Vercel app keeps using the existing, authenticated editorial service.
export const DEFAULT_BACKEND_ORIGIN = "https://do-codigo-a-supervisao-pedro.pdrarth.chatgpt.site";

export function backendUrl(path, origin = process.env.TCC_BACKEND_ORIGIN || DEFAULT_BACKEND_ORIGIN) {
  const base = new URL(origin);
  const local = process.env.NODE_ENV !== "production" && ["localhost", "127.0.0.1", "[::1]"].includes(base.hostname);
  if ((base.protocol !== "https:" && !(local && base.protocol === "http:")) || base.username || base.password || base.pathname !== "/" || base.search || base.hash) {
    throw new Error("TCC_BACKEND_ORIGIN must be an HTTPS origin without a path or credentials.");
  }
  if (!path.startsWith("/") || path.startsWith("//")) throw new Error("Expected a local backend path.");
  const target = new URL(path, base);
  if (target.origin !== base.origin) throw new Error("Invalid backend destination.");
  return target;
}

export function backendRedirect(request, path, origin) {
  const destination = backendUrl(path, origin);
  const incoming = new URL(request.url);
  if (incoming.origin === destination.origin) {
    return Response.json({ error: "O serviço editorial precisa de um endereço próprio." }, { status: 503 });
  }
  destination.search = incoming.search;
  // Redirect the client; never proxy authentication headers or private writes.
  return new Response(null, { status: 307, headers: { Location: destination.href, "Cache-Control": "no-store" } });
}
