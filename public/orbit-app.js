// ORBIT application logic
(function () {
  const STORAGE_KEYS = {
    CHECKLIST: 'orbit_checklist',
    DAILY_CHECKLIST: 'orbit_daily_checklist',
    TODAY_CHECKLIST: 'orbit_today_checklist',
    DAILY_RESET_DATE: 'orbit_daily_reset_date',
    GOALS: 'orbit_goals',
    VISIONS: 'orbit_visions',
    SESSIONS: 'orbit_sessions',
    MEMORY: 'orbit_memory',
    CHAT_HISTORY: 'orbit_chat',
    CHAT_OPEN: 'orbit_chat_open',
  };

  const DOOM_RGBA = {
    safe: '34, 197, 94',
    rising: '234, 179, 8',
    warning: '249, 115, 22',
    danger: '239, 68, 68',
    critical: '220, 38, 38',
  };

  const WELCOME_MESSAGE =
    "You made it here. That counts. Dump whatever's actually in your head — no performance, no bullet points required.";

  function loadData(key, defaultValue = []) {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : defaultValue;
    } catch {
      return defaultValue;
    }
  }

  function saveData(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (err) {
      console.error('Failed to save data:', err);
    }
  }

  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2);
  }

  function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function safeProgress(loggedHours, totalHours) {
    const total = Math.max(0.01, Number(totalHours) || 0);
    const logged = Math.max(0, Number(loggedHours) || 0);
    return Math.min(100, Math.round((logged / total) * 100));
  }

  function isValidDate(date) {
    return date instanceof Date && !Number.isNaN(date.getTime());
  }

  function getDoomRgba(doom) {
    if (doom <= 25) return DOOM_RGBA.safe;
    if (doom <= 50) return DOOM_RGBA.rising;
    if (doom <= 70) return DOOM_RGBA.warning;
    if (doom <= 85) return DOOM_RGBA.danger;
    return DOOM_RGBA.critical;
  }

  function migrateChecklists() {
    let daily = loadData(STORAGE_KEYS.DAILY_CHECKLIST, null);
    let today = loadData(STORAGE_KEYS.TODAY_CHECKLIST, null);

    if (daily === null && today === null) {
      const legacy = loadData(STORAGE_KEYS.CHECKLIST, []);
      daily = legacy.filter((i) => i.repeat === 'daily').map((i) => ({
        id: i.id,
        title: i.title,
        completed: false,
        completed_at: null,
        linked_goal_id: i.linked_goal_id || null,
      }));
      today = legacy
        .filter((i) => i.repeat !== 'daily')
        .filter((i) => {
          const d = new Date(i.due_date);
          return isValidDate(d) && d.toDateString() === new Date().toDateString();
        })
        .map((i) => ({
          id: i.id,
          title: i.title,
          completed: i.completed,
          completed_at: i.completed_at,
          due_date: i.due_date || new Date().toISOString(),
          linked_goal_id: i.linked_goal_id || null,
        }));
      saveData(STORAGE_KEYS.DAILY_CHECKLIST, daily);
      saveData(STORAGE_KEYS.TODAY_CHECKLIST, today);
    }

    return {
      daily: Array.isArray(daily) ? daily : [],
      today: Array.isArray(today) ? today : [],
    };
  }

  const migrated = migrateChecklists();
  let dailyChecklist = migrated.daily;
  let todayChecklist = migrated.today;
  let goals = loadData(STORAGE_KEYS.GOALS, []);
  let visions = loadData(STORAGE_KEYS.VISIONS, []);
  let sessions = loadData(STORAGE_KEYS.SESSIONS, []);
  let memory = loadData(STORAGE_KEYS.MEMORY, {});
  let chatHistory = loadData(STORAGE_KEYS.CHAT_HISTORY, []);

  let pomodoroState = {
    isRunning: false,
    timeLeft: 25 * 60,
    interval: null,
    isBreak: false,
  };

  let chatPending = false;

  const chatPanel = document.getElementById('chat-panel');
  const appBody = document.querySelector('.app-body');
  const headerChatToggle = document.getElementById('header-chat-toggle');
  const chatPanelToggle = document.getElementById('chat-panel-toggle');
  const doomMeterTop = document.getElementById('doom-meter-top');
  const doomBarEl = document.getElementById('doom-bar');
  const doomFillShine = document.getElementById('doom-fill-shine');

  function isChatOpen() {
    const stored = localStorage.getItem(STORAGE_KEYS.CHAT_OPEN);
    return stored !== 'false';
  }

  function setChatOpen(open) {
    localStorage.setItem(STORAGE_KEYS.CHAT_OPEN, open ? 'true' : 'false');
    if (!chatPanel) return;
    chatPanel.classList.toggle('collapsed', !open);
    document.body.classList.toggle('chat-open', open);
    if (chatPanelToggle) {
      chatPanelToggle.title = open ? 'Hide chat' : 'Show chat';
      chatPanelToggle.setAttribute('aria-label', open ? 'Hide chat' : 'Show chat');
    }
    if (headerChatToggle) headerChatToggle.classList.toggle('active', open);
  }

  function toggleChatPanel() {
    if (!chatPanel) return;
    setChatOpen(chatPanel.classList.contains('collapsed'));
  }

  setChatOpen(isChatOpen());
  if (chatPanelToggle) chatPanelToggle.addEventListener('click', () => setChatOpen(false));

  function getTodayDateString() {
    return new Date().toDateString();
  }

  function isTodayChecklistItem(item) {
    const itemDate = new Date(item.due_date);
    return isValidDate(itemDate) && itemDate.toDateString() === getTodayDateString();
  }

  function getCombinedTodayTasks() {
    return [
      ...dailyChecklist.map((i) => ({ ...i, list: 'daily' })),
      ...todayChecklist.filter(isTodayChecklistItem).map((i) => ({ ...i, list: 'today' })),
    ];
  }

  function syncVisionLinkedGoals() {
    visions.forEach((vision) => {
      vision.linked_goal_ids = goals
        .filter((g) => g.linked_vision_id === vision.id)
        .map((g) => g.id);
    });
    saveData(STORAGE_KEYS.VISIONS, visions);
  }

  function updateMemory() {
    const now = new Date();
    const today = now.toDateString();
    const combined = getCombinedTodayTasks();
    const todaySessions = sessions.filter((s) => {
      const logged = new Date(s.logged_at);
      return isValidDate(logged) && logged.toDateString() === today && s.type === 'pomodoro';
    });

    memory = {
      last_updated: now.toISOString(),
      doom_level: calculateDoom(),
      goals_count: goals.length,
      visions_count: visions.length,
      today_tasks_total: combined.length,
      today_tasks_done: combined.filter((i) => i.completed).length,
      daily_tasks_total: dailyChecklist.length,
      daily_tasks_done: dailyChecklist.filter((i) => i.completed).length,
      pomodoros_today: todaySessions.length,
      total_hours_logged: goals.reduce((sum, g) => sum + (Number(g.logged_hours) || 0), 0),
    };
    saveData(STORAGE_KEYS.MEMORY, memory);
  }

  function resetDailyChecklistIfNewDay() {
    const today = getTodayDateString();
    const lastReset = localStorage.getItem(STORAGE_KEYS.DAILY_RESET_DATE);
    if (lastReset === today) return;

    dailyChecklist.forEach((item) => {
      item.completed = false;
      item.completed_at = null;
    });
    saveData(STORAGE_KEYS.DAILY_CHECKLIST, dailyChecklist);
    localStorage.setItem(STORAGE_KEYS.DAILY_RESET_DATE, today);
  }

  function creditPomodoroHours(minutes) {
    const hours = minutes / 60;
    const activeGoals = goals.filter((g) => safeProgress(g.logged_hours, g.total_hours) < 100);
    if (activeGoals.length === 0) return;

    let target = activeGoals[0];
    let maxBehind = -Infinity;

    activeGoals.forEach((goal) => {
      const deadline = new Date(goal.deadline);
      const created = new Date(goal.created_at || Date.now());
      if (!isValidDate(deadline)) return;
      const totalDays = Math.max(1, (deadline - created) / 86400000);
      const daysLeft = Math.max(0, (deadline - Date.now()) / 86400000);
      const expected = Math.min(1, Math.max(0, 1 - daysLeft / totalDays));
      const actual =
        (Number(goal.logged_hours) || 0) / Math.max(0.01, Number(goal.total_hours) || 1);
      const behind = expected - actual;
      if (behind > maxBehind) {
        maxBehind = behind;
        target = goal;
      }
    });

    target.logged_hours = (Number(target.logged_hours) || 0) + hours;
    saveData(STORAGE_KEYS.GOALS, goals);
    renderGoals();
  }

  function calculateDoom() {
    if (goals.length === 0) return 0;

    let totalDoom = 0;
    const now = new Date();

    goals.forEach((goal) => {
      const deadline = new Date(goal.deadline);
      if (!isValidDate(deadline)) return;

      const created = new Date(goal.created_at || now);
      const totalDays = Math.max(1, (deadline - created) / 86400000);
      const daysLeft = Math.max(0, (deadline - now) / 86400000);
      const elapsed = Math.max(0, totalDays - daysLeft);
      const expectedProgress = Math.min(1, elapsed / totalDays);
      const progress =
        (Number(goal.logged_hours) || 0) / Math.max(0.01, Number(goal.total_hours) || 1);
      const behindBy = Math.max(0, expectedProgress - progress);
      const priorityMultiplier = (Number(goal.priority) || 1) / 2;

      totalDoom += behindBy * priorityMultiplier * 100;
    });

    const combined = getCombinedTodayTasks();
    if (combined.length > 0) {
      const completedRatio = combined.filter((i) => i.completed).length / combined.length;
      totalDoom += (1 - completedRatio) * 10;
    }

    return Math.min(100, Math.round(totalDoom / Math.max(1, goals.length)));
  }

  function getDoomColor(doom) {
    if (doom <= 25) return 'var(--doom-safe)';
    if (doom <= 50) return 'var(--doom-rising)';
    if (doom <= 75) return 'var(--doom-warning)';
    return 'var(--doom-critical)';
  }

  function updateDoomMeter() {
    const doom = calculateDoom();
    const color = getDoomColor(doom);

    document.getElementById('doom-value').textContent = `${doom}%`;
    document.getElementById('doom-value').style.color = color;

    const fill = document.getElementById('doom-fill');
    fill.style.width = `${doom}%`;
    fill.style.background = color;

    fill.classList.remove('doom-fill-hot', 'doom-fill-critical');
    if (doom > 75) fill.classList.add('doom-fill-critical');
    else if (doom > 50) fill.classList.add('doom-fill-hot');

    if (doomFillShine) {
      doomFillShine.style.width = `${doom}%`;
      doomFillShine.classList.toggle('doom-fill-hot', doom > 50);
    }

    if (doomBarEl) {
      doomBarEl.classList.remove('doom-bar-safe', 'doom-bar-amber', 'doom-bar-red', 'doom-bar-critical', 'doom-bar-hot');
      if (doom > 75) doomBarEl.classList.add('doom-bar-critical');
      else if (doom > 50) doomBarEl.classList.add('doom-bar-red');
      else if (doom > 25) doomBarEl.classList.add('doom-bar-amber');
      else doomBarEl.classList.add('doom-bar-safe');
    }
    if (doomMeterTop) {
      doomMeterTop.classList.toggle('doom-ambient-hot', doom > 75);
    }

    // Update doom tooltip
    updateDoomTooltip(doom);

    // Update onboarding banner
    updateOnboardingBanner();

    updateMemory();
    window.dispatchEvent(new CustomEvent('orbit:refresh'));
  }

  function updateDoomTooltip(doom) {
    const tooltipHours = document.getElementById('tooltip-hours');
    const tooltipGoals = document.getElementById('tooltip-goals');
    if (!tooltipHours || !tooltipGoals) return;

    // Calculate hours behind expected pace
    let totalHoursBehind = 0;
    let goalsNeedingAttention = 0;
    const now = new Date();

    goals.forEach((goal) => {
      const deadline = new Date(goal.deadline);
      if (!isValidDate(deadline)) return;

      const created = new Date(goal.created_at || now);
      const totalDays = Math.max(1, (deadline - created) / 86400000);
      const daysLeft = Math.max(0, (deadline - now) / 86400000);
      const elapsed = Math.max(0, totalDays - daysLeft);
      const expectedProgress = Math.min(1, elapsed / totalDays);
      const expectedHours = expectedProgress * (Number(goal.total_hours) || 1);
      const actualHours = Number(goal.logged_hours) || 0;
      const hoursBehind = Math.max(0, expectedHours - actualHours);

      if (hoursBehind > 0.5) {
        totalHoursBehind += hoursBehind;
        goalsNeedingAttention++;
      }
    });

    tooltipHours.textContent = `${Math.round(totalHoursBehind * 10) / 10} hours behind expected pace`;
    tooltipGoals.textContent = `${goalsNeedingAttention} goals need attention`;
  }

  function updateOnboardingBanner() {
    const banner = document.getElementById('doom-onboarding-banner');
    if (!banner) return;

    const hasDismissed = localStorage.getItem('orbit_doom_banner_dismissed') === 'true';
    if (hasDismissed) {
      banner.classList.remove('visible');
      return;
    }

    if (goals.length === 0) {
      banner.classList.add('visible');
    } else {
      banner.classList.remove('visible');
    }
  }

  function initTestMode() {
    const urlParams = new URLSearchParams(window.location.search);
    const isTestMode = urlParams.get('test') === 'true';
    const testPanel = document.getElementById('test-mode-panel');

    if (!testPanel) return;

    if (isTestMode) {
      testPanel.classList.add('visible');

      document.getElementById('test-add-goal').addEventListener('click', () => {
        const deadline = new Date();
        deadline.setDate(deadline.getDate() + 7);
        goals.push({
          id: generateId(),
          title: 'Test Goal',
          subject: 'Testing',
          total_hours: 20,
          logged_hours: 0,
          deadline: deadline.toISOString().split('T')[0],
          priority: 2,
          linked_vision_id: null,
          created_at: new Date().toISOString(),
        });
        saveData(STORAGE_KEYS.GOALS, goals);
        renderGoals();
        updateDoomMeter();
      });

      document.getElementById('test-simulate-days').addEventListener('click', () => {
        goals.forEach((goal) => {
          const created = new Date(goal.created_at || Date.now());
          created.setDate(created.getDate() - 3);
          goal.created_at = created.toISOString();
        });
        saveData(STORAGE_KEYS.GOALS, goals);
        renderGoals();
        updateDoomMeter();
      });

      document.getElementById('test-log-progress').addEventListener('click', () => {
        const activeGoals = goals.filter((g) => safeProgress(g.logged_hours, g.total_hours) < 100);
        if (activeGoals.length > 0) {
          activeGoals[0].logged_hours = (Number(activeGoals[0].logged_hours) || 0) + 2;
          saveData(STORAGE_KEYS.GOALS, goals);
          renderGoals();
          updateDoomMeter();
        }
      });

      document.getElementById('test-reset').addEventListener('click', () => {
        goals = [];
        saveData(STORAGE_KEYS.GOALS, goals);
        renderGoals();
        updateDoomMeter();
      });
    }
  }

  const navItems = document.querySelectorAll('.nav-item[data-screen]');
  const mobileNavItems = document.querySelectorAll('.mobile-nav .nav-item[data-screen]');
  const screens = document.querySelectorAll('.screen');
  const mainTitle = document.getElementById('main-title');
  const mainSubtitle = document.getElementById('main-subtitle');

  const screenTitles = {
    today: { title: 'Today', subtitle: '' },
    goals: { title: 'Goals', subtitle: 'Your short-term targets' },
    vision: { title: 'Life Vision', subtitle: 'The big picture' },
    overview: { title: 'Overview', subtitle: 'Your life at a glance' },
  };

  function setDateSubtitle() {
    const now = new Date();
    const options = { weekday: 'long', month: 'long', day: 'numeric' };
    mainSubtitle.textContent = now.toLocaleDateString('en-US', options);
  }

  function navigateToScreen(screen, activeItem) {
    navItems.forEach((nav) => nav.classList.remove('active'));
    mobileNavItems.forEach((nav) => nav.classList.remove('active'));

    if (activeItem) activeItem.classList.add('active');

    document
      .querySelectorAll(`.nav-item[data-screen="${screen}"]`)
      .forEach((el) => el.classList.add('active'));

    screens.forEach((s) => s.classList.remove('active'));
    document.getElementById(`screen-${screen}`).classList.add('active');

    const info = screenTitles[screen];
    mainTitle.textContent = info.title;

    if (screen === 'today') {
      setDateSubtitle();
    } else {
      mainSubtitle.textContent = info.subtitle;
    }

    if (screen === 'overview') {
      renderOverview();
      window.dispatchEvent(new CustomEvent('orbit:overview'));
    }
    window.dispatchEvent(new CustomEvent('orbit:refresh'));
  }

  function bindNav(items) {
    items.forEach((item) => {
      item.addEventListener('click', () => navigateToScreen(item.dataset.screen, item));
    });
  }

  bindNav(navItems);
  bindNav(mobileNavItems);

  setDateSubtitle();

  const dailyChecklistContainer = document.getElementById('daily-checklist-items');
  const todayChecklistContainer = document.getElementById('today-checklist-items');
  const dailyChecklistForm = document.getElementById('add-daily-checklist-form');
  const todayChecklistForm = document.getElementById('add-today-checklist-form');
  const dailyChecklistInput = document.getElementById('daily-checklist-input');
  const todayChecklistInput = document.getElementById('today-checklist-input');
  const dailyChecklistCount = document.getElementById('daily-checklist-count');
  const todayChecklistCount = document.getElementById('today-checklist-count');

  function renderChecklistItems(container, items, listType, emptyTitle, emptyHint) {
    if (items.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 11l3 3L22 4"/>
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
          </svg>
          <h3>${emptyTitle}</h3>
          <p>${emptyHint}</p>
        </div>
      `;
      return;
    }

    container.innerHTML = items
      .map(
        (item) => `
        <div class="checklist-item ${item.completed ? 'completed' : ''}" data-id="${escapeHtml(item.id)}" data-list="${listType}">
          <div class="checklist-checkbox ${item.completed ? 'checked' : ''}" data-action="toggle-checklist">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
              <polyline points="20,6 9,17 4,12"/>
            </svg>
          </div>
          <span class="checklist-text">${escapeHtml(item.title)}</span>
          ${item.linked_goal_id ? `<span class="checklist-tag">${escapeHtml(getGoalTitle(item.linked_goal_id))}</span>` : ''}
          <button type="button" class="checklist-delete" data-action="delete-checklist" aria-label="Delete task">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      `,
      )
      .join('');
  }

  function renderDailyChecklist() {
    const completed = dailyChecklist.filter((i) => i.completed).length;
    dailyChecklistCount.textContent = `${completed}/${dailyChecklist.length}`;
    renderChecklistItems(
      dailyChecklistContainer,
      dailyChecklist,
      'daily',
      'No daily habits yet',
      'Add once — they come back unchecked each morning',
    );
  }

  function renderTodayChecklist() {
    const items = todayChecklist.filter(isTodayChecklistItem);
    const completed = items.filter((i) => i.completed).length;
    todayChecklistCount.textContent = `${completed}/${items.length}`;
    renderChecklistItems(
      todayChecklistContainer,
      items,
      'today',
      'Nothing for today',
      'Tasks here are only for today',
    );
  }

  function renderChecklists() {
    resetDailyChecklistIfNewDay();
    renderDailyChecklist();
    renderTodayChecklist();
    window.dispatchEvent(new CustomEvent('orbit:refresh'));
  }

  function getGoalTitle(goalId) {
    const goal = goals.find((g) => g.id === goalId);
    if (!goal) return '';
    const title = goal.title;
    return title.length > 15 ? title.substring(0, 15) + '...' : title;
  }

  function toggleChecklistItem(listType, id) {
    const list = listType === 'daily' ? dailyChecklist : todayChecklist;
    const item = list.find((i) => i.id === id);
    if (!item) return;
    const wasCompleted = item.completed;
    item.completed = !item.completed;
    item.completed_at = item.completed ? new Date().toISOString() : null;
    if (listType === 'daily') {
      saveData(STORAGE_KEYS.DAILY_CHECKLIST, dailyChecklist);
    } else {
      saveData(STORAGE_KEYS.TODAY_CHECKLIST, todayChecklist);
    }
    renderChecklists();
    updateDoomMeter();
    if (item.completed && !wasCompleted) {
      window.dispatchEvent(
        new CustomEvent('orbit:habitComplete', { detail: { id, listType } }),
      );
    }
  }

  function deleteChecklistItem(listType, id) {
    if (listType === 'daily') {
      dailyChecklist = dailyChecklist.filter((i) => i.id !== id);
      saveData(STORAGE_KEYS.DAILY_CHECKLIST, dailyChecklist);
    } else {
      todayChecklist = todayChecklist.filter((i) => i.id !== id);
      saveData(STORAGE_KEYS.TODAY_CHECKLIST, todayChecklist);
    }
    renderChecklists();
    updateDoomMeter();
  }

  function bindChecklistContainer(container) {
    container.addEventListener('click', (e) => {
      const row = e.target.closest('.checklist-item');
      if (!row) return;
      const id = row.dataset.id;
      const listType = row.dataset.list;
      if (e.target.closest('[data-action="delete-checklist"]')) {
        deleteChecklistItem(listType, id);
      } else if (e.target.closest('[data-action="toggle-checklist"]')) {
        toggleChecklistItem(listType, id);
      }
    });
  }

  bindChecklistContainer(dailyChecklistContainer);
  bindChecklistContainer(todayChecklistContainer);

  dailyChecklistForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = dailyChecklistInput.value.trim();
    if (!title) return;

    dailyChecklist.push({
      id: generateId(),
      title,
      completed: false,
      completed_at: null,
      linked_goal_id: null,
    });
    saveData(STORAGE_KEYS.DAILY_CHECKLIST, dailyChecklist);
    dailyChecklistInput.value = '';
    renderChecklists();
    updateDoomMeter();
  });

  todayChecklistForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = todayChecklistInput.value.trim();
    if (!title) return;

    todayChecklist.push({
      id: generateId(),
      title,
      due_date: new Date().toISOString(),
      completed: false,
      completed_at: null,
      linked_goal_id: null,
    });
    saveData(STORAGE_KEYS.TODAY_CHECKLIST, todayChecklist);
    todayChecklistInput.value = '';
    renderChecklists();
    updateDoomMeter();
  });

  const pomodoroTime = document.getElementById('pomodoro-time');
  const pomodoroLabel = document.getElementById('pomodoro-label');
  const pomodoroStart = document.getElementById('pomodoro-start');
  const pomodoroReset = document.getElementById('pomodoro-reset');
  const sessionDots = document.getElementById('session-dots');

  function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  function renderSessionDots() {
    const today = new Date().toDateString();
    const todaySessions = sessions.filter((s) => {
      const logged = new Date(s.logged_at);
      return isValidDate(logged) && logged.toDateString() === today && s.type === 'pomodoro';
    });

    const dots = [];
    for (let i = 0; i < 8; i++) {
      dots.push(
        `<div class="session-dot ${i < todaySessions.length ? 'completed' : ''}"></div>`,
      );
    }
    sessionDots.innerHTML = dots.join('');
  }

  function updatePomodoroDisplay() {
    pomodoroTime.textContent = formatTime(pomodoroState.timeLeft);
    pomodoroLabel.textContent = pomodoroState.isBreak ? 'Break Time' : 'Focus Session';
    pomodoroStart.textContent = pomodoroState.isRunning ? 'Pause' : 'Start';
  }

  function onPomodoroTick() {
    pomodoroState.timeLeft--;

    if (pomodoroState.timeLeft > 0) {
      updatePomodoroDisplay();
      return;
    }

    clearInterval(pomodoroState.interval);
    pomodoroState.interval = null;

    if (!pomodoroState.isBreak) {
      sessions.push({
        id: generateId(),
        duration_minutes: 25,
        quest_id: null,
        habit_id: null,
        note: '',
        logged_at: new Date().toISOString(),
        type: 'pomodoro',
      });
      saveData(STORAGE_KEYS.SESSIONS, sessions);
      renderSessionDots();
      creditPomodoroHours(25);
      updateDoomMeter();
      window.dispatchEvent(new CustomEvent('orbit:sessionComplete'));

      pomodoroState.isBreak = true;
      pomodoroState.timeLeft = 5 * 60;
      pomodoroState.isRunning = true;
      pomodoroState.interval = setInterval(onPomodoroTick, 1000);
    } else {
      pomodoroState.isBreak = false;
      pomodoroState.timeLeft = 25 * 60;
      pomodoroState.isRunning = false;
    }

    updatePomodoroDisplay();
  }

  function startPomodoro() {
    if (pomodoroState.isRunning) {
      clearInterval(pomodoroState.interval);
      pomodoroState.interval = null;
      pomodoroState.isRunning = false;
    } else {
      pomodoroState.isRunning = true;
      pomodoroState.interval = setInterval(onPomodoroTick, 1000);
    }
    updatePomodoroDisplay();
  }

  function resetPomodoro() {
    clearInterval(pomodoroState.interval);
    pomodoroState.interval = null;
    pomodoroState.isRunning = false;
    pomodoroState.isBreak = false;
    pomodoroState.timeLeft = 25 * 60;
    updatePomodoroDisplay();
  }

  pomodoroStart.addEventListener('click', startPomodoro);
  pomodoroReset.addEventListener('click', resetPomodoro);

  renderSessionDots();
  updatePomodoroDisplay();

  const goalsGrid = document.getElementById('goals-grid');
  const addGoalBtn = document.getElementById('add-goal-btn');
  const goalModal = document.getElementById('goal-modal');
  const goalForm = document.getElementById('goal-form');
  const closeGoalModal = document.getElementById('close-goal-modal');
  const cancelGoal = document.getElementById('cancel-goal');
  const goalVisionLink = document.getElementById('goal-vision-link');

  function getPriorityLabel(priority) {
    if (priority >= 3) return { label: 'High', class: 'high' };
    if (priority >= 2) return { label: 'Medium', class: 'medium' };
    return { label: 'Low', class: 'low' };
  }

  function formatDeadline(dateStr) {
    const date = new Date(dateStr);
    if (!isValidDate(date)) return 'No date';
    const now = new Date();
    const diff = Math.ceil((date - now) / 86400000);

    if (diff < 0) return 'Overdue';
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Tomorrow';
    if (diff < 7) return `${diff} days`;
    if (diff < 30) return `${Math.ceil(diff / 7)} weeks`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function renderGoalCard(goal, showDelete) {
    const progress = safeProgress(goal.logged_hours, goal.total_hours);
    const priority = getPriorityLabel(goal.priority);
    const vision = visions.find((v) => v.id === goal.linked_vision_id);
    const visionTag = vision
      ? `<span class="goal-tag">${escapeHtml(vision.title.length > 12 ? vision.title.substring(0, 12) + '...' : vision.title)}</span>`
      : '';

    return `
      <div class="goal-card" data-id="${escapeHtml(goal.id)}">
        <div class="goal-header">
          <h3 class="goal-title">${escapeHtml(goal.title)}</h3>
          <div style="display:flex;align-items:center;gap:8px;">
            <span class="goal-priority ${priority.class}">${priority.label}</span>
            ${showDelete ? `<button type="button" class="card-delete" data-action="delete-goal" aria-label="Delete goal"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>` : ''}
          </div>
        </div>
        <div class="goal-progress">
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${progress}%"></div>
          </div>
          <div class="progress-text">
            <span>${Number(goal.logged_hours) || 0}h / ${Number(goal.total_hours) || 0}h</span>
            <span>${progress}%</span>
          </div>
        </div>
        <div class="goal-footer">
          ${goal.subject ? `<span class="goal-tag">${escapeHtml(goal.subject)}</span>` : ''}
          ${visionTag}
          <span class="goal-deadline">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="4" width="18" height="18" rx="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            ${formatDeadline(goal.deadline)}
          </span>
        </div>
      </div>
    `;
  }

  function renderGoals() {
    if (goals.length === 0) {
      goalsGrid.innerHTML = '';
      window.dispatchEvent(new CustomEvent('orbit:refresh'));
      return;
    }

    goalsGrid.innerHTML = goals.map((goal) => renderGoalCard(goal, true)).join('');
    window.dispatchEvent(new CustomEvent('orbit:refresh'));
  }

  function deleteGoal(id) {
    goals = goals.filter((g) => g.id !== id);
    saveData(STORAGE_KEYS.GOALS, goals);
    syncVisionLinkedGoals();
    renderGoals();
    updateDoomMeter();
  }

  goalsGrid.addEventListener('click', (e) => {
    if (!e.target.closest('[data-action="delete-goal"]')) return;
    const card = e.target.closest('.goal-card');
    if (card) deleteGoal(card.dataset.id);
  });

  function updateVisionSelect() {
    goalVisionLink.innerHTML =
      '<option value="">None</option>' +
      visions
        .map((v) => `<option value="${escapeHtml(v.id)}">${escapeHtml(v.title)}</option>`)
        .join('');
  }

  addGoalBtn.addEventListener('click', () => {
    updateVisionSelect();
    goalModal.classList.add('active');
  });

  closeGoalModal.addEventListener('click', () => goalModal.classList.remove('active'));
  cancelGoal.addEventListener('click', () => goalModal.classList.remove('active'));

  goalForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const totalHours = Math.max(1, parseInt(document.getElementById('goal-hours').value, 10) || 1);
    const linkedVisionId = document.getElementById('goal-vision-link').value || null;

    goals.push({
      id: generateId(),
      title: document.getElementById('goal-title').value.trim(),
      subject: document.getElementById('goal-subject').value.trim(),
      total_hours: totalHours,
      logged_hours: 0,
      deadline: document.getElementById('goal-deadline').value,
      priority: parseInt(document.getElementById('goal-priority').value, 10) || 2,
      linked_vision_id: linkedVisionId,
      created_at: new Date().toISOString(),
    });

    saveData(STORAGE_KEYS.GOALS, goals);
    syncVisionLinkedGoals();

    goalForm.reset();
    goalModal.classList.remove('active');
    renderGoals();
    updateDoomMeter();
    window.dispatchEvent(new CustomEvent('orbit:refresh'));
  });

  const visionGrid = document.getElementById('vision-grid');
  const addVisionBtn = document.getElementById('add-vision-btn');
  const visionModal = document.getElementById('vision-modal');
  const visionForm = document.getElementById('vision-form');
  const closeVisionModal = document.getElementById('close-vision-modal');
  const cancelVision = document.getElementById('cancel-vision');
  const visionYearInput = document.getElementById('vision-year');

  function renderVisions() {
    if (visions.length === 0) {
      visionGrid.innerHTML = '';
      window.dispatchEvent(new CustomEvent('orbit:refresh'));
      return;
    }

    visionGrid.innerHTML = visions
      .map((vision) => {
        const linkedGoals = goals.filter((g) => g.linked_vision_id === vision.id);

        return `
          <div class="vision-card" data-id="${escapeHtml(vision.id)}">
            <div class="vision-year">Target: ${escapeHtml(String(vision.target_year))}</div>
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
              <h3 class="vision-title">${escapeHtml(vision.title)}</h3>
              <button type="button" class="card-delete" data-action="delete-vision" aria-label="Delete vision">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            ${vision.description ? `<p class="vision-description">${escapeHtml(vision.description)}</p>` : ''}
            ${vision.why ? `<div class="vision-why"><div class="vision-why-label">Why this matters</div><div class="vision-why-text">"${escapeHtml(vision.why)}"</div></div>` : ''}
            <div class="vision-linked">
              <strong>${linkedGoals.length}</strong> goals linked to this vision
            </div>
          </div>
        `;
      })
      .join('');
    window.dispatchEvent(new CustomEvent('orbit:refresh'));
  }

  function deleteVision(id) {
    visions = visions.filter((v) => v.id !== id);
    goals.forEach((g) => {
      if (g.linked_vision_id === id) g.linked_vision_id = null;
    });
    saveData(STORAGE_KEYS.VISIONS, visions);
    saveData(STORAGE_KEYS.GOALS, goals);
    syncVisionLinkedGoals();
    renderVisions();
    renderGoals();
    updateDoomMeter();
  }

  visionGrid.addEventListener('click', (e) => {
    if (!e.target.closest('[data-action="delete-vision"]')) return;
    const card = e.target.closest('.vision-card');
    if (card) deleteVision(card.dataset.id);
  });

  addVisionBtn.addEventListener('click', () => {
    const year = new Date().getFullYear();
    visionYearInput.min = String(year);
    visionYearInput.max = String(year + 10);
    visionModal.classList.add('active');
  });

  closeVisionModal.addEventListener('click', () => visionModal.classList.remove('active'));
  cancelVision.addEventListener('click', () => visionModal.classList.remove('active'));

  visionForm.addEventListener('submit', (e) => {
    e.preventDefault();

    visions.push({
      id: generateId(),
      title: document.getElementById('vision-title').value.trim(),
      description: document.getElementById('vision-description').value.trim(),
      why: document.getElementById('vision-why').value.trim(),
      target_year: parseInt(document.getElementById('vision-year').value, 10),
      status: 'active',
      linked_goal_ids: [],
    });

    saveData(STORAGE_KEYS.VISIONS, visions);
    visionForm.reset();
    visionModal.classList.remove('active');
    renderVisions();
    updateDoomMeter();
  });

  function renderOverview() {
    window.dispatchEvent(new CustomEvent('orbit:overview'));
  }

  const chatMessages = document.getElementById('chat-messages');
  const chatForm = document.getElementById('chat-form');
  const chatInput = document.getElementById('chat-input');

  function addMessage(content, isUser = false) {
    const div = document.createElement('div');
    div.className = `message ${isUser ? 'user' : 'ai'}`;
    div.textContent = content;
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function addTypingIndicator() {
    const div = document.createElement('div');
    div.className = 'message ai';
    div.id = 'typing-indicator';
    div.innerHTML = `
      <div class="typing-indicator">
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
      </div>
    `;
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function removeTypingIndicator() {
    const indicator = document.getElementById('typing-indicator');
    if (indicator) indicator.remove();
  }

  function restoreChatUI() {
    chatMessages.innerHTML = '';
    if (!Array.isArray(chatHistory) || chatHistory.length === 0) {
      addMessage(WELCOME_MESSAGE, false);
      return;
    }
    chatHistory.forEach((msg) => {
      if (msg && typeof msg.content === 'string') {
        addMessage(msg.content, msg.role === 'user');
      }
    });
  }

  function buildSystemPrompt() {
    const now = new Date();
    const today = now.toDateString();

    const combined = getCombinedTodayTasks();
    const completedItems = combined.filter((i) => i.completed);
    const pendingItems = combined.filter((i) => !i.completed);
    const doom = calculateDoom();

    return `You are ORBIT — a life companion AI. Not a productivity coach. Not a therapist. A genuine friend who happens to know everything about what the user is working toward.

Now: ${now.toLocaleString()}

USER CONTEXT (from memory):
${JSON.stringify(memory, null, 2)}

LIFE VISION:
${visions.map((v) => `- ${v.title} (Target: ${v.target_year}) - "${v.why || 'No reason specified'}"`).join('\n') || 'No visions set yet'}

ACTIVE GOALS:
${
  goals
    .map((g) => {
      const progress = safeProgress(g.logged_hours, g.total_hours);
      return `- ${g.title}: ${g.logged_hours}h/${g.total_hours}h (${progress}%) - Due: ${g.deadline}`;
    })
    .join('\n') || 'No goals set yet'
}

DAILY CHECKLIST (resets each morning):
Done: ${dailyChecklist.filter((i) => i.completed).map((i) => i.title).join(', ') || 'None yet'}
Pending: ${dailyChecklist.filter((i) => !i.completed).map((i) => i.title).join(', ') || 'All done!'}

TODAY ONLY:
Done: ${todayChecklist.filter(isTodayChecklistItem).filter((i) => i.completed).map((i) => i.title).join(', ') || 'None yet'}
Pending: ${todayChecklist.filter(isTodayChecklistItem).filter((i) => !i.completed).map((i) => i.title).join(', ') || 'All done!'}

DOOM METER: ${doom}%

RULES:
1. Talk like a real friend first. Goals are context, not the topic.
2. Be honest. No toxic positivity. No sugarcoating either.
3. Acknowledge when they are behind — but focus on next step.
4. If they want to vent, just listen. No pivot to goals.
5. When generating plans: max 4–6h/day, realistic, no 14h grind.
6. Reference their specific vision + goals by name when relevant.
7. Keep it concise — they have a life to live.
8. Doom meter affects your tone: ${doom <= 25 ? 'Calm and casual' : doom <= 50 ? 'Gently encouraging' : doom <= 70 ? 'More direct about priorities' : 'Honest about what needs to happen'}.`;
  }

  async function sendToAI(userMessage) {
    const messagesForApi = [
      ...chatHistory.slice(-10),
      { role: 'user', content: userMessage },
    ];

    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system: buildSystemPrompt(),
        messages: messagesForApi,
      }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        typeof data.error === 'string'
          ? data.error
          : 'Could not reach ORBIT right now.',
      );
    }

    if (typeof data.message !== 'string' || !data.message.trim()) {
      throw new Error('Unexpected response from server');
    }

    return data.message;
  }

  chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (chatPending) return;

    const message = chatInput.value.trim();
    if (!message) return;

    chatPending = true;
    chatInput.disabled = true;

    addMessage(message, true);
    chatInput.value = '';

    addTypingIndicator();

    try {
      const response = await sendToAI(message);
      chatHistory.push({ role: 'user', content: message });
      chatHistory.push({ role: 'assistant', content: response });
      saveData(STORAGE_KEYS.CHAT_HISTORY, chatHistory);
      removeTypingIndicator();
      addMessage(response, false);
      updateMemory();
    } catch (error) {
      console.error('AI Error:', error);
      removeTypingIndicator();
      addMessage(
        `Sorry, I couldn't connect right now. ${error.message}`,
        false,
      );
    } finally {
      chatPending = false;
      chatInput.disabled = false;
      chatInput.focus();
    }
  });

  localStorage.removeItem('orbit_api_key');

  syncVisionLinkedGoals();
  renderChecklists();
  renderGoals();
  renderVisions();
  updateDoomMeter();
  restoreChatUI();
  window.dispatchEvent(new CustomEvent('orbit:refresh'));

  // Auto-recalculate doom every 60 seconds
  setInterval(() => {
    updateDoomMeter();
  }, 60000);

  // Initialize test mode if ?test=true in URL
  initTestMode();

  // Initialize onboarding banner close button
  const bannerClose = document.getElementById('doom-banner-close');
  if (bannerClose) {
    bannerClose.addEventListener('click', () => {
      localStorage.setItem('orbit_doom_banner_dismissed', 'true');
      const banner = document.getElementById('doom-onboarding-banner');
      if (banner) banner.classList.remove('visible');
    });
  }

  window.ORBIT = {
    getState: () => ({
      dailyChecklist,
      todayChecklist,
      goals,
      visions,
      sessions,
      memory,
      calculateDoom,
      getDoomColor,
      getCombinedTodayTasks,
      escapeHtml,
      getGoalTitle,
      safeProgress,
      isValidDate,
    }),
  };

  document.querySelectorAll('.modal-overlay').forEach((overlay) => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.classList.remove('active');
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document
        .querySelectorAll('.modal-overlay.active')
        .forEach((m) => m.classList.remove('active'));
      if (chatPanel && !chatPanel.classList.contains('collapsed')) {
        setChatOpen(false);
      }
    }
  });
})();
