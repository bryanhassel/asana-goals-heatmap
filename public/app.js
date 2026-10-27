/**
 * Opportunity Culture - Asana Goals Heatmap Application
 */

// Application State
const state = {
  data: null,
  activePillar: 'all',
  activeStatusFilter: 'all',
  hideNonMatchingSites: true,
  searchQuery: '',
  sortBy: 'name_asc',
  selectedCell: null,
  showFullGoalNames: false,
};

// Status Configurations matching user specifications
const STATUS_CONFIG = {
  on_track: {
    key: 'on_track',
    label: 'On track',
    group: 'open',
    cellClass: 'bg-emerald-100 text-emerald-950 border-emerald-300 hover:bg-emerald-200',
    badgeClass: 'bg-emerald-100 text-emerald-900 border border-emerald-300',
    barColor: '#86efac',
    isHealthy: true,
    sortWeight: 2,
    icon: 'play'
  },
  at_risk: {
    key: 'at_risk',
    label: 'At risk',
    group: 'open',
    cellClass: 'bg-amber-100 text-amber-950 border-amber-300 hover:bg-amber-200',
    badgeClass: 'bg-amber-100 text-amber-950 border border-amber-300',
    barColor: '#fde047',
    isHealthy: false,
    sortWeight: 3,
    icon: 'alert-triangle'
  },
  off_track: {
    key: 'off_track',
    label: 'Off track',
    group: 'open',
    cellClass: 'bg-rose-100 text-rose-950 border-rose-300 hover:bg-rose-200',
    badgeClass: 'bg-rose-100 text-rose-950 border border-rose-300',
    barColor: '#fca5a5',
    isHealthy: false,
    sortWeight: 4,
    icon: 'alert-circle'
  },
  no_recent_update: {
    key: 'no_recent_update',
    label: 'No update',
    group: 'open',
    cellClass: 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200',
    badgeClass: 'bg-slate-100 text-slate-700 border border-slate-300',
    barColor: '#cbd5e1',
    isHealthy: false,
    sortWeight: 5,
    icon: 'clock'
  },
  achieved: {
    key: 'achieved',
    label: 'Achieved',
    group: 'closed',
    cellClass: 'bg-emerald-700 text-white font-semibold border-emerald-800 hover:bg-emerald-800 shadow-xs',
    badgeClass: 'bg-emerald-700 text-white border border-emerald-800',
    barColor: '#15803d',
    isHealthy: true,
    sortWeight: 1,
    icon: 'check'
  },
  partial: {
    key: 'partial',
    label: 'Partial',
    group: 'closed',
    cellClass: 'bg-amber-700 text-white font-semibold border-amber-800 hover:bg-amber-800 shadow-xs',
    badgeClass: 'bg-amber-700 text-white border border-amber-800',
    barColor: '#b45309',
    isHealthy: false,
    sortWeight: 6,
    icon: 'minus'
  },
  missed: {
    key: 'missed',
    label: 'Missed',
    group: 'closed',
    cellClass: 'bg-rose-700 text-white font-semibold border-rose-800 hover:bg-rose-800 shadow-xs',
    badgeClass: 'bg-rose-700 text-white border border-rose-800',
    barColor: '#b91c1c',
    isHealthy: false,
    sortWeight: 7,
    icon: 'x'
  },
  dropped: {
    key: 'dropped',
    label: 'Dropped',
    group: 'closed',
    cellClass: 'bg-slate-600 text-white font-semibold border-slate-700 hover:bg-slate-700 shadow-xs',
    badgeClass: 'bg-slate-600 text-white border border-slate-700',
    barColor: '#4b5563',
    isHealthy: false,
    sortWeight: 8,
    icon: 'slash'
  },
  not_set: {
    key: 'not_set',
    label: '—',
    group: 'none',
    cellClass: 'bg-slate-50 text-slate-400 border-dashed border-slate-200 hover:bg-slate-100',
    badgeClass: 'bg-slate-50 text-slate-400 border border-slate-200',
    barColor: '#e2e8f0',
    isHealthy: false,
    sortWeight: 9,
    icon: 'minus'
  }
};

// Initialize Application
document.addEventListener('DOMContentLoaded', async () => {
  await loadMatrixData();
  setupEventListeners();
  if (window.lucide) {
    window.lucide.createIcons();
  }
  // Automatically sync with Asana in background on initial page load
  triggerAsanaSync({ silent: true });
});

/**
 * Load Matrix Data from API or fall back to bundled mock data
 */
async function loadMatrixData() {
  try {
    // Attempt to fetch from API endpoint (served by Python server or Cloudflare Function)
    const response = await fetch('/api/matrix');
    if (response.ok) {
      state.data = await response.json();
    } else {
      throw new Error('API unavailable');
    }
  } catch (err) {
    // Fall back to bundled mock data
    if (window.EMBEDDED_MOCK_DATA) {
      state.data = JSON.parse(JSON.stringify(window.EMBEDDED_MOCK_DATA));
    } else {
      console.error('Failed to load matrix data', err);
      return;
    }
  }

  // Populate data source badge & headers
  updateHeaderMeta();
  renderApp();
}

/**
 * Update Header and KPI Metadata
 */
function updateHeaderMeta() {
  const badge = document.getElementById('data-source-badge');
  const period = document.getElementById('time-period-label');
  const lastSync = document.getElementById('last-synced-label');

  if (state.data.data_source === 'live') {
    badge.className = 'inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200';
    badge.innerHTML = '<span class="w-1.5 h-1.5 mr-1 rounded-full bg-emerald-500"></span>Live Asana';
  } else {
    badge.className = 'inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200';
    badge.innerHTML = '<span class="w-1.5 h-1.5 mr-1 rounded-full bg-amber-500 animate-pulse"></span>Demo (Mock Data)';
  }

  if (period) period.textContent = state.data.time_period || 'FY27';
  if (lastSync && state.data.last_synced) {
    const raw = String(state.data.last_synced).trim();
    if (raw.includes('ET')) {
      lastSync.textContent = 'Updated ' + raw;
    } else {
      const d = new Date(raw);
      if (!isNaN(d.getTime())) {
        const timeStr = d.toLocaleTimeString('en-US', {
          timeZone: 'America/New_York',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        });
        lastSync.textContent = `Updated Today at ${timeStr} ET`;
      } else {
        lastSync.textContent = `Updated ${raw} ET`;
      }
    }
  }
}

/**
 * Filter Goals based on Active Pillar
 */
