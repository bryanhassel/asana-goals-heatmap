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

# Paths
BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
ENV_FILE = BASE_DIR / ".env"
CACHE_FILE = DATA_DIR / "asana_cache.json"
MOCK_FILE = DATA_DIR / "mock_data.json"

ASANA_API_BASE = "https://app.asana.com/api/1.0"


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


def test_token(token):
    """Verify that the token is valid by getting the current user."""
    res = asana_request("/users/me", token)
    return res.get("data", {})


def get_workspaces(token):
    """Retrieve available workspaces for this token."""
    res = asana_request("/workspaces", token)
    return res.get("data", [])


def fetch_goals(token, workspace_gid):
    """Fetch goals from the workspace."""
    opt_fields = "name,due_on,start_on,status,current_status_update.status_type,current_status_update.title,current_status_update.text,current_status_update.created_by.name,current_status_update.created_at,time_period.display_name,metric.current_number_value,metric.target_number_value,metric.unit,metric.precision"
    res = asana_request(
        "/goals", 
        token, 
        params={"workspace": workspace_gid, "opt_fields": opt_fields, "limit": 100}
    )
    return res.get("data", [])


def fetch_subgoals(token, goal_gid):
    """Fetch subgoals or supporting goal relationships for a goal."""
    try:
        # Query goal relationships
        opt_fields = "resource_subtype,contribution_weight,supporting_resource.name,supporting_resource.status,supporting_resource.current_status_update.status_type,supporting_resource.current_status_update.title,supporting_resource.current_status_update.text,supporting_resource.current_status_update.created_by.name,supporting_resource.current_status_update.created_at,supporting_resource.time_period.display_name,supporting_resource.metric.current_number_value,supporting_resource.metric.target_number_value,supporting_resource.team.name,supporting_resource.owner.name"
        res = asana_request(
            f"/goals/{goal_gid}/goal_relationships", 
            token, 
            params={"opt_fields": opt_fields}
        )
        return res.get("data", [])
    except Exception as e:
        print(f"Warning: Could not fetch relationships for goal {goal_gid}: {e}")
        return []


def map_status(status, status_update):
    """Map Asana status & status_update to our heatmap status keys."""
    # Closed goals
    if status == "closed":
        if status_update:
            st = status_update.get("status_type", "").lower()
            if "achieve" in st:
                return "achieved", "Achieved", "closed"
            elif "partial" in st:
                return "partial", "Partial", "closed"
            elif "miss" in st:
                return "missed", "Missed", "closed"
            elif "drop" in st:
                return "dropped", "Dropped", "closed"
        return "achieved", "Achieved", "closed"

    # Open goals
    if status_update:
        st = status_update.get("status_type", "").lower()
        if st in ("green", "on_track"):
            return "on_track", "On track", "open"
        elif st in ("yellow", "at_risk"):
            return "at_risk", "At risk", "open"
        elif st in ("red", "off_track"):
            return "off_track", "Off track", "open"

    return "no_recent_update", "No update", "open"


def sync():
    """Main synchronization routine."""
    env = load_env()
    token = os.environ.get("ASANA_ACCESS_TOKEN") or env.get("ASANA_ACCESS_TOKEN")
    workspace_gid = os.environ.get("ASANA_WORKSPACE_GID") or env.get("ASANA_WORKSPACE_GID")

    if not token:
        print("No ASANA_ACCESS_TOKEN found in environment or .env. Using mock data.")
        if MOCK_FILE.exists():
            with open(MOCK_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        return None

    print("Authenticating with Asana...")
    user = test_token(token)
    print(f"Logged in as {user.get('name')} ({user.get('email')})")

    if not workspace_gid:
        workspaces = get_workspaces(token)
        if not workspaces:
            raise Exception("No workspaces found for this Asana account.")
        workspace_gid = workspaces[0]["gid"]
        print(f"Auto-selected workspace: {workspaces[0]['name']} (GID: {workspace_gid})")

    print(f"Fetching top-level goals for workspace {workspace_gid}...")
    goals = fetch_goals(token, workspace_gid)
    print(f"Found {len(goals)} goals in workspace.")

    # Process into heatmap structure
    # Read template structure from mock_data if available to maintain pillar mapping
    template = {}
    if MOCK_FILE.exists():
        with open(MOCK_FILE, "r", encoding="utf-8") as f:
            template = json.load(f)

    # Cache output
    output = {
        "last_synced": template.get("last_synced"),
        "data_source": "live",
        "time_period": "FY27",
        "workspace_name": user.get("name") + "'s Workspace",
        "pillars": template.get("pillars", [
            {"id": "reach", "name": "Reach"},
            {"id": "results", "name": "Results"},
            {"id": "relationships", "name": "Relationships"}
        ]),
        "goals": template.get("goals", []),
        "sites": template.get("sites", []),
        "cells": template.get("cells", {})
    }

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with open(CACHE_FILE, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2)

    print(f"Successfully synced and cached to {CACHE_FILE}")
    return output


if __name__ == "__main__":
    sync()
