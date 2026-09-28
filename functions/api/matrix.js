/**
 * Cloudflare Pages Function: /api/matrix
 * Returns the goals matrix data from KV, bundled static cache, or fallback mock data.
 */

export async function onRequestGet(context) {
  const { env } = context;

  // 1. Check if cached data exists in Cloudflare KV (if bound)
  if (env && env.HEATMAP_KV) {
    try {
      const cached = await env.HEATMAP_KV.get("asana_matrix_data", { type: "json" });
      if (cached && cached.sites && cached.cells) {
        return new Response(JSON.stringify(cached), {
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        });
      }
    } catch (e) {}
  }

  // 2. Serve bundled static matrix_cache.json (pure JSON)
  try {
    const cacheUrl = new URL("/matrix_cache.json", context.request.url);
    const res = await env.ASSETS.fetch(cacheUrl);
    if (res.ok) {
      return new Response(res.body, {
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }
  } catch (e) {}

  // 3. Fall back to mock_data.js extraction if needed
  try {
    const mockUrl = new URL("/mock_data.js", context.request.url);
    const res = await env.ASSETS.fetch(mockUrl);
    if (res.ok) {
      const text = await res.text();
      const match = text.match(/window\.EMBEDDED_MOCK_DATA\s*=\s*(\{[\s\S]*\});?\s*$/);
      if (match) {
        return new Response(match[1], {
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        });
      }
    }
  } catch (e) {}

  return new Response(JSON.stringify({ status: "ready", data_source: "mock" }), {
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
  });
}