function getVisibleGoals() {
  if (!state.data || !state.data.goals) return [];
  if (state.activePillar === 'all') return state.data.goals;
  return state.data.goals.filter(g => g.pillar_id === state.activePillar);
}

/**
 * Filter and Sort Sites
 */
function getFilteredAndSortedSites() {
  if (!state.data || !state.data.sites) return [];
  let sites = [...state.data.sites];

  // 1. Text Search Filter (name, region, cohort)
  if (state.searchQuery.trim()) {
    const q = state.searchQuery.toLowerCase().trim();
    sites = sites.filter(s => 
      s.name.toLowerCase().includes(q) ||
      (s.region && s.region.toLowerCase().includes(q)) ||
      (s.cohort && s.cohort.toLowerCase().includes(q))
    );
  }

  // Calculate Health % for each site
  const visibleGoals = getVisibleGoals();
  sites.forEach(s => {
    let healthyCount = 0;
    let totalAssigned = 0;
    visibleGoals.forEach(g => {
      const cellKey = `${s.id}::${g.gid}`;
      const cell = state.data.cells[cellKey];
      if (cell) {
        totalAssigned++;
        const conf = STATUS_CONFIG[cell.status_key] || STATUS_CONFIG.not_set;
        if (conf.isHealthy) healthyCount++;
      }
    });
    s.healthPct = totalAssigned > 0 ? Math.round((healthyCount / totalAssigned) * 100) : 0;
    s.healthyCount = healthyCount;
    s.totalAssigned = totalAssigned;
  });

  // 2. Status Filter
  if (state.activeStatusFilter !== 'all' && state.hideNonMatchingSites) {
    sites = sites.filter(s => {
      return visibleGoals.some(g => {
        const cell = state.data.cells[`${s.id}::${g.gid}`];
        if (!cell) return state.activeStatusFilter === 'not_set';
        if (state.activeStatusFilter === 'attention') {
          return cell.status_key === 'at_risk' || cell.status_key === 'off_track';
        }
        return cell.status_key === state.activeStatusFilter;
      });
    });
  }

  // 3. Sorting
  sites.sort((a, b) => {
    if (state.sortBy === 'name_asc') return a.name.localeCompare(b.name);
    if (state.sortBy === 'name_desc') return b.name.localeCompare(a.name);
    if (state.sortBy === 'health_desc') return b.healthPct - a.healthPct;
    if (state.sortBy === 'health_asc') return a.healthPct - b.healthPct;
    return 0;
  });

  return sites;
}

/**
 * Main Render Pipeline
 */
