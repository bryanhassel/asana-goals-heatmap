"""
Asana API Synchronization Utility for Opportunity Culture Goals Heatmap.
Uses only Python standard library (no pip install required).
"""

import os
import json
import urllib.request
import urllib.error
import urllib.parse
from pathlib import Path
from datetime import datetime

# Paths
BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
PUBLIC_DIR = BASE_DIR / "public"
ENV_FILE = BASE_DIR / ".env"
CACHE_FILE = DATA_DIR / "asana_cache.json"
MOCK_FILE = DATA_DIR / "mock_data.json"
CACHE_JSON_PUBLIC = PUBLIC_DIR / "matrix_cache.json"
MOCK_JS_PUBLIC = PUBLIC_DIR / "mock_data.js"

ASANA_API_BASE = "https://app.asana.com/api/1.0"

PARENT_GOALS = [
    {"gid": "1217867349410702", "name": "Reach: 90% of districts commit to reaching 75-100% schools", "short_name": "District Commitment (75-100%)", "pillar": "reach", "pillar_id": "reach", "target": "90%", "order": 1},
    {"gid": "1217171254793815", "name": "Reach: 50% of Y3+ schools have a specific staffing, $, and hiring plan to reach 75-100% of students in ‘27-28 (on track for Level 2+)", "short_name": "Y3+ Staffing & $ Plan", "pillar": "reach", "pillar_id": "reach", "target": "50%", "order": 2},
    {"gid": "1217171254793775", "name": "Results: 500+ schools are certified at any level", "short_name": "Certified Schools", "pillar": "results", "pillar_id": "results", "target": "500+", "order": 3},
    {"gid": "1217867349410715", "name": "Results: MCL Protected Time - 20% increase of implementing certified schools are at level 2+", "short_name": "MCL Protected Time", "pillar": "results", "pillar_id": "results", "target": "+20%", "order": 4},
    {"gid": "1217867349410712", "name": "Results: Tutoring - 20% increase of implementing certified schools are at level 2+", "short_name": "Tutoring L2+", "pillar": "results", "pillar_id": "results", "target": "+20%", "order": 5},
    {"gid": "1217867349410709", "name": "Results: Team Reach - 20% increase of implementing certified schools are at level 2+", "short_name": "Team Reach L2+", "pillar": "results", "pillar_id": "results", "target": "+20%", "order": 6},
    {"gid": "1217867349410706", "name": "Results: MCL Reach - 20% increase of implementing certified schools are at level 2+", "short_name": "MCL Reach L2+", "pillar": "results", "pillar_id": "results", "target": "+20%", "order": 7},
    {"gid": "1217171254793813", "name": "Relationships: 2 written reports, 2 conversations, and 2 information touchpoints with Superintendent Reports", "short_name": "Supe Reports & Touchpoints", "pillar": "relationships", "pillar_id": "relationships", "target": "2x2x2", "order": 8},
    {"gid": "1217171254793809", "name": "Relationships: Client Net Promotor Score \"OC\": 60+", "short_name": "Client NPS \"OC\"", "pillar": "relationships", "pillar_id": "relationships", "target": "60+", "order": 9},
    {"gid": "1217171254793807", "name": "Relationships: Client Net Promotor Score \"PI\": 50+", "short_name": "Client NPS \"PI\"", "pillar": "relationships", "pillar_id": "relationships", "target": "50+", "order": 10},
    {"gid": "1217171254793811", "name": "Relationships: MCL Net Promotor Score \"OC\": 60+", "short_name": "MCL NPS \"OC\"", "pillar": "relationships", "pillar_id": "relationships", "target": "60+", "order": 11},
    {"gid": "1217867349410718", "name": "Relationships: Client Net Promotor Score \"Portal\": 45+", "short_name": "Client NPS \"Portal\"", "pillar": "relationships", "pillar_id": "relationships", "target": "45+", "order": 12}
]

