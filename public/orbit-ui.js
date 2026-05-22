/**
 * ORBIT UI layer — presentation only. Reads state via window.ORBIT / localStorage.
 */
(function () {
  const STORAGE = {
    DAILY: 'orbit_daily_checklist',
    TODAY: 'orbit_today_checklist',
    GOALS: 'orbit_goals',
    VISIONS: 'orbit_visions',
    SESSIONS: 'orbit_sessions',
    MEMORY: 'orbit_memory',
    CHAT: 'orbit_chat',
  };

  const GOAL_COLORS = ['#f97316', '#22c55e', '#3b82f6', '#a855f7', '#eab308', '#ec4899'];

  let sessionPointsToday = parseInt(localStorage.getItem('orbit_session_points_ui') || '0', 10);
  let habitPointsToday = parseInt(localStorage.getItem('orbit_habit_points_ui') || '0', 10);

  function load(key, def) {
    try {
      const r = localStorage.getItem(key);
      return r ? JSON.parse(r) : def;
    } catch {
      return def;
    }
  }

  function getState() {
    if (window.ORBIT) return window.ORBIT.getState();
    return {
      dailyChecklist: load(STORAGE.DAILY, []),
      todayChecklist: load(STORAGE.TODAY, []),
      goals: load(STORAGE.GOALS, []),
      visions: load(STORAGE.VISIONS, []),
      sessions: load(STORAGE.SESSIONS, []),
      memory: load(STORAGE.MEMORY, {}),
      calculateDoom: () => 0,
      getDoomColor: () => 'var(--doom-safe)',
      escapeHtml: (s) => String(s),
      getGoalTitle: () => '',
      safeProgress: () => 0,
      isValidDate: (d) => d instanceof Date && !isNaN(d),
    };
  }

  function todayStr() {
    return new Date().toDateString();
  }

  function dayKey(offset) {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return d.toDateString();
  }

  function goalColor(id) {
    const goals = getState().goals;
    const i = goals.findIndex((g) => g.id === id);
    return GOAL_COLORS[i % GOAL_COLORS.length] || GOAL_COLORS[0];
  }

  function getContextualChatMessage() {
    const s = getState();
    const doom = s.calculateDoom();
    const goals = s.goals || [];
    const behind = goals.filter((g) => {
      const dl = new Date(g.deadline);
      const created = new Date(g.created_at || Date.now());
      if (!s.isValidDate(dl)) return false;
      const totalDays = Math.max(1, (dl - created) / 86400000);
      const daysLeft = Math.max(0, (dl - Date.now()) / 86400000);
      const expected = Math.min(1, Math.max(0, 1 - daysLeft / totalDays));
      const actual = (Number(g.logged_hours) || 0) / Math.max(0.01, Number(g.total_hours) || 1);
      return expected - actual > 0.15;
    });

    if (doom <= 25) {
      return "orbit's quiet today. you're in the pocket — what's the move?";
    }
    if (doom <= 60) {
      const g = behind[0] || goals[0];
      const name = g ? `"${g.title}"` : 'one of your goals';
      return `you're doing ok. but ${name} could use a real push this week — want to talk it through?`;
    }
    const names = behind.slice(0, 2).map((g) => g.title).join(' and ');
    return names
      ? `real talk: ${names} ${behind.length > 1 ? 'are' : 'is'} at risk if nothing shifts. what's blocking you?`
      : "doom's high. something's slipping — name it and we figure out the next hour.";
  }

  /* ---- Doom meter ---- */
  function enhanceDoomMeter() {
    const top = document.getElementById('doom-meter-top');
    if (!top) return;

    const s = getState();
    const doom = s.calculateDoom();
    const color = s.getDoomColor(doom);
    const fill = document.getElementById('doom-fill');
    const valueEl = document.getElementById('doom-value');
    const shine = document.getElementById('doom-fill-shine');

    top.classList.remove('doom-tier-safe', 'doom-tier-warning', 'doom-tier-danger', 'doom-ambient-hot');
    if (doom >= 60) top.classList.add('doom-tier-danger');
    else if (doom >= 25) top.classList.add('doom-tier-warning');
    else top.classList.add('doom-tier-safe');

    if (valueEl) {
      valueEl.textContent = `${doom}%`;
      valueEl.style.color = color;
    }
    if (fill) {
      fill.style.background = color;
      fill.style.width = `${doom}%`;
      fill.classList.toggle('doom-fill-hot', doom > 50 && doom < 85);
      fill.classList.toggle('doom-fill-critical', doom >= 85);
    }
    if (shine) shine.style.width = `${doom}%`;
    const bar = document.getElementById('doom-bar');
    if (bar) bar.classList.toggle('doom-bar-hot', doom > 50);
  }

  /* ---- Sidebar ring + points ---- */
  function updateSidebarOrbit() {
    const s = getState();
    const daily = s.dailyChecklist || [];
    const done = daily.filter((i) => i.completed).length;
    const pct = daily.length ? done / daily.length : 0;
    const ring = document.getElementById('logo-streak-fill');
    if (ring) {
      const c = 2 * Math.PI * 22;
      ring.style.strokeDasharray = `${c}`;
      ring.style.strokeDashoffset = `${c * (1 - pct)}`;
    }
    const ptsEl = document.getElementById('orbit-points-today');
    const totalPts = habitPointsToday + sessionPointsToday;
    if (ptsEl) ptsEl.textContent = `${totalPts} orbit points today`;
  }

  /* ---- Orbit score HUD ---- */
  function updateOrbitScoreCard() {
    const card = document.getElementById('orbit-score-card');
    if (!card) return;
    const s = getState();
    const combined = s.getCombinedTodayTasks ? s.getCombinedTodayTasks() : [];
    const done = combined.filter((i) => i.completed).length;
    const total = combined.length;
    const sessions = (s.sessions || []).filter((x) => {
      const d = new Date(x.logged_at);
      return s.isValidDate(d) && d.toDateString() === todayStr() && x.type === 'pomodoro';
    });
    const hours = (s.goals || []).reduce((sum, g) => sum + (Number(g.logged_hours) || 0), 0);
    const pts = habitPointsToday + sessionPointsToday;

    card.querySelector('[data-orbit-habits]').textContent = `${done}/${total}`;
    card.querySelector('[data-orbit-sessions]').textContent = String(sessions.length);
    card.querySelector('[data-orbit-hours]').textContent = String(Math.round(hours * 10) / 10);
    card.querySelector('[data-orbit-points]').textContent = String(pts);
  }

  /* ---- Alignment threads on checklist items ---- */
  function decorateChecklistItems() {
    document.querySelectorAll('.checklist-item').forEach((row) => {
      const id = row.dataset.id;
      const list = row.dataset.list;
      const s = getState();
      const listArr = list === 'daily' ? s.dailyChecklist : (s.todayChecklist || []).filter((i) => {
        const d = new Date(i.due_date);
        return s.isValidDate(d) && d.toDateString() === todayStr();
      });
      const item = listArr.find((i) => i.id === id);
      if (!item) return;

      let thread = row.querySelector('.alignment-thread');
      if (!thread) {
        thread = document.createElement('div');
        thread.className = 'alignment-thread';
        const del = row.querySelector('.checklist-delete');
        if (del) row.insertBefore(thread, del);
        else row.appendChild(thread);
      }
      if (item.linked_goal_id) {
        const title = s.getGoalTitle(item.linked_goal_id);
        const col = goalColor(item.linked_goal_id);
        thread.innerHTML = `<span class="alignment-dot" style="background:${col};box-shadow:0 0 6px ${col}"></span><span>${s.escapeHtml(title)}</span>`;
        thread.style.display = 'flex';
      } else {
        thread.innerHTML = '';
        thread.style.display = 'none';
      }
    });
  }

  function decorateGoalCards() {
    const s = getState();
    document.querySelectorAll('.goal-card').forEach((card) => {
      const id = card.dataset.id;
      const goal = (s.goals || []).find((g) => g.id === id);
      if (!goal) return;
      let thread = card.querySelector('.goal-vision-thread');
      if (!thread) {
        thread = document.createElement('div');
        thread.className = 'goal-vision-thread';
        card.appendChild(thread);
      }
      const vision = (s.visions || []).find((v) => v.id === goal.linked_vision_id);
      if (vision) {
        const t = vision.title.length > 18 ? vision.title.slice(0, 18) + '…' : vision.title;
        thread.innerHTML = `<span class="alignment-dot"></span><span>→ ${s.escapeHtml(t)}</span>`;
      } else {
        thread.innerHTML = '<span style="color:#52525b;font-size:11px">no vision linked</span>';
      }
    });
  }

  function showPointsFloat(row) {
    const el = document.createElement('span');
    el.className = 'points-float';
    el.textContent = '+10 pts';
    row.appendChild(el);
    setTimeout(() => el.remove(), 900);
  }

  /* ---- Pomodoro ring ---- */
  const POMO_TOTAL = 25 * 60;
  function updatePomodoroRing() {
    const ring = document.getElementById('pomodoro-ring-progress');
    if (!ring) return;
    const timeEl = document.getElementById('pomodoro-time');
    if (!timeEl) return;
    const parts = timeEl.textContent.split(':');
    const secs = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
    const label = document.getElementById('pomodoro-label');
    const total = label && label.textContent.includes('Break') ? 5 * 60 : POMO_TOTAL;
    const c = 2 * Math.PI * 98;
    const ratio = Math.max(0, secs / total);
    ring.setAttribute('stroke-dasharray', String(c));
    ring.setAttribute('stroke-dashoffset', String(c * (1 - ratio)));
  }

  function showSessionComplete() {
    const overlay = document.getElementById('session-complete-overlay');
    if (!overlay) return;
    sessionPointsToday += 25;
    localStorage.setItem('orbit_session_points_ui', String(sessionPointsToday));
    overlay.querySelector('.session-pts').textContent = '+25 orbit points';
    overlay.classList.add('active');
    setTimeout(() => overlay.classList.remove('active'), 2200);
    updateOrbitScoreCard();
    updateSidebarOrbit();
  }

  /* ---- Chat slide ---- */
  function initChatUI() {
    const panel = document.getElementById('chat-panel');
    const toggle = document.getElementById('header-chat-toggle');
    const closeBtn = document.getElementById('chat-panel-toggle');
    if (!panel) return;

    function setOpen(open) {
      panel.classList.toggle('collapsed', !open);
      document.body.classList.toggle('chat-open', open);
      if (toggle) toggle.classList.toggle('active', open);
      localStorage.setItem('orbit_chat_open', open ? 'true' : 'false');
      if (open && (!load(STORAGE.CHAT, []).length)) {
        const msgs = document.getElementById('chat-messages');
        if (msgs && msgs.children.length <= 1) {
          msgs.innerHTML = '';
          const div = document.createElement('div');
          div.className = 'message ai';
          div.textContent = getContextualChatMessage();
          msgs.appendChild(div);
        }
      }
    }

    const open = localStorage.getItem('orbit_chat_open') !== 'false';
    setOpen(open);

    if (toggle) {
      toggle.addEventListener('click', () => setOpen(panel.classList.contains('collapsed')));
    }
    if (closeBtn) {
      closeBtn.addEventListener('click', () => setOpen(false));
    }
  }

  /* ---- Vision cards decorate ---- */
  function decorateVisions() {
    const s = getState();
    const grid = document.getElementById('vision-grid');
    if (!grid) return;

    if (!(s.visions || []).length) {
      grid.innerHTML = `
        <div class="vision-empty-constellation" style="grid-column:1/-1">
          <svg class="constellation-svg" viewBox="0 0 200 120" fill="none" stroke="currentColor" stroke-width="1">
            <circle cx="30" cy="60" r="2" fill="currentColor"/><circle cx="80" cy="30" r="2" fill="currentColor"/>
            <circle cx="120" cy="70" r="2" fill="currentColor"/><circle cx="170" cy="40" r="2" fill="currentColor"/>
            <circle cx="100" cy="90" r="2" fill="currentColor"/>
            <path d="M30 60 L80 30 L120 70 L170 40 M80 30 L100 90 L120 70" stroke="rgba(249,115,22,0.4)"/>
          </svg>
          <h3>your universe starts here</h3>
          <p style="color:var(--text-muted);font-size:14px;margin-top:8px">add a life vision to light up the map</p>
        </div>`;
      return;
    }

    const emojis = ['🌌', '🚀', '⚡', '🎯', '🔮', '✦'];
    grid.querySelectorAll('.vision-card').forEach((card, idx) => {
      const id = card.dataset.id;
      const v = s.visions.find((x) => x.id === id);
      if (!v) return;
      const year = Number(v.target_year) || new Date().getFullYear();
      const span = year - new Date().getFullYear();
      let badge = '1yr';
      if (span >= 4) badge = '5yr';
      else if (span >= 2) badge = '3yr';

      const linked = (s.goals || []).filter((g) => g.linked_vision_id === v.id).length;
      const progress = linked ? Math.min(100, linked * 25) : 0;

      if (!card.querySelector('.vision-emoji')) {
        const emoji = document.createElement('div');
        emoji.className = 'vision-emoji';
        emoji.textContent = emojis[idx % emojis.length];
        card.insertBefore(emoji, card.firstChild);
      }
      const yearEl = card.querySelector('.vision-year');
      if (yearEl) yearEl.outerHTML = `<span class="vision-timeline-badge">${badge} horizon</span>`;

      let ring = card.querySelector('.vision-progress-ring');
      if (!ring) {
        ring = document.createElement('div');
        ring.className = 'vision-progress-ring';
        ring.innerHTML = `<svg width="44" height="44" viewBox="0 0 44 44"><circle cx="22" cy="22" r="18" fill="none" stroke="#1f1f1f" stroke-width="3"/><circle class="v-ring-fill" cx="22" cy="22" r="18" fill="none" stroke="var(--accent)" stroke-width="3" stroke-linecap="round"/></svg>`;
        card.appendChild(ring);
      }
      const fill = ring.querySelector('.v-ring-fill');
      const circ = 2 * Math.PI * 18;
      fill.setAttribute('stroke-dasharray', String(circ));
      fill.setAttribute('stroke-dashoffset', String(circ * (1 - progress / 100)));
      fill.style.transform = 'rotate(-90deg)';
      fill.style.transformOrigin = '50% 50%';
    });
  }

  /* ---- Overview dashboard ---- */
  function sessionsByDay(offset) {
    const key = dayKey(offset);
    return (getState().sessions || []).filter((s) => {
      const d = new Date(s.logged_at);
      return d.toDateString() === key && s.type === 'pomodoro';
    }).length;
  }

  function habitsDoneOnDay(offset) {
    if (offset !== 0) return 0;
    const s = getState();
    const daily = s.dailyChecklist || [];
    const today = (s.todayChecklist || []).filter((i) => {
      const d = new Date(i.due_date);
      return s.isValidDate(d) && d.toDateString() === todayStr();
    });
    return daily.filter((i) => i.completed).length + today.filter((i) => i.completed).length;
  }

  function habitsTotalToday() {
    const s = getState();
    const today = (s.todayChecklist || []).filter((i) => {
      const d = new Date(i.due_date);
      return s.isValidDate(d) && d.toDateString() === todayStr();
    });
    return (s.dailyChecklist || []).length + today.length;
  }

  function sparklineSvg(values, color, w, h) {
    const max = Math.max(1, ...values);
    const pts = values.map((v, i) => {
      const x = (i / (values.length - 1 || 1)) * w;
      const y = h - (v / max) * (h - 4) - 2;
      return `${x},${y}`;
    });
    return `<svg class="stat-sparkline" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><polyline fill="none" stroke="${color}" stroke-width="2" points="${pts.join(' ')}"/></svg>`;
  }

  function renderOverviewDashboard() {
    const root = document.getElementById('overview-dashboard');
    if (!root) return;

    const s = getState();
    const doom = s.calculateDoom();
    const doomColor = s.getDoomColor(doom);
    const combined = s.getCombinedTodayTasks ? s.getCombinedTodayTasks() : [];
    const done = combined.filter((i) => i.completed).length;
    const total = combined.length;
    const todaySessions = sessionsByDay(0);
    const hours = (s.goals || []).reduce((sum, g) => sum + (Number(g.logged_hours) || 0), 0);

    const weekSessions = [];
    const weekTasks = [];
    const weekDoom = [];
    for (let i = -6; i <= 0; i++) {
      weekSessions.push(sessionsByDay(i));
      weekTasks.push(i === 0 ? done : 0);
      weekDoom.push(i === 0 ? doom : Math.min(40, sessionsByDay(i) * 8 + (i === 0 ? 0 : 5)));
    }

    const dayLabels = [];
    for (let i = -6; i <= 0; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      dayLabels.push(d.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 3));
    }

    const doomGlow =
      doom >= 60 ? 'rgba(239,68,68,0.12)' : doom >= 25 ? 'rgba(249,115,22,0.08)' : 'transparent';

    root.innerHTML = `
      <div class="overview-stats" id="overview-stats-row">
        <div class="stat-card-hud" style="--stat-accent:#22c55e">
          <div class="stat-label">Tasks Today</div>
          <div class="stat-value">${done}/${total}</div>
          <div class="stat-change">${total ? (done === total ? 'All done' : `${total - done} left`) : 'No tasks'}</div>
          ${sparklineSvg(weekTasks, '#22c55e', 120, 32)}
        </div>
        <div class="stat-card-hud" style="--stat-accent:#f97316">
          <div class="stat-label">Focus Sessions</div>
          <div class="stat-value">${todaySessions}</div>
          <div class="stat-change">${todaySessions * 25} min focused</div>
          ${sparklineSvg(weekSessions, '#f97316', 120, 32)}
        </div>
        <div class="stat-card-hud" style="--stat-accent:#3b82f6">
          <div class="stat-label">Hours Logged</div>
          <div class="stat-value">${Math.round(hours * 10) / 10}</div>
          <div class="stat-change">${(s.goals || []).length} goals</div>
          ${sparklineSvg(weekSessions.map((n) => n * 0.4), '#3b82f6', 120, 32)}
        </div>
        <div class="stat-card-hud doom-stat" style="--stat-accent:${doomColor};--doom-glow-inset:${doomGlow}">
          <div class="stat-label">Doom Level</div>
          <div class="stat-value" style="color:${doomColor}">${doom}%</div>
          <div class="stat-change">${doom <= 25 ? 'On track' : doom <= 50 ? 'Needs attention' : doom <= 70 ? 'Falling behind' : 'Critical'}</div>
          ${sparklineSvg(weekDoom, doom >= 60 ? '#ef4444' : doom >= 25 ? '#f97316' : '#22c55e', 120, 32)}
        </div>
      </div>

      <div class="chart-panel" id="doom-trend-panel">
        <h3>Doom Trend — Last 7 Days</h3>
        <div id="doom-trend-chart"></div>
      </div>

      <div class="chart-panel">
        <h3>Habit Streak — Last 28 Days</h3>
        <div class="heatmap-wrap">
          <div id="habit-heatmap"></div>
          <div>
            <div class="heatmap-labels" style="width:calc(7*10px + 6*3px)">
              <span>W-3</span><span>W-2</span><span>W-1</span><span>This Week</span>
            </div>
            <p style="font-size:11px;color:var(--text-muted);margin-top:12px;max-width:200px">Hover squares for daily habit count (today uses live data)</p>
          </div>
        </div>
      </div>

      <div class="chart-panel" id="goal-progress-panel">
        <h3>Goal Progress</h3>
        <div id="goal-progress-list"></div>
      </div>

      <div class="chart-panel">
        <h3>Focus Sessions — This Week</h3>
        <div id="focus-bars-chart"></div>
      </div>

      <div class="week-summary-box" id="week-summary">
        <h3>Week at a Glance</h3>
        <div class="week-summary-cols" id="week-summary-cols"></div>
        <p class="week-summary-line" id="week-summary-text"></p>
      </div>`;

    renderDoomTrendChart(weekDoom, dayLabels, doom);
    renderHeatmap();
    renderGoalProgressBars();
    renderFocusBars(weekSessions, dayLabels);
    renderWeekSummary(weekSessions, weekDoom);
  }

  function renderDoomTrendChart(values, labels, currentDoom) {
    const el = document.getElementById('doom-trend-chart');
    if (!el) return;
    const w = 800;
    const h = 160;
    const pad = { l: 32, r: 16, t: 16, b: 28 };
    const iw = w - pad.l - pad.r;
    const ih = h - pad.t - pad.b;
    const hasData = values.some((v) => v > 0) || currentDoom > 0;

    if (!hasData) {
      el.innerHTML = `<svg viewBox="0 0 ${w} ${h}" style="height:160px"><text x="${w / 2}" y="${h / 2}" text-anchor="middle" fill="#71717a" font-size="13">start logging to see trends</text><line x1="${pad.l}" y1="${h - pad.b}" x2="${w - pad.r}" y2="${h - pad.b}" stroke="#1f1f1f"/></svg>`;
      return;
    }

    const pts = values.map((v, i) => {
      const x = pad.l + (i / (values.length - 1)) * iw;
      const y = pad.t + ih - (v / 100) * ih;
      return [x, y];
    });
    let d = `M ${pts[0][0]} ${pts[0][1]}`;
    for (let i = 1; i < pts.length; i++) {
      const p0 = pts[i - 1];
      const p1 = pts[i];
      const mx = (p0[0] + p1[0]) / 2;
      d += ` C ${mx} ${p0[1]}, ${mx} ${p1[1]}, ${p1[0]} ${p1[1]}`;
    }
    const fillD = `${d} L ${pts[pts.length - 1][0]} ${pad.t + ih} L ${pts[0][0]} ${pad.t + ih} Z`;
    const lineColor = currentDoom >= 60 ? '#ef4444' : currentDoom >= 25 ? '#f97316' : '#22c55e';
    const y25 = pad.t + ih - 0.25 * ih;
    const y60 = pad.t + ih - 0.6 * ih;

    el.innerHTML = `<svg viewBox="0 0 ${w} ${h}" style="height:160px;width:100%">
      <defs><linearGradient id="doomGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${lineColor}" stop-opacity="0.35"/><stop offset="100%" stop-color="${lineColor}" stop-opacity="0"/></linearGradient></defs>
      <line x1="${pad.l}" y1="${y60}" x2="${w - pad.r}" y2="${y60}" stroke="#ef4444" stroke-dasharray="4 4" opacity="0.6"/>
      <text x="${w - pad.r - 4}" y="${y60 - 4}" text-anchor="end" fill="#ef4444" font-size="9">DANGER ZONE</text>
      <line x1="${pad.l}" y1="${y25}" x2="${w - pad.r}" y2="${y25}" stroke="#eab308" stroke-dasharray="4 4" opacity="0.5"/>
      <text x="${w - pad.r - 4}" y="${y25 - 4}" text-anchor="end" fill="#eab308" font-size="9">WARNING</text>
      <path d="${fillD}" fill="url(#doomGrad)"/>
      <path class="doom-trend-line" d="${d}" fill="none" stroke="${lineColor}" stroke-width="3" style="filter: drop-shadow(0 0 4px ${lineColor})"/>
      ${labels.map((lb, i) => `<text x="${pad.l + (i / (labels.length - 1)) * iw}" y="${h - 6}" text-anchor="middle" fill="#71717a" font-size="10">${lb}</text>`).join('')}
    </svg>`;
  }

  function heatColor(count, total) {
    if (count === 0) return '#1a1a1f';
    const ratio = total ? count / total : 0;
    if (ratio >= 0.8 || count >= 5) return '#ff8c00';
    if (ratio >= 0.5 || count >= 3) return '#a05000';
    if (count >= 1) return '#3d2200';
    return '#1a1a1f';
  }

  function renderHeatmap() {
    const el = document.getElementById('habit-heatmap');
    if (!el) return;
    const total = habitsTotalToday();
    let html = '<div class="heatmap-grid">';
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 7; col++) {
        const dayOffset = -27 + row * 7 + col;
        const count = habitsDoneOnDay(dayOffset);
        const d = new Date();
        d.setDate(d.getDate() + dayOffset);
        const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const tip = `${label} — ${count}/${total || 6} habits`;
        html += `<div class="heatmap-cell" style="background:${heatColor(count, total)}" title="${tip}"></div>`;
      }
    }
    html += '</div>';
    if (!total && !getState().sessions.length) {
      html += '<p class="empty-ash" style="padding:12px 0 0">your streak starts today</p>';
    }
    el.innerHTML = html;
  }

  function renderGoalProgressBars() {
    const el = document.getElementById('goal-progress-list');
    const s = getState();
    const goals = s.goals || [];
    if (!goals.length) {
      el.innerHTML = '<p class="empty-ash">no active goals — add some in Goals tab</p>';
      return;
    }
    el.innerHTML = goals
      .map((goal) => {
        const progress = s.safeProgress(goal.logged_hours, goal.total_hours);
        const dl = new Date(goal.deadline);
        const created = new Date(goal.created_at || Date.now());
        const daysLeft = s.isValidDate(dl) ? Math.ceil((dl - Date.now()) / 86400000) : 0;
        const totalDays = Math.max(1, (dl - created) / 86400000);
        const expected = Math.min(100, Math.max(0, (1 - Math.max(0, daysLeft) / totalDays) * 100));
        const diff = progress - expected;
        let barColor = '#22c55e';
        if (diff < -15) barColor = '#ef4444';
        else if (diff < 0) barColor = '#eab308';
        let badgeClass = 'ok';
        let badgeText = `${daysLeft}d left`;
        if (daysLeft < 0) {
          badgeClass = 'overdue';
          badgeText = 'OVERDUE';
        } else if (daysLeft < 3) {
          badgeClass = 'bad';
        } else if (daysLeft <= 7) {
          badgeClass = 'warn';
        }
        return `
          <div class="goal-progress-row">
            <div class="row-head">
              <span>${s.escapeHtml(goal.title)}</span>
              <span style="font-family:var(--font-mono);font-weight:600">${progress}%</span>
              <span class="days-badge ${badgeClass}">${badgeText}</span>
            </div>
            <div class="goal-bar-track">
              <div class="goal-bar-fill animate" style="width:${progress}%;background:${barColor}"></div>
              <div class="goal-pace-marker" style="left:${expected}%"></div>
            </div>
          </div>`;
      })
      .join('');
    requestAnimationFrame(() => {
      el.querySelectorAll('.goal-bar-fill').forEach((bar) => {
        const w = bar.style.width;
        bar.style.width = '0';
        requestAnimationFrame(() => {
          bar.style.width = w;
        });
      });
    });
  }

  function renderFocusBars(counts, labels) {
    const el = document.getElementById('focus-bars-chart');
    const max = Math.max(1, ...counts);
    const h = 120;
    const w = 400;
    const barW = 36;
    const gap = 20;
    const startX = 40;
    const isToday = (i) => i === counts.length - 1;
    let bars = '';
    counts.forEach((c, i) => {
      const bh = (c / max) * (h - 20);
      const x = startX + i * (barW + gap);
      const y = h - bh;
      const bright = isToday(i) ? '#fb923c' : '#f97316';
      bars += `<g class="bar-chart-day grow" style="transition-delay:${i * 0.05}s">
        <rect x="${x}" y="${y}" width="${barW}" height="${bh}" rx="4" fill="${bright}" opacity="${isToday(i) ? 1 : 0.75}">
          <title>${labels[i]}: ${c} sessions</title>
        </rect>
        ${isToday(i) && c ? `<circle cx="${x + barW / 2}" cy="${y - 6}" r="4" fill="#fff"/>` : ''}
        <text x="${x + barW / 2}" y="${h + 14}" text-anchor="middle" fill="#71717a" font-size="10">${labels[i]}</text>
        ${c ? `<text x="${x + barW / 2}" y="${y - 8}" text-anchor="middle" fill="#fafafa" font-size="10">${c}</text>` : ''}
      </g>`;
    });
    el.innerHTML = `<svg viewBox="0 0 ${w} ${h + 24}" style="width:100%;max-width:480px;height:${h + 24}px">${bars}
      ${[0, max].map((n, i) => `<text x="8" y="${h - (n / max) * (h - 20) + 4}" fill="#52525b" font-size="9">${n}</text>`).join('')}
    </svg>`;
  }

  function renderWeekSummary(weekSessions, weekDoom) {
    const cols = document.getElementById('week-summary-cols');
    const text = document.getElementById('week-summary-text');
    if (!cols || !text) return;

    let bestDay = '—';
    let best = 0;
    weekSessions.forEach((c, i) => {
      if (c > best) {
        best = c;
        const d = new Date();
        d.setDate(d.getDate() + i - 6);
        bestDay = d.toLocaleDateString('en-US', { weekday: 'long' });
      }
    });

    const daysWithHabit = weekDoom.filter((_, i) => i < 7 && (i === 6 ? habitsDoneOnDay(0) >= habitsTotalToday() * 0.5 : sessionsByDay(i - 6) > 0)).length;
    const habitRate = Math.round((daysWithHabit / 7) * 100);
    const weekHours = (getState().goals || []).reduce((s, g) => s + (Number(g.logged_hours) || 0), 0);

    cols.innerHTML = `
      <div class="col"><div class="k">Best day</div><div class="v">${bestDay}</div></div>
      <div class="col"><div class="k">Habit rate</div><div class="v">${habitRate}%</div></div>
      <div class="col"><div class="k">Hours logged</div><div class="v">${Math.round(weekHours * 10) / 10}h</div></div>`;

    const doom = getState().calculateDoom();
    const totalSessions = weekSessions.reduce((a, b) => a + b, 0);
    if (totalSessions === 0 && !habitsDoneOnDay(0)) {
      text.textContent = 'Quiet week so far. One habit or one focus block changes the whole picture.';
    } else if (doom <= 25) {
      text.textContent = `Strong stretch. ${totalSessions} focus block${totalSessions !== 1 ? 's' : ''} logged. Doom stayed in the green zone.`;
    } else if (doom <= 60) {
      text.textContent = `Mixed week — ${totalSessions} sessions in. A couple of goals need a deliberate push before the weekend.`;
    } else {
      text.textContent = `Falling behind on momentum. ${totalSessions} sessions isn't enough for where you want to be — pick one goal and go deep tomorrow.`;
    }
  }

  function refreshAll() {
    enhanceDoomMeter();
    updateSidebarOrbit();
    updateOrbitScoreCard();
    decorateChecklistItems();
    decorateGoalCards();
    decorateVisions();
    updatePomodoroRing();
    const overview = document.getElementById('screen-overview');
    if (overview && overview.classList.contains('active')) {
      renderOverviewDashboard();
    }
  }

  function initDOM() {
    const doomTop = document.getElementById('doom-meter-top');
    if (doomTop && !doomTop.querySelector('.doom-meter-inner')) {
      doomTop.innerHTML = `<div class="doom-glow-layer"></div><div class="doom-meter-inner">
        <span class="doom-label-text">Doom</span>
        <div class="doom-bar-wrap"><div class="doom-bar" id="doom-bar">
          <div class="doom-fill doom-fill-animate-in" id="doom-fill" style="width:0"></div>
          <div class="doom-fill-shine" id="doom-fill-shine" style="width:0"></div>
        </div></div>
        <span class="doom-value" id="doom-value">0%</span>
      </div>`;
    }

    const sidebarHeader = document.querySelector('.sidebar-header .logo');
    if (sidebarHeader && !document.getElementById('logo-streak-ring')) {
      sidebarHeader.innerHTML = `
        <div class="logo-wrap">
          <div class="logo-ring-wrap">
            <svg class="logo-streak-ring" viewBox="0 0 52 52">
              <circle class="track" cx="26" cy="26" r="22"/>
              <circle class="fill" id="logo-streak-fill" cx="26" cy="26" r="22"/>
            </svg>
            <div class="logo-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/>
                <line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/>
                <line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/>
              </svg>
            </div>
          </div>
          <span class="logo-text">ORBIT</span>
          <span class="orbit-points-today" id="orbit-points-today">0 orbit points today</span>
        </div>`;
    }

    const todayScreen = document.getElementById('screen-today');
    if (todayScreen && !document.getElementById('orbit-score-card')) {
      const hud = document.createElement('div');
      hud.className = 'orbit-score-card';
      hud.id = 'orbit-score-card';
      hud.innerHTML = `
        <div class="orbit-score-title">Today's Orbit Score</div>
        <div class="orbit-score-grid">
          <div class="orbit-score-stat"><div class="val" data-orbit-habits>0/0</div><div class="lbl">Habits</div></div>
          <div class="orbit-score-stat"><div class="val" data-orbit-sessions>0</div><div class="lbl">Focus</div></div>
          <div class="orbit-score-stat"><div class="val" data-orbit-hours>0</div><div class="lbl">Hours</div></div>
          <div class="orbit-score-stat points"><div class="val" data-orbit-points>0</div><div class="lbl">Points</div></div>
        </div>`;
      const grid = todayScreen.querySelector('.today-grid');
      todayScreen.insertBefore(hud, grid);
    }

    const pomodoro = document.querySelector('.pomodoro');
    if (pomodoro && !document.getElementById('pomodoro-ring-progress')) {
      pomodoro.classList.add('pomodoro-stage');
      const time = document.getElementById('pomodoro-time');
      const label = document.getElementById('pomodoro-label');
      const controls = document.querySelector('.pomodoro-controls');
      pomodoro.innerHTML = `
        <svg class="pomodoro-ring-svg" viewBox="0 0 220 220">
          <circle class="track" cx="110" cy="110" r="98"/>
          <circle class="progress" id="pomodoro-ring-progress" cx="110" cy="110" r="98"/>
        </svg>
        <div class="pomodoro-center"></div>`;
      const center = pomodoro.querySelector('.pomodoro-center');
      if (time) center.appendChild(time);
      if (label) center.appendChild(label);
      if (controls) pomodoro.appendChild(controls);
      const sessions = pomodoro.querySelector('.pomodoro-sessions');
      if (sessions) pomodoro.appendChild(sessions);
    }

    if (!document.getElementById('session-complete-overlay')) {
      const ov = document.createElement('div');
      ov.id = 'session-complete-overlay';
      ov.className = 'session-complete-overlay';
      ov.innerHTML = '<h2>SESSION COMPLETE</h2><p class="session-pts">+25 orbit points</p>';
      document.body.appendChild(ov);
    }

    const overviewScreen = document.getElementById('screen-overview');
    if (overviewScreen) {
      overviewScreen.innerHTML = '<div class="overview-dashboard" id="overview-dashboard"></div>';
    }

    if (!document.getElementById('chat-show-fab')) {
      /* removed per spec */
    }
  }

  function hookPomodoroObserver() {
    const timeEl = document.getElementById('pomodoro-time');
    if (!timeEl) return;
    const obs = new MutationObserver(() => updatePomodoroRing());
    obs.observe(timeEl, { childList: true, characterData: true, subtree: true });
  }

  function waitForOrbit() {
    if (window.ORBIT) {
      initDOM();
      initChatUI();
      hookPomodoroObserver();
      refreshAll();
      setTimeout(refreshAll, 100);
      return;
    }
    setTimeout(waitForOrbit, 50);
  }

  window.addEventListener('orbit:refresh', refreshAll);
  window.addEventListener('orbit:overview', renderOverviewDashboard);
  window.addEventListener('orbit:habitComplete', (e) => {
    habitPointsToday += 10;
    localStorage.setItem('orbit_habit_points_ui', String(habitPointsToday));
    const row = document.querySelector(`.checklist-item[data-id="${e.detail?.id}"]`);
    if (row) {
      row.classList.add('just-completed');
      showPointsFloat(row);
      setTimeout(() => row.classList.remove('just-completed'), 500);
    }
    refreshAll();
  });
  window.addEventListener('orbit:sessionComplete', showSessionComplete);

  document.querySelectorAll('.nav-item[data-screen]').forEach((btn) => {
    btn.addEventListener('click', () => {
      setTimeout(() => {
        if (btn.dataset.screen === 'overview') renderOverviewDashboard();
        refreshAll();
      }, 50);
    });
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', waitForOrbit);
  } else {
    waitForOrbit();
  }
})();