function renderApp() {
  renderKPIs();
  renderLegendCounts();
  renderFilterBanner();
  renderHeatmap();
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

/**
 * Render Top KPI Cards
 */
function renderKPIs() {
  const visibleSites = getFilteredAndSortedSites();
  const visibleGoals = getVisibleGoals();

  let totalCells = 0;
  let healthyCells = 0;
  let achievedCount = 0;
  let needsAttentionCount = 0;
  let noUpdateCount = 0;

  visibleSites.forEach(site => {
    visibleGoals.forEach(goal => {
      const cell = state.data.cells[`${site.id}::${goal.gid}`];
      if (cell) {
        totalCells++;
        const conf = STATUS_CONFIG[cell.status_key];
        if (conf && conf.isHealthy) healthyCells++;
        if (cell.status_key === 'achieved') achievedCount++;
        if (cell.status_key === 'at_risk' || cell.status_key === 'off_track') needsAttentionCount++;
        if (cell.status_key === 'no_recent_update') noUpdateCount++;
      }
    });
  });

  const overallHealth = totalCells > 0 ? Math.round((healthyCells / totalCells) * 100) : 0;

  document.getElementById('kpi-total-sites').textContent = visibleSites.length;
  document.getElementById('kpi-total-goals').textContent = visibleGoals.length;
  document.getElementById('kpi-overall-health').textContent = `${overallHealth}%`;
  document.getElementById('kpi-achieved-count').textContent = achievedCount;
  document.getElementById('kpi-needs-attention').textContent = needsAttentionCount;
  document.getElementById('kpi-no-update-count').textContent = noUpdateCount;
  document.getElementById('site-count-indicator').textContent = `Showing ${visibleSites.length} of ${state.data.sites.length} sites`;
}

/**
 * Render Status Counts in the Interactive Legend
 */
function renderLegendCounts() {
  const visibleSites = getFilteredAndSortedSites();
  const visibleGoals = getVisibleGoals();

  const counts = {
    on_track: 0,
    at_risk: 0,
    off_track: 0,
    no_recent_update: 0,
    achieved: 0,
    partial: 0,
    missed: 0,
    dropped: 0
  };

  visibleSites.forEach(s => {
    visibleGoals.forEach(g => {
      const cell = state.data.cells[`${s.id}::${g.gid}`];
      if (cell && counts.hasOwnProperty(cell.status_key)) {
        counts[cell.status_key]++;
      }
    });
  });

  Object.keys(counts).forEach(key => {
    const el = document.getElementById(`count-${key}`);
    if (el) el.textContent = counts[key];
  });

  // Highlight active legend chip
  const legendChips = document.querySelectorAll('.legend-chip');
  legendChips.forEach(chip => {
    const statusKey = chip.getAttribute('data-legend-status');
    if (state.activeStatusFilter === statusKey) {
      chip.classList.add('ring-2', 'ring-indigo-600', 'ring-offset-1', 'font-bold', 'scale-105');
    } else {
      chip.classList.remove('ring-2', 'ring-indigo-600', 'ring-offset-1', 'font-bold', 'scale-105');
    }
  });
}

/**
 * Render Active Filter Notification Banner
 */
function renderFilterBanner() {
  const banner = document.getElementById('filter-banner');
  if (!banner) return;

  if (state.activeStatusFilter === 'all') {
    banner.classList.add('hidden');
    return;
  }

  banner.classList.remove('hidden');
  const bannerText = document.getElementById('filter-banner-text');

  let filterLabel = '';
  if (state.activeStatusFilter === 'attention') {
    filterLabel = 'Needs Attention (At Risk & Off Track)';
  } else if (STATUS_CONFIG[state.activeStatusFilter]) {
    filterLabel = `${STATUS_CONFIG[state.activeStatusFilter].group === 'closed' ? 'Closed: ' : 'Open: '}${STATUS_CONFIG[state.activeStatusFilter].label}`;
  } else {
    filterLabel = state.activeStatusFilter;
  }

  const visibleGoals = getVisibleGoals();
  const allSites = state.data && state.data.sites ? state.data.sites : [];
  let matchCount = 0;
  let matchingSitesCount = 0;

  allSites.forEach(s => {
    let siteHasMatch = false;
    visibleGoals.forEach(g => {
      const cell = state.data.cells[`${s.id}::${g.gid}`];
      let matches = false;
      if (state.activeStatusFilter === 'attention') {
        matches = cell && (cell.status_key === 'at_risk' || cell.status_key === 'off_track');
      } else {
        matches = cell && cell.status_key === state.activeStatusFilter;
      }
      if (matches) {
        matchCount++;
        siteHasMatch = true;
      }
    });
    if (siteHasMatch) matchingSitesCount++;
  });

  bannerText.innerHTML = `<strong>${filterLabel}</strong> &bull; Found <strong>${matchCount}</strong> matching goals across <strong>${matchingSitesCount}</strong> school systems`;
}

/**
 * Render Heatmap Matrix Table
 */
function renderHeatmap() {
  const visibleGoals = getVisibleGoals();
  const visibleSites = getFilteredAndSortedSites();

  // 1. Render Header Row 1 (Pillars)
  renderPillarHeaderRow(visibleGoals);

  // 2. Render Header Row 2 (Goal Columns)
  renderGoalHeaderRow(visibleGoals);

  // 3. Render Header Row 3 (Column Health Summaries)
  renderColumnSummaryRow(visibleGoals, visibleSites);

  // 4. Render Body Rows (Sites & Cells)
  renderTableBody(visibleGoals, visibleSites);

  // 5. Dynamically align sticky header heights
  adjustStickyHeaderHeights();

  // 6. Synchronize top horizontal scrollbar
  updateTopScrollbar();
  requestAnimationFrame(() => updateTopScrollbar());
}

/**
 * Dynamically align sticky header rows 1, 2, and 3
 */
function adjustStickyHeaderHeights() {
  const row1 = document.querySelector('.sticky-header-row-1');
  const row2 = document.querySelector('.sticky-header-row-2');
  const row3 = document.querySelector('.sticky-header-row-3');
  if (row1 && row2 && row3) {
    const row1Height = row1.offsetHeight;
    row2.style.top = `${row1Height}px`;
    const row2Height = row2.offsetHeight;
    row3.style.top = `${row1Height + row2Height}px`;
  }
}

let activeScroller = null;
let syncTimeout = null;
let topScrollbarInitialized = false;

/**
 * Initialize Two-Way Scroll Synchronization between Top Scrollbar and Table Container
 */
function initTopScrollbar() {
  if (topScrollbarInitialized) return;
  topScrollbarInitialized = true;

  const topScrollbar = document.getElementById('top-scrollbar-container');
  const tableContainer = document.querySelector('.table-container');

  if (!topScrollbar || !tableContainer) return;

  // Scroll listener for Top Scrollbar
  topScrollbar.addEventListener('scroll', () => {
    if (activeScroller === 'table') return;
    activeScroller = 'top';
    tableContainer.scrollLeft = topScrollbar.scrollLeft;
    clearTimeout(syncTimeout);
    syncTimeout = setTimeout(() => {
      activeScroller = null;
    }, 50);
  }, { passive: true });

  // Scroll listener for Table Container (bottom scrollbar, trackpad, touch swipe, shift+wheel)
  tableContainer.addEventListener('scroll', () => {
    if (activeScroller === 'top') return;
    if (topScrollbar.scrollLeft !== tableContainer.scrollLeft) {
      activeScroller = 'table';
      topScrollbar.scrollLeft = tableContainer.scrollLeft;
      clearTimeout(syncTimeout);
      syncTimeout = setTimeout(() => {
        activeScroller = null;
      }, 50);
    }
  }, { passive: true });

  // ResizeObserver to automatically update width if table or container dimensions change
  if (window.ResizeObserver) {
    const ro = new ResizeObserver(() => {
      updateTopScrollbar();
    });
    ro.observe(tableContainer);
    const tableEl = document.getElementById('heatmap-table');
    if (tableEl) {
      ro.observe(tableEl);
    }
  }

  // Initial sync
  updateTopScrollbar();
}

/**
 * Update Top Scrollbar width, margin compensation, and visibility
 */
function updateTopScrollbar() {
  const topScrollbar = document.getElementById('top-scrollbar-container');
  const topContent = document.getElementById('top-scrollbar-content');
  const tableContainer = document.querySelector('.table-container');

  if (!topScrollbar || !topContent || !tableContainer) return;

  const scrollWidth = tableContainer.scrollWidth;
  const clientWidth = tableContainer.clientWidth;
  const hasHorizontalScroll = scrollWidth > clientWidth + 2;

  if (!hasHorizontalScroll) {
    topScrollbar.classList.add('hidden');
    topScrollbar.style.display = 'none';
    return;
  }

  topScrollbar.classList.remove('hidden');
  topScrollbar.style.display = 'block';

  // Set dummy content width to exactly match tableContainer's scrollWidth
  topContent.style.width = `${scrollWidth}px`;

  // Compensate for vertical scrollbar width so top track length matches tableContainer track length
  const verticalScrollbarWidth = Math.max(0, tableContainer.offsetWidth - clientWidth);
  topScrollbar.style.marginRight = verticalScrollbarWidth > 0 ? `${verticalScrollbarWidth}px` : '0px';

  // Ensure scrollLeft is in sync
  if (topScrollbar.scrollLeft !== tableContainer.scrollLeft) {
    topScrollbar.scrollLeft = tableContainer.scrollLeft;
  }
}

/**
 * Header Row 1: Grouping by Pillars
 */
function renderPillarHeaderRow(visibleGoals) {
  const reachSpan = document.getElementById('pillar-span-reach');
  const resultsSpan = document.getElementById('pillar-span-results');
  const relSpan = document.getElementById('pillar-span-relationships');

  const reachCount = visibleGoals.filter(g => g.pillar_id === 'reach').length;
  const resultsCount = visibleGoals.filter(g => g.pillar_id === 'results').length;
  const relCount = visibleGoals.filter(g => g.pillar_id === 'relationships').length;

  if (reachCount > 0) {
    reachSpan.style.display = '';
    reachSpan.setAttribute('colspan', reachCount);
  } else {
    reachSpan.style.display = 'none';
  }

  if (resultsCount > 0) {
    resultsSpan.style.display = '';
    resultsSpan.setAttribute('colspan', resultsCount);
  } else {
    resultsSpan.style.display = 'none';
  }

  if (relCount > 0) {
    relSpan.style.display = '';
    relSpan.setAttribute('colspan', relCount);
  } else {
    relSpan.style.display = 'none';
  }
}

/**
 * Header Row 2: Specific Goal Names
 */
function renderGoalHeaderRow(visibleGoals) {
  const goalsHeaderRow = document.getElementById('goals-header-row');
  // Remove previously added goal th elements, keep the first sticky-col th
  while (goalsHeaderRow.children.length > 1) {
    goalsHeaderRow.removeChild(goalsHeaderRow.lastChild);
  }

  const isFull = state.showFullGoalNames === true;

  visibleGoals.forEach(g => {
    const th = document.createElement('th');
    const widthClass = isFull 
      ? 'w-56 min-w-[210px] max-w-[260px]' 
      : 'w-36 min-w-[130px] max-w-[150px]';
    th.className = `p-2 text-center ${widthClass} border-r border-slate-200 align-top group cursor-pointer hover:bg-slate-100/90 transition-colors select-none relative`;
    
    // Pillar color border accent
    const accentColor = g.pillar_id === 'reach' ? 'border-t-2 border-t-blue-500' :
                        g.pillar_id === 'results' ? 'border-t-2 border-t-emerald-500' :
                        'border-t-2 border-t-purple-500';
    th.classList.add(...accentColor.split(' '));

    const titleClamp = isFull ? '' : 'line-clamp-2';
    const displayName = isFull ? (g.district_statement || g.name) : (g.short_name || g.name);

    th.innerHTML = `
      <div class="flex flex-col items-center justify-between h-full space-y-1">
        <div class="flex items-center space-x-1">
          <span class="text-[10px] font-semibold tracking-wider text-slate-400 uppercase">${g.pillar_id}</span>
          <i data-lucide="info" class="w-2.5 h-2.5 text-slate-300 group-hover:text-blue-600 transition-colors"></i>
        </div>
        <span class="font-bold text-slate-800 text-xs leading-snug ${titleClamp}">
          ${displayName}
        </span>
        <span class="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
          Target: ${g.target || '100%'}
        </span>
      </div>
    `;

    // Tooltip / Popover listeners
    th.addEventListener('mouseenter', () => showGoalHoverPopover(th, g));
    th.addEventListener('mouseleave', hideGoalHoverPopover);
    th.addEventListener('click', () => openGoalDetailModal(g));

    goalsHeaderRow.appendChild(th);
  });

  // Health summary header column
  const summaryTh = document.createElement('th');
  summaryTh.className = 'p-2 text-center w-36 min-w-[140px] border-b border-slate-300';
  summaryTh.innerHTML = `<span class="text-[11px] font-semibold text-slate-600">% Healthy</span>`;
  goalsHeaderRow.appendChild(summaryTh);
}

/**
 * Header Row 3: Column Summary Progress Bars
 */
function renderColumnSummaryRow(visibleGoals, visibleSites) {
  const summaryRow = document.getElementById('goals-summary-row');
  while (summaryRow.children.length > 1) {
    summaryRow.removeChild(summaryRow.lastChild);
  }

  visibleGoals.forEach(g => {
    const th = document.createElement('th');
    th.className = 'p-1.5 text-center border-r border-slate-200 bg-slate-50/70 align-middle';

    let healthy = 0;
    let total = 0;
    visibleSites.forEach(s => {
      const cell = state.data.cells[`${s.id}::${g.gid}`];
      if (cell) {
        total++;
        if (STATUS_CONFIG[cell.status_key]?.isHealthy) healthy++;
      }
    });

    const pct = total > 0 ? Math.round((healthy / total) * 100) : 0;
    const barColor = pct >= 70 ? 'bg-emerald-500' : pct >= 40 ? 'bg-amber-500' : 'bg-rose-500';

    th.innerHTML = `
      <div class="px-1.5 py-0.5 space-y-1">
        <div class="flex items-center justify-between text-[10px] font-medium text-slate-600">
          <span>${pct}%</span>
          <span class="text-[9px] text-slate-400">${healthy}/${total}</span>
        </div>
        <div class="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
          <div class="${barColor} h-full rounded-full transition-all duration-300" style="width: ${pct}%"></div>
        </div>
      </div>
    `;
    summaryRow.appendChild(th);
  });

  // Empty cell for the health summary column in row 3
  const summaryTh = document.createElement('th');
  summaryTh.className = 'p-1 text-center bg-slate-50/70 text-[10px] text-slate-400';
  summaryTh.innerHTML = `<span>District Avg</span>`;
  summaryRow.appendChild(summaryTh);
}

/**
 * Render Heatmap Body Rows
 */
function renderTableBody(visibleGoals, visibleSites) {
  const tbody = document.getElementById('heatmap-body');
  tbody.innerHTML = '';

  if (visibleSites.length === 0) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td colspan="${visibleGoals.length + 2}" class="p-8 text-center text-slate-400">
        <i data-lucide="filter-x" class="w-8 h-8 mx-auto mb-2 text-slate-300"></i>
        <p class="font-medium text-sm text-slate-600">No school systems match the selected filters</p>
        <p class="text-xs text-slate-400 mt-1">Try clearing your search query or adjusting status filters</p>
      </td>
    `;
    tbody.appendChild(tr);
    return;
  }

  visibleSites.forEach((site, index) => {
    const tr = document.createElement('tr');
    tr.className = index % 2 === 0 ? 'bg-white hover:bg-slate-50/80 transition-colors' : 'bg-slate-50/40 hover:bg-slate-50/80 transition-colors';

    // 1. Sticky Left Column: Site Info
    const siteTd = document.createElement('td');
    siteTd.className = 'sticky-col p-2.5 border-r border-slate-200 z-10 font-medium text-slate-900 bg-inherit';
    siteTd.innerHTML = `
      <div class="flex items-center justify-between space-x-2">
        <div class="min-w-0 flex-1">
          <div class="font-semibold text-xs text-slate-900 truncate" title="${site.name}">
            ${site.name}
          </div>
          <div class="flex items-center space-x-1.5 mt-0.5 text-[10px] text-slate-500">
            ${site.region ? `<span class="px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 font-medium border border-slate-200">${site.region}</span>` : ''}
            ${site.cohort ? `<span class="text-slate-400">&bull; ${site.cohort}</span>` : ''}
          </div>
        </div>
      </div>
    `;
    tr.appendChild(siteTd);

    // 2. Goal Status Cells
    visibleGoals.forEach(goal => {
      const td = document.createElement('td');
      td.className = 'p-1.5 border-r border-slate-200 text-center align-middle';

      const cellKey = `${site.id}::${goal.gid}`;
      const cellData = state.data.cells[cellKey];

      const conf = cellData ? (STATUS_CONFIG[cellData.status_key] || STATUS_CONFIG.not_set) : STATUS_CONFIG.not_set;
      
      // Filter matching check
      const isFiltered = state.activeStatusFilter !== 'all';
      let isMatch = false;
      if (!isFiltered) {
        isMatch = true;
      } else if (state.activeStatusFilter === 'attention') {
        isMatch = cellData && (cellData.status_key === 'at_risk' || cellData.status_key === 'off_track');
      } else {
        isMatch = cellData && cellData.status_key === state.activeStatusFilter;
      }

      const matchClasses = isFiltered
        ? (isMatch
            ? 'ring-2 ring-indigo-600 ring-offset-1 font-bold shadow-md scale-[1.03] z-10'
            : 'opacity-20 grayscale-[75%] hover:opacity-85 hover:grayscale-0 transition-all')
        : '';

      const button = document.createElement('button');
      button.type = 'button';
      button.className = `status-cell w-full py-2 px-1.5 rounded-lg border text-xs flex flex-col items-center justify-center space-y-0.5 ${conf.cellClass} ${matchClasses}`;
      button.setAttribute('data-site-id', site.id);
      button.setAttribute('data-goal-gid', goal.gid);

      const progressHtml = cellData && cellData.progress_pct !== undefined && conf.group === 'open' && cellData.progress_pct > 0
        ? `<span class="text-[9px] font-semibold opacity-85">(${cellData.progress_pct}%)</span>`
        : '';

      button.innerHTML = `
        <span class="leading-none text-[11px] truncate w-full text-center">${conf.label}</span>
        ${progressHtml}
      `;

      button.addEventListener('click', () => {
        openDetailModal(site, goal, cellData, conf);
      });

      td.appendChild(button);
      tr.appendChild(td);
    });

    // 3. Site Health Summary Column
    const healthTd = document.createElement('td');
    healthTd.className = 'p-2 text-center border-l border-slate-200 align-middle bg-inherit';

    const healthColor = site.healthPct >= 75 ? 'text-emerald-700 bg-emerald-50 border-emerald-200' :
                        site.healthPct >= 50 ? 'text-amber-700 bg-amber-50 border-amber-200' :
                        'text-rose-700 bg-rose-50 border-rose-200';

    healthTd.innerHTML = `
      <div class="flex flex-col items-center space-y-1">
        <span class="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold border ${healthColor}">
          ${site.healthPct}%
        </span>
        <span class="text-[10px] text-slate-400 font-normal">
          ${site.healthyCount}/${site.totalAssigned} on track
        </span>
      </div>
    `;
    tr.appendChild(healthTd);

    tbody.appendChild(tr);
  });
}

/**
 * Open Detail Inspection Modal for a clicked cell
 */
function openDetailModal(site, goal, cellData, conf) {
  const modal = document.getElementById('cell-modal');
  
  // Set site and goal info
  document.getElementById('modal-site-name').textContent = site.name;
  document.getElementById('modal-goal-title').textContent = goal.district_statement || goal.name;
  
  // Pillar badge
  const pillarBadge = document.getElementById('modal-pillar-badge');
  pillarBadge.textContent = `${goal.pillar_id.toUpperCase()} PILLAR`;
  pillarBadge.className = goal.pillar_id === 'reach' ? 'inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold mb-1 bg-blue-100 text-blue-800 border border-blue-200' :
                          goal.pillar_id === 'results' ? 'inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold mb-1 bg-emerald-100 text-emerald-800 border border-emerald-200' :
                          'inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold mb-1 bg-purple-100 text-purple-800 border border-purple-200';

  // Status card
  const statusBadge = document.getElementById('modal-status-badge');
  statusBadge.className = `inline-flex items-center px-2.5 py-1 rounded-md font-bold text-xs ${conf.badgeClass}`;
  statusBadge.textContent = conf.label;

  // Progress text
  const progressText = document.getElementById('modal-progress-text');
  progressText.textContent = cellData && cellData.progress_pct !== undefined ? `${cellData.progress_pct}%` : '0%';

  // Subgoal name
  document.getElementById('modal-subgoal-name').textContent = (cellData && cellData.subgoal_name) || (cellData && cellData.status_title && cellData.status_title.split(' - ')[0]) || goal.district_statement || goal.name;

  // Meta & Notes
  const meta = document.getElementById('modal-update-meta');
  const notes = document.getElementById('modal-notes');
  if (cellData && cellData.notes) {
    meta.textContent = `Updated by ${cellData.author || 'Team'} on ${cellData.updated_at || 'Recent'}`;
    notes.textContent = cellData.notes;
    notes.classList.remove('italic', 'text-slate-400');
  } else {
    meta.textContent = 'No status update notes logged';
    notes.textContent = 'No commentary was recorded for this site on this goal yet.';
    notes.classList.add('italic', 'text-slate-400');
  }

  // Asana Link
  const asanaLink = document.getElementById('modal-asana-link');
  if (cellData && cellData.asana_url) {
    asanaLink.href = cellData.asana_url;
    asanaLink.style.display = 'inline-flex';
  } else {
    asanaLink.href = 'https://app.asana.com';
    asanaLink.style.display = 'inline-flex';
  }

  modal.classList.remove('hidden');
}

/**
 * Open Goal Detail Modal on Header Click
 */
function openGoalDetailModal(g) {
  const modal = document.getElementById('goal-modal');
  if (!modal || !state.data) return;

  hideGoalHoverPopover();

  const pillarBadge = document.getElementById('goal-modal-pillar-badge');
  pillarBadge.textContent = `${g.pillar_id.toUpperCase()} PILLAR`;
  pillarBadge.className = g.pillar_id === 'reach' ? 'inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold mb-1 bg-blue-100 text-blue-800 border border-blue-200' :
                          g.pillar_id === 'results' ? 'inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold mb-1 bg-emerald-100 text-emerald-800 border border-emerald-200' :
                          'inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold mb-1 bg-purple-100 text-purple-800 border border-purple-200';

  document.getElementById('goal-modal-title').textContent = g.district_statement || g.name;
  document.getElementById('goal-modal-target').textContent = `Target: ${g.target || '100%'} • Short Name: "${g.short_name || g.name}"`;
  const firmwideEl = document.getElementById('goal-modal-firmwide-text');
  if (firmwideEl) firmwideEl.textContent = g.firmwide_name || g.name;

  const pillarData = state.data.pillars ? state.data.pillars.find(p => p.id === g.pillar_id) : null;
  document.getElementById('goal-modal-pillar-name').textContent = pillarData ? `${pillarData.name} Pillar (${pillarData.goal_count} Goals)` : `${g.pillar_id} Pillar`;
  document.getElementById('goal-modal-pillar-desc').textContent = pillarData ? pillarData.description : '';

  // Aggregate stats across all sites for this goal
  const allSites = state.data.sites || [];
  const statusCounts = {
    on_track: 0,
    at_risk: 0,
    off_track: 0,
    no_recent_update: 0,
    achieved: 0,
    partial: 0,
    missed: 0,
    dropped: 0
  };
  let healthy = 0;
  let totalAssigned = 0;

  allSites.forEach(s => {
    const cell = state.data.cells[`${s.id}::${g.gid}`];
    if (cell) {
      totalAssigned++;
      if (statusCounts.hasOwnProperty(cell.status_key)) {
        statusCounts[cell.status_key]++;
      }
      if (STATUS_CONFIG[cell.status_key]?.isHealthy) {
        healthy++;
      }
    }
  });

  const overallPct = totalAssigned > 0 ? Math.round((healthy / totalAssigned) * 100) : 0;
  document.getElementById('goal-modal-overall-health').textContent = `${healthy}/${totalAssigned} sites on track (${overallPct}%)`;

  const breakdownContainer = document.getElementById('goal-modal-status-breakdown');
  breakdownContainer.innerHTML = `
    <div class="p-2 rounded-lg bg-emerald-50 border border-emerald-200">
      <span class="text-[10px] text-emerald-800 block font-medium">On Track</span>
      <span class="text-base font-bold text-emerald-900">${statusCounts.on_track}</span>
    </div>
    <div class="p-2 rounded-lg bg-emerald-100 border border-emerald-300">
      <span class="text-[10px] text-emerald-900 block font-medium">Achieved</span>
      <span class="text-base font-bold text-emerald-950">${statusCounts.achieved}</span>
    </div>
    <div class="p-2 rounded-lg bg-amber-50 border border-amber-200">
      <span class="text-[10px] text-amber-800 block font-medium">At Risk</span>
      <span class="text-base font-bold text-amber-900">${statusCounts.at_risk}</span>
    </div>
    <div class="p-2 rounded-lg bg-rose-50 border border-rose-200">
      <span class="text-[10px] text-rose-800 block font-medium">Off Track</span>
      <span class="text-base font-bold text-rose-900">${statusCounts.off_track}</span>
    </div>
  `;

  // Asana deep link
  const asanaLink = document.getElementById('goal-modal-asana-link');
  asanaLink.href = `https://app.asana.com/0/0/${g.gid}`;

  modal.classList.remove('hidden');
  if (window.lucide) window.lucide.createIcons();
}

/**
 * Show Floating Popover Card on Goal Header Hover
 */
function showGoalHoverPopover(th, g) {
  const popover = document.getElementById('goal-popover');
  if (!popover || !state.data) return;

  const pillarBadge = document.getElementById('popover-pillar-badge');
  pillarBadge.textContent = `${g.pillar_id.toUpperCase()} PILLAR`;
  pillarBadge.className = g.pillar_id === 'reach' ? 'inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-100 text-blue-800 border border-blue-200' :
                          g.pillar_id === 'results' ? 'inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200' :
                          'inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-purple-100 text-purple-800 border border-purple-200';

  document.getElementById('popover-target-badge').textContent = `Target: ${g.target || '100%'}`;
  document.getElementById('popover-full-name').textContent = g.district_statement || g.name;
  document.getElementById('popover-short-name').textContent = g.short_name || g.name;
  const popoverFirmwide = document.getElementById('popover-firmwide-name');
  if (popoverFirmwide) {
    popoverFirmwide.textContent = g.firmwide_name || '';
  }

  // Calculate health summary for this goal across visible sites
  const visibleSites = getFilteredAndSortedSites();
  let healthy = 0;
  let total = 0;
  visibleSites.forEach(s => {
    const cell = state.data.cells[`${s.id}::${g.gid}`];
    if (cell) {
      total++;
      if (STATUS_CONFIG[cell.status_key]?.isHealthy) healthy++;
    }
  });
  const pct = total > 0 ? Math.round((healthy / total) * 100) : 0;
  document.getElementById('popover-health-summary').textContent = `${healthy}/${total} sites on track (${pct}%)`;

  // Make visible
  popover.classList.remove('hidden');

  const rect = th.getBoundingClientRect();
  const popWidth = 320;
  let left = rect.left + (rect.width / 2) - (popWidth / 2);
  if (left < 12) left = 12;
  if (left + popWidth > window.innerWidth - 12) {
    left = window.innerWidth - popWidth - 12;
  }

  let top = rect.bottom + 8;
  if (top + popover.offsetHeight > window.innerHeight - 12) {
    top = rect.top - popover.offsetHeight - 8;
  }

  popover.style.left = `${left}px`;
  popover.style.top = `${top}px`;
  if (window.lucide) window.lucide.createIcons();
}

/**
 * Hide Floating Popover Card
 */
function hideGoalHoverPopover() {
  const popover = document.getElementById('goal-popover');
  if (popover) {
    popover.classList.add('hidden');
  }
}

/**
 * Show non-intrusive Toast Notification
 */
function showToast(message, type = 'info', duration = 4000) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  const bg = type === 'success' ? 'bg-emerald-800 text-white border-emerald-700' :
             type === 'error' ? 'bg-rose-800 text-white border-rose-700' :
             'bg-slate-800 text-white border-slate-700';
  const icon = type === 'success' ? 'check-circle' :
               type === 'error' ? 'alert-triangle' : 'info';

  toast.className = `pointer-events-auto flex items-center px-3.5 py-2.5 rounded-xl shadow-xl border text-xs font-medium space-x-2 transition-all transform translate-y-2 opacity-0 duration-200 ${bg}`;
  toast.innerHTML = `<i data-lucide="${icon}" class="w-4 h-4 flex-shrink-0"></i><span class="leading-snug">${message}</span>`;
  container.appendChild(toast);
  if (window.lucide) window.lucide.createIcons();

  requestAnimationFrame(() => {
    toast.classList.remove('translate-y-2', 'opacity-0');
  });

  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => toast.remove(), 250);
  }, duration);
}