PILLARS = [
    {"id": "reach", "name": "Reach", "description": "Scaling Opportunity Culture models across schools and students.", "icon": "users", "goal_count": 2},
    {"id": "results", "name": "Results", "description": "Achieving certification, MCL protected time, tutoring, and educator impact.", "icon": "target", "goal_count": 5},
    {"id": "relationships", "name": "Relationships", "description": "Fostering partner communication, client NPS, and stakeholder satisfaction.", "icon": "heart-handshake", "goal_count": 5}
]


def load_env():
    """Load simple key=value pairs from .env file if it exists."""
    env_vars = {}
    if ENV_FILE.exists():
        with open(ENV_FILE, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, val = line.split("=", 1)
                    env_vars[key.strip()] = val.strip().strip('"').strip("'")
    return env_vars


def asana_request(endpoint, token, params=None):
    """Perform an authenticated GET request to Asana API."""
    url = f"{ASANA_API_BASE}{endpoint}"
    if params:
        url += "?" + urllib.parse.urlencode(params)
    
    req = urllib.request.Request(
        url,
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/json"
        }
    )
    
    try:
        with urllib.request.urlopen(req) as response:
            if response.status in (200, 201):
                return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        error_msg = e.read().decode("utf-8")
        print(f"HTTPError {e.code} on {endpoint}: {error_msg}")
        raise
    except Exception as e:
        print(f"Error requesting {endpoint}: {e}")
        raise


def map_status(status, status_update):
    """Map Asana status & status_update to our heatmap status keys."""
    st = ""
    if status_update and status_update.get("status_type"):
        st = status_update["status_type"].lower()
    elif status:
        st = status.lower()

    if "achieve" in st:
        return "achieved", "Achieved", "closed"
    elif "partial" in st:
        return "partial", "Partial", "closed"
    elif "miss" in st:
        return "missed", "Missed", "closed"
    elif "drop" in st:
        return "dropped", "Dropped", "closed"

    if st in ("green", "on_track"):
        return "on_track", "On track", "open"
    elif st in ("yellow", "at_risk"):
        return "at_risk", "At risk", "open"
    elif st in ("red", "off_track"):
        return "off_track", "Off track", "open"

    return "no_recent_update", "No update", "open"


def infer_region(site_name):
    s = site_name.lower()
    if "(nc)" in s or "north carolina" in s or "carolina" in s:
        return "North Carolina"
    elif "isd" in s or "texas" in s or "ctor" in s or "midland" in s or "manor" in s:
        return "Texas"
    elif "new mexico" in s or "espanola" in s or "carlsbad" in s or "monte del sol" in s:
        return "New Mexico"
    elif "oklahoma" in s or "hulbert" in s or "harding" in s or "millwood" in s or "berryhill" in s:
        return "Oklahoma"
    elif "baltimore" in s or "maryland" in s:
        return "Maryland"
    elif "philadelphia" in s or "pennsylvania" in s:
        return "Pennsylvania"
    elif "jackson" in s:
        return "Mississippi"
    return "National"


