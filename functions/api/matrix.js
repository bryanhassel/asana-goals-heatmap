/**
 * Cloudflare Pages Function: /api/matrix
 * Returns the goals matrix data. Can pull from Cloudflare KV, Asana API, or fallback mock data.
 */

export async function onRequestGet(context) {
  const { env } = context;

  // 1. Check if cached data exists in Cloudflare KV (if bound)
  if (env && env.HEATMAP_KV) {
    const cached = await env.HEATMAP_KV.get("asana_matrix_data", { type: "json" });
    if (cached) {
      return new Response(JSON.stringify(cached), {
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }
  }

  // 2. Fall back to bundled mock data embedded in this function or static
  // This ensures the site works immediately upon deployment even before API credentials are bound!
  const mockUrl = new URL("/mock_data.js", context.request.url);
  try {
    const res = await env.ASSETS.fetch(mockUrl);
    if (res.ok) {
      const text = await res.text();
      // Extract window.EMBEDDED_MOCK_DATA = {...};
      const jsonStr = text.replace(/^window\.EMBEDDED_MOCK_DATA\s*=\s*/, "").replace(/;\s*$/, "");
      return new Response(jsonStr, {
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }
  } catch (e) {
    // Return minimal response if asset fetch fails
  }

  return new Response(JSON.stringify({ status: "ready", data_source: "mock" }), {
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
  });
}