/**
 * Setup Event Listeners
 */
function setupEventListeners() {
  // Initialize top horizontal scrollbar sync
  initTopScrollbar();

  // Search input
  const searchInput = document.getElementById('search-site');
  const clearBtn = document.getElementById('clear-search');
  searchInput.addEventListener('input', (e) => {
    state.searchQuery = e.target.value;
    clearBtn.classList.toggle('hidden', !state.searchQuery);
    renderApp();
  });

  clearBtn.addEventListener('click', () => {
    searchInput.value = '';
    state.searchQuery = '';
    clearBtn.classList.add('hidden');
    renderApp();
  });

  // Pillar buttons
  const pillarButtons = document.querySelectorAll('.pillar-btn');
  pillarButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      pillarButtons.forEach(b => {
        b.className = 'pillar-btn px-2.5 py-1 rounded-md font-medium text-slate-600 hover:text-slate-900 transition';
      });
      btn.className = 'pillar-btn px-2.5 py-1 rounded-md font-semibold bg-white text-slate-800 shadow-xs transition';
      state.activePillar = btn.getAttribute('data-pillar');
      renderApp();
    });
  });

  // Status Filter Dropdown
  const filterStatusSelect = document.getElementById('filter-status');
  filterStatusSelect.addEventListener('change', (e) => {
    state.activeStatusFilter = e.target.value;
    document.getElementById('btn-reset-filters').classList.toggle('hidden', state.activeStatusFilter === 'all');
    renderApp();
  });

  // Sort Dropdown
  const sortSelect = document.getElementById('sort-sites');
  sortSelect.addEventListener('change', (e) => {
    state.sortBy = e.target.value;
    renderApp();
  });

  // Interactive Legend Chips
  const legendChips = document.querySelectorAll('.legend-chip');
  legendChips.forEach(chip => {
    chip.addEventListener('click', () => {
      const statusKey = chip.getAttribute('data-legend-status');
      if (state.activeStatusFilter === statusKey) {
        state.activeStatusFilter = 'all';
        filterStatusSelect.value = 'all';
        document.getElementById('btn-reset-filters').classList.add('hidden');
      } else {
        state.activeStatusFilter = statusKey;
        filterStatusSelect.value = statusKey;
        document.getElementById('btn-reset-filters').classList.remove('hidden');
      }
      renderApp();
    });
  });

  // Reset Filters Button
  const resetBtn = document.getElementById('btn-reset-filters');
  const clearFilter = () => {
    state.activeStatusFilter = 'all';
    filterStatusSelect.value = 'all';
    resetBtn.classList.add('hidden');
    renderApp();
  };
  resetBtn.addEventListener('click', clearFilter);

  // Banner Clear Button
  const bannerClearBtn = document.getElementById('btn-banner-clear');
  if (bannerClearBtn) {
    bannerClearBtn.addEventListener('click', clearFilter);
  }

  // Toggle Hide Non-Matching Sites Checkbox
  const chkHideNonMatching = document.getElementById('chk-hide-non-matching');
  if (chkHideNonMatching) {
    chkHideNonMatching.addEventListener('change', (e) => {
      state.hideNonMatchingSites = e.target.checked;
      renderApp();
    });
  }

  // Modal Closers
  const closeModal = () => document.getElementById('cell-modal').classList.add('hidden');
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('modal-dismiss').addEventListener('click', closeModal);
  document.getElementById('cell-modal').addEventListener('click', (e) => {
    if (e.target.id === 'cell-modal') closeModal();
  });

  // Settings Modal Closers
  const closeSettings = () => document.getElementById('settings-modal').classList.add('hidden');
  document.getElementById('btn-settings').addEventListener('click', () => {
    document.getElementById('settings-modal').classList.remove('hidden');
  });
  document.getElementById('settings-close').addEventListener('click', closeSettings);
  document.getElementById('settings-dismiss').addEventListener('click', closeSettings);
  document.getElementById('settings-modal').addEventListener('click', (e) => {
    if (e.target.id === 'settings-modal') closeSettings();
  });

  // Export CSV
  document.getElementById('btn-export-csv').addEventListener('click', exportCSV);

  // Sync Button
  document.getElementById('btn-sync').addEventListener('click', () => triggerAsanaSync({ silent: false }));

  // Toggle Goal Names (Short vs Full)
  const btnTitlesAbbr = document.getElementById('toggle-titles-abbr');
  const btnTitlesFull = document.getElementById('toggle-titles-full');
  if (btnTitlesAbbr && btnTitlesFull) {
    btnTitlesAbbr.addEventListener('click', () => {
      if (!state.showFullGoalNames) return;
      state.showFullGoalNames = false;
      btnTitlesAbbr.className = 'px-2 py-0.5 rounded-md font-semibold bg-white text-slate-800 shadow-xs transition';
      btnTitlesFull.className = 'px-2 py-0.5 rounded-md font-medium text-slate-600 hover:text-slate-900 transition';
      renderHeatmap();
    });

    btnTitlesFull.addEventListener('click', () => {
      if (state.showFullGoalNames) return;
      state.showFullGoalNames = true;
      btnTitlesFull.className = 'px-2 py-0.5 rounded-md font-semibold bg-white text-slate-800 shadow-xs transition';
      btnTitlesAbbr.className = 'px-2 py-0.5 rounded-md font-medium text-slate-600 hover:text-slate-900 transition';
      renderHeatmap();
    });
  }

  // Goal Modal Closers
  const closeGoalModal = () => {
    const modal = document.getElementById('goal-modal');
    if (modal) modal.classList.add('hidden');
  };
  const goalModalClose = document.getElementById('goal-modal-close');
  if (goalModalClose) goalModalClose.addEventListener('click', closeGoalModal);
  const goalModalDismiss = document.getElementById('goal-modal-dismiss');
  if (goalModalDismiss) goalModalDismiss.addEventListener('click', closeGoalModal);
  const goalModal = document.getElementById('goal-modal');
  if (goalModal) {
    goalModal.addEventListener('click', (e) => {
      if (e.target.id === 'goal-modal') closeGoalModal();
    });
  }

  // Window resize to recompute sticky heights and scrollbars
  window.addEventListener('resize', () => {
    adjustStickyHeaderHeights();
    updateTopScrollbar();
    hideGoalHoverPopover();
  });

  // ESC key to close all modals
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModal();
      closeSettings();
      closeGoalModal();
      hideGoalHoverPopover();
    }
  });

  // Save Credentials Button in Settings Modal
  document.getElementById('btn-save-credentials').addEventListener('click', async () => {
    const pat = document.getElementById('cfg-pat').value.trim();
    const workspace = document.getElementById('cfg-workspace').value.trim();
    if (!pat) {
      alert('Please enter your Asana Personal Access Token.');
      return;
    }
    await saveCredentialsAndSync(pat, workspace);
  });

  // Test Connection Button
  document.getElementById('btn-test-connection').addEventListener('click', async () => {
    const pat = document.getElementById('cfg-pat').value.trim();
    if (!pat) {
      alert('Please enter an Asana Personal Access Token to test.');
      return;
    }
    testAsanaConnection(pat);
  });
}