def sync():
    """Main synchronization routine."""
    env = load_env()
    token = os.environ.get("ASANA_ACCESS_TOKEN") or env.get("ASANA_ACCESS_TOKEN")

    if not token:
        print("No ASANA_ACCESS_TOKEN found. Using local cache.")
        if CACHE_FILE.exists():
            with open(CACHE_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        return None

    print("Authenticating with Asana...")
    user_res = asana_request("/users/me", token)
    user_data = user_res.get("data", {})
    user_name = user_data.get("name", "User")
    print(f"Logged in as {user_name} ({user_data.get('email')})")

    opt_fields = (
        "resource_subtype,contribution_weight,"
        "supporting_resource.name,supporting_resource.status,"
        "supporting_resource.team.gid,supporting_resource.team.name,"
        "supporting_resource.owner.name,"
        "supporting_resource.current_status_update.status_type,"
        "supporting_resource.current_status_update.title,"
        "supporting_resource.current_status_update.text,"
        "supporting_resource.current_status_update.created_by.name,"
        "supporting_resource.current_status_update.created_at,"
        "supporting_resource.metric.current_number_value,"
        "supporting_resource.metric.target_number_value"
    )

    sites_dict = {}
    cells_dict = {}

    print("Fetching subgoals across 12 consulting team goals...")
    for parent in PARENT_GOALS:
        p_gid = parent["gid"]
        try:
            res = asana_request(
                "/goal_relationships",
                token,
                params={"supported_goal": p_gid, "opt_fields": opt_fields}
            )
            rels = res.get("data", [])
            print(f"  * {parent['short_name']:<30} -> {len(rels)} site subgoals")
        except Exception as e:
            print(f"  * Failed to fetch subgoals for {parent['short_name']}: {e}")
            rels = []

        for rel in rels:
            sub = rel.get("supporting_resource")
            if not sub or not sub.get("team") or not sub.get("team", {}).get("name"):
                continue

            site_id = sub["team"]["gid"]
            site_name = sub["team"]["name"].strip()

            if site_name in ("OC Consulting Team", "Specialty Teams", "Exec Team", "All OC Team (not comms or admin)"):
                continue

            if site_id not in sites_dict:
                sites_dict[site_id] = {
                    "id": site_id,
                    "name": site_name,
                    "region": infer_region(site_name),
                    "cohort": "FY27"
                }

            status_key, status_label, group = map_status(sub.get("status"), sub.get("current_status_update"))
            update = sub.get("current_status_update")

            progress_pct = None
            if sub.get("metric") and sub["metric"].get("current_number_value") is not None and sub["metric"].get("target_number_value"):
                progress_pct = min(100, round((sub["metric"]["current_number_value"] / sub["metric"]["target_number_value"]) * 100))

            cell_key = f"{site_id}::{p_gid}"
            cells_dict[cell_key] = {
                "goal_gid": p_gid,
                "subgoal_gid": sub.get("gid"),
                "site_id": site_id,
                "site_name": site_name,
                "status_key": status_key,
                "status_label": status_label,
                "group": group,
                "progress_pct": progress_pct,
                "notes": update.get("text", "") if update else "",
                "status_title": update.get("title", "") if update else "",
                "last_update_date": update.get("created_at", "")[:10] if update else "",
                "author": update.get("created_by", {}).get("name", "") if update else (sub.get("owner", {}).get("name", "") if sub.get("owner") else ""),
                "asana_url": f"https://app.asana.com/0/0/{sub.get('gid')}"
            }

    sorted_sites = sorted(sites_dict.values(), key=lambda s: s["name"].lower())

    try:
        from zoneinfo import ZoneInfo
        now_et = datetime.now(ZoneInfo("America/New_York"))
    except Exception:
        now_et = datetime.now()
    now_str = now_et.strftime("%b %d, %Y at %I:%M %p ET")

    output = {
        "last_synced": now_str,
        "data_source": "live",
        "time_period": "FY27",
        "workspace_name": "Public Impact",
        "user_name": user_name,
        "pillars": PILLARS,
        "goals": PARENT_GOALS,
        "sites": sorted_sites,
        "cells": cells_dict
    }

    # Save to data/asana_cache.json
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with open(CACHE_FILE, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2)

    # Save to public/matrix_cache.json
    PUBLIC_DIR.mkdir(parents=True, exist_ok=True)
    with open(CACHE_JSON_PUBLIC, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2)

    # Save to public/mock_data.js
    with open(MOCK_JS_PUBLIC, "w", encoding="utf-8") as f:
        f.write(f"// Standalone live cache export generated at {now_str}\n")
        f.write("window.EMBEDDED_MOCK_DATA = ")
        json.dump(output, f, indent=2)
        f.write(";\n")

    print(f"Successfully synced {len(sorted_sites)} school systems and {len(cells_dict)} cells from Asana.")
    return output


if __name__ == "__main__":
    sync()
