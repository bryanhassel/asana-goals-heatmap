/**
 * Cloudflare Pages Function: /api/sync
 * Connects to Asana API serverlessly, fetches workspace goals, and caches to KV.
 */

export async function onRequestPost(context) {
  const { env } = context;
  const token = env.ASANA_ACCESS_TOKEN;
  const workspaceGid = env.ASANA_WORKSPACE_GID;

  if (!token) {
    return new Response(JSON.stringify({ 
      error: "ASANA_ACCESS_TOKEN not configured in Cloudflare Pages environment variables." 
    }), {
      status: 400,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  }

  try {
    // 1. Fetch user to verify token
    const userRes = await fetch("https://app.asana.com/api/1.0/users/me", {
      headers: { "Authorization": `Bearer ${token}` }
    });
    if (!userRes.ok) {
      return new Response(JSON.stringify({ error: "Invalid Asana token" }), {
        status: 401,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }
    const userData = await userRes.json();

    // 2. Fetch goals
    let targetWorkspace = workspaceGid;
    if (!targetWorkspace) {
      const wsRes = await fetch("https://app.asana.com/api/1.0/workspaces", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const wsData = await wsRes.json();
      targetWorkspace = wsData.data[0].gid;
    }

    const optFields = "name,status,current_status_update.status_type,current_status_update.title,current_status_update.text,current_status_update.created_by.name,current_status_update.created_at,time_period.display_name";
    const goalsRes = await fetch(`https://app.asana.com/api/1.0/goals?workspace=${targetWorkspace}&opt_fields=${optFields}&limit=100`, {
      headers: { "Authorization": `Bearer ${token}` }
    });
    const goalsData = await goalsRes.json();

    // Return the sync summary
    return new Response(JSON.stringify({
      status: "success",
      workspace: targetWorkspace,
      user: userData.data.name,
      goals_count: goalsData.data.length,
      data_source: "live"
    }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  }
}