let isSyncing = false;

/**
 * Trigger Asana Sync via Backend
 */
async function triggerAsanaSync(options = {}) {
  const silent = options && options.silent === true;
  if (isSyncing) return;
  isSyncing = true;

  const syncBtn = document.getElementById('btn-sync');
  const originalText = syncBtn.innerHTML;
  syncBtn.disabled = true;
  syncBtn.innerHTML = `<i data-lucide="loader-2" class="w-3.5 h-3.5 mr-1.5 animate-spin"></i> ${silent ? 'Syncing Asana...' : 'Syncing...'}`;
  if (window.lucide) window.lucide.createIcons();

  try {
    const res = await fetch('/api/sync', { method: 'POST' });
    if (res.ok) {
      const result = await res.json();
      // Defensive payload check per AGENTS.md Section 5.2
      if (result && Array.isArray(result.sites) && result.cells && Object.keys(result.cells).length > 0) {
        state.data = result;
        updateHeaderMeta();
        renderApp();
        if (silent) {
          showToast('Heatmap synchronized with latest Asana data', 'success', 3500);
        } else {
          showToast('Sync successful! Heatmap updated with latest Asana data.', 'success', 4000);
        }
      } else {
        console.warn('Sync returned incomplete payload, keeping existing cache:', result);
        if (!silent) {
          showToast('Sync completed but received incomplete data from server.', 'error', 4000);
        }
      }
    } else {
      const err = await res.json().catch(() => ({}));
      const msg = err.error || err.message || `Sync failed (HTTP ${res.status})`;
      console.warn('Asana sync warning:', msg);
      if (!silent) {
        showToast(msg, 'error', 5000);
      }
    }
  } catch (err) {
    console.warn('Sync request error:', err);
    if (!silent) {
      showToast('Could not connect to sync service. Ensure backend server is running.', 'error', 5000);
    }
  } finally {
    isSyncing = false;
    syncBtn.disabled = false;
    syncBtn.innerHTML = originalText;
    if (window.lucide) window.lucide.createIcons();
  }
}

