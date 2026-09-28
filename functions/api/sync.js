/**
 * Cloudflare Pages Function: /api/sync
 * Connects to Asana API serverlessly, fetches all 12 consulting team goals and site subgoals,
 * maps live statuses, notes, and authors, and returns the full heatmap matrix data.
 */

const PARENT_GOALS = [
  { gid: "1217867349410702", name: "Reach: 90% of districts commit to reaching 75-100% schools", short_name: "District Commitment (75-100%)", pillar: "reach", pillar_id: "reach", target: "90%", order: 1 },
  { gid: "1217171254793815", name: "Reach: 50% of Y3+ schools have a specific staffing, $, and hiring plan to reach 75-100% of students in ‘27-28 (on track for Level 2+)", short_name: "Y3+ Staffing & $ Plan", pillar: "reach", pillar_id: "reach", target: "50%", order: 2 },
  { gid: "1217171254793775", name: "Results: 500+ schools are certified at any level", short_name: "Certified Schools", pillar: "results", pillar_id: "results", target: "500+", order: 3 },
  { gid: "1217867349410715", name: "Results: MCL Protected Time - 20% increase of implementing certified schools are at level 2+", short_name: "MCL Protected Time", pillar: "results", pillar_id: "results", target: "+20%", order: 4 },
  { gid: "1217867349410712", name: "Results: Tutoring - 20% increase of implementing certified schools are at level 2+", short_name: "Tutoring L2+", pillar: "results", pillar_id: "results", target: "+20%", order: 5 },
  { gid: "1217867349410709", name: "Results: Team Reach - 20% increase of implementing certified schools are at level 2+", short_name: "Team Reach L2+", pillar: "results", pillar_id: "results", target: "+20%", order: 6 },
  { gid: "1217867349410706", name: "Results: MCL Reach - 20% increase of implementing certified schools are at level 2+", short_name: "MCL Reach L2+", pillar: "results", pillar_id: "results", target: "+20%", order: 7 },
  { gid: "1217171254793813", name: "Relationships: 2 written reports, 2 conversations, and 2 information touchpoints with Superintendent Reports", short_name: "Supe Reports & Touchpoints", pillar: "relationships", pillar_id: "relationships", target: "2x2x2", order: 8 },
  { gid: "1217171254793809", name: "Relationships: Client Net Promotor Score \"OC\": 60+", short_name: "Client NPS \"OC\"", pillar: "relationships", pillar_id: "relationships", target: "60+", order: 9 },
  { gid: "1217171254793807", name: "Relationships: Client Net Promotor Score \"PI\": 50+", short_name: "Client NPS \"PI\"", pillar: "relationships", pillar_id: "relationships", target: "50+", order: 10 },
  { gid: "1217171254793811", name: "Relationships: MCL Net Promotor Score \"OC\": 60+", short_name: "MCL NPS \"OC\"", pillar: "relationships", pillar_id: "relationships", target: "60+", order: 11 },
  { gid: "1217867349410718", name: "Relationships: Client Net Promotor Score \"Portal\": 45+", short_name: "Client NPS \"Portal\"", pillar: "relationships", pillar_id: "relationships", target: "45+", order: 12 }
];

const PILLARS = [
  { id: "reach", name: "Reach", description: "Scaling Opportunity Culture models across schools and students.", icon: "users", goal_count: 2 },
  { id: "results", name: "Results", description: "Achieving certification, MCL protected time, tutoring, and educator impact.", icon: "target", goal_count: 5 },
  { id: "relationships", name: "Relationships", description: "Fostering partner communication, client NPS, and stakeholder satisfaction.", icon: "heart-handshake", goal_count: 5 }
];

function mapStatus(status, update) {
  let st = "";
  if (update && update.status_type) {
    st = update.status_type.toLowerCase();
  } else if (status) {
    st = status.toLowerCase();
  }

  if (st.includes("achieve")) return ["achieved", "Achieved", "closed"];
  if (st.includes("partial")) return ["partial", "Partial", "closed"];
  if (st.includes("miss")) return ["missed", "Missed", "closed"];
  if (st.includes("drop")) return ["dropped", "Dropped", "closed"];

  if (st === "green" || st === "on_track") return ["on_track", "On track", "open"];
  if (st === "yellow" || st === "at_risk") return ["at_risk", "At risk", "open"];
  if (st === "red" || st === "off_track") return ["off_track", "Off track", "open"];

  return ["no_recent_update", "No update", "open"];
}