/**
 * Test Asana Connection
 */
async function testAsanaConnection(pat) {
  const statusBox = document.getElementById('settings-status-box');
  const statusMsg = document.getElementById('settings-status-msg');
  statusBox.classList.remove('hidden');
  statusMsg.className = 'text-xs font-medium text-blue-600 flex items-center';
  statusMsg.innerHTML = `<i data-lucide="loader-2" class="w-3.5 h-3.5 mr-1.5 animate-spin"></i> Verifying token with Asana...`;
  if (window.lucide) window.lucide.createIcons();

  try {
    const res = await fetch('https://app.asana.com/api/1.0/users/me', {
      headers: { 'Authorization': `Bearer ${pat}` }
    });
    if (res.ok) {
      const user = await res.json();
      statusMsg.className = 'text-xs font-medium text-emerald-700';
      statusMsg.innerHTML = `<i data-lucide="check-circle" class="w-3.5 h-3.5 mr-1 text-emerald-600 inline"></i> Connected as <strong>${user.data.name}</strong> (${user.data.email})`;
    } else {
      statusMsg.className = 'text-xs font-medium text-rose-600';
      statusMsg.innerHTML = `<i data-lucide="x-circle" class="w-3.5 h-3.5 mr-1 text-rose-600 inline"></i> Invalid credentials (HTTP ${res.status}). Please check your PAT.`;
    }
  } catch (err) {
    statusMsg.className = 'text-xs font-medium text-amber-700';
    statusMsg.innerHTML = `Direct browser test blocked by CORS. The token will be verified via backend server upon saving.`;
  }
  if (window.lucide) window.lucide.createIcons();
}