function inferRegion(siteName) {
  const s = siteName.toLowerCase();
  if (s.includes("(nc)") || s.includes("north carolina") || s.includes("carolina")) return "North Carolina";
  if (s.includes("isd") || s.includes("texas") || s.includes("ctor") || s.includes("midland") || s.includes("manor")) return "Texas";
  if (s.includes("new mexico") || s.includes("espanola") || s.includes("carlsbad") || s.includes("monte del sol")) return "New Mexico";
  if (s.includes("oklahoma") || s.includes("hulbert") || s.includes("harding") || s.includes("millwood") || s.includes("berryhill")) return "Oklahoma";
  if (s.includes("baltimore") || s.includes("maryland")) return "Maryland";
  if (s.includes("philadelphia") || s.includes("pennsylvania")) return "Pennsylvania";
  if (s.includes("jackson")) return "Mississippi";
  return "National";
}

export async function onRequestPost(context) {
  const { env } = context;
  const token = env.ASANA_ACCESS_TOKEN;

  if (!token) {
    return new Response(JSON.stringify({ 
      error: "ASANA_ACCESS_TOKEN not configured in Cloudflare Pages environment variables." 
    }), {
      status: 400,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  }

  try {
    // 1. Verify token & get user name
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
    const userName = userData.data.name;

    const optFields = [
      "resource_subtype", "contribution_weight",
      "supporting_resource.name", "supporting_resource.status",
      "supporting_resource.team.gid", "supporting_resource.team.name",
      "supporting_resource.owner.name",
      "supporting_resource.current_status_update.status_type",
      "supporting_resource.current_status_update.title",
      "supporting_resource.current_status_update.text",
      "supporting_resource.current_status_update.created_by.name",
      "supporting_resource.current_status_update.created_at",
      "supporting_resource.metric.current_number_value",
      "supporting_resource.metric.target_number_value"
    ].join(",");

    const sitesDict = {};
    const cellsDict = {};

    // 2. Query all 12 parent goal relationships in parallel
    const promises = PARENT_GOALS.map(async (parent) => {
      const url = `https://app.asana.com/api/1.0/goal_relationships?supported_goal=${parent.gid}&opt_fields=${optFields}`;
      const res = await fetch(url, { headers: { "Authorization": `Bearer ${token}` } });
      if (!res.ok) return { parent, rels: [] };
      const json = await res.json();
      return { parent, rels: json.data || [] };
    });

    const results = await Promise.all(promises);

    for (const { parent, rels } of results) {
      for (const rel of rels) {
        const sub = rel.supporting_resource;
        if (!sub || !sub.team || !sub.team.name) continue;

        const siteId = sub.team.gid;
        const siteName = sub.team.name.trim();

        if (["OC Consulting Team", "Specialty Teams", "Exec Team", "All OC Team (not comms or admin)"].includes(siteName)) {
          continue;
        }

        if (!sitesDict[siteId]) {
          sitesDict[siteId] = {
            id: siteId,
            name: siteName,
            region: inferRegion(siteName),
            cohort: "FY27"
          };
        }

        const [statusKey, statusLabel, group] = mapStatus(sub.status, sub.current_status_update);
        const update = sub.current_status_update;

        let progressPct = null;
        if (sub.metric && sub.metric.current_number_value !== null && sub.metric.target_number_value) {
          progressPct = Math.min(100, Math.round((sub.metric.current_number_value / sub.metric.target_number_value) * 100));
        }

        const cellKey = `${siteId}::${parent.gid}`;
        cellsDict[cellKey] = {
          goal_gid: parent.gid,
          subgoal_gid: sub.gid,
          site_id: siteId,
          site_name: siteName,
          status_key: statusKey,
          status_label: statusLabel,
          group: group,
          progress_pct: progressPct,
          notes: update ? update.text || "" : "",
          status_title: update ? update.title || "" : "",
          last_update_date: update && update.created_at ? update.created_at.substring(0, 10) : "",
          author: update && update.created_by ? update.created_by.name : (sub.owner ? sub.owner.name : ""),
          asana_url: `https://app.asana.com/0/0/${sub.gid}`
        };
      }
    }

    const sortedSites = Object.values(sitesDict).sort((a, b) => a.name.localeCompare(b.name));
    const nowStr = new Date().toLocaleString("en-US", { 
      timeZone: "America/New_York",
      month: "short", 
      day: "numeric", 
      year: "numeric", 
      hour: "numeric", 
      minute: "2-digit",
      hour12: true 
    }) + " ET";

    const matrixData = {
      last_synced: nowStr,
      data_source: "live",
      time_period: "FY27",
      workspace_name: "Public Impact",
      user_name: userName,
      pillars: PILLARS,
      goals: PARENT_GOALS,
      sites: sortedSites,
      cells: cellsDict
    };

    return new Response(JSON.stringify(matrixData), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  }
}