/**
 * Save Credentials & Sync
 */
async function saveCredentialsAndSync(pat, workspace) {
  try {
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ asana_token: pat, workspace_gid: workspace })
    });
    if (res.ok) {
      document.getElementById('settings-modal').classList.add('hidden');
      await triggerAsanaSync({ silent: false });
    } else {
      alert('Could not save credentials to backend server.');
    }
  } catch (err) {
    // If running purely client-side without backend, store in localStorage
    localStorage.setItem('ASANA_ACCESS_TOKEN', pat);
    if (workspace) localStorage.setItem('ASANA_WORKSPACE_GID', workspace);
    alert('Credentials saved locally in browser storage.');
    document.getElementById('settings-modal').classList.add('hidden');
  }
}

/**
 * Export CSV
 */
function exportCSV() {
  const visibleGoals = getVisibleGoals();
  const visibleSites = getFilteredAndSortedSites();

  const headers = ['School System / Site', 'Region', 'Cohort', ...visibleGoals.map(g => `"${g.short_name || g.name}"`), 'Healthy Goals %'];
  
  const rows = [headers];

  visibleSites.forEach(s => {
    const row = [
      `"${s.name}"`,
      `"${s.region || ''}"`,
      `"${s.cohort || ''}"`
    ];

    visibleGoals.forEach(g => {
      const cell = state.data.cells[`${s.id}::${g.gid}`];
      if (cell) {
        const conf = STATUS_CONFIG[cell.status_key];
        const statusText = conf ? conf.label : 'Not Set';
        const pctText = cell.progress_pct !== undefined ? ` (${cell.progress_pct}%)` : '';
        row.push(`"${statusText}${pctText}"`);
      } else {
        row.push('""');
      }
    });

    row.push(`"${s.healthPct}%"`);
    rows.push(row);
  });

  const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(r => r.join(',')).join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `opportunity_culture_goals_heatmap_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
