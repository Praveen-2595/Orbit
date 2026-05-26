// ORBIT application logic
(function () {
  const ORBIT_LEVELS = [
    {
      min: 0, max: 99,
      id: 'drifting',
      title: 'Drifting',
      subtitle: 'finding your gravity',
      color: '#7A7A88',
      icon: '○'
    },
    {
      min: 100, max: 299,
      id: 'waking',
      title: 'Waking Up',
      subtitle: 'something is shifting',
      color: '#FBBF24',
      icon: '◐'
    },
    {
      min: 300, max: 699,
      id: 'rising',
      title: 'Rising',
      subtitle: 'momentum is building',
      color: '#FF8C00',
      icon: '◑'
    },
    {
      min: 700, max: 1499,
      id: 'inorbit',
      title: 'In Orbit',
      subtitle: 'you found your rhythm',
      color: '#A78BFA',
      icon: '◕'
    },
    {
      min: 1500, max: 2999,
      id: 'locked',
      title: 'Locked In',
      subtitle: 'nothing can stop this',
      color: '#34D399',
      icon: '●'
    },
    {
      min: 3000, max: 999999,
      id: 'unstoppable',
      title: 'Unstoppable',
      subtitle: 'you became the goal',
      color: '#FF8C00',
      icon: '★'
    },
  ];

  function getCurrentLevel(points) {
    return ORBIT_LEVELS.find(l =>
      points >= l.min && points <= l.max
    ) || ORBIT_LEVELS[0];
  }

  function getNextLevel(points) {
    const idx = ORBIT_LEVELS.findIndex(l =>
      points >= l.min && points <= l.max
    );
    return ORBIT_LEVELS[idx + 1] || null;
  }

  function getTotalPoints() {
    const sessionPoints = parseInt(localStorage.getItem('orbit_session_points_ui') || '0', 10);
    const habitPoints = parseInt(localStorage.getItem('orbit_habit_points_ui') || '0', 10);
    return sessionPoints + habitPoints;
  }

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
    STAKES: 'orbit_stakes',
    DOOM_RECOMMENDATIONS: 'orbit_doom_recommendations',
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

  // ============================================================================
  // STAKES ENGINE STORAGE LAYER
  // ============================================================================

  /**
   * Get the complete stakes data from localStorage
   * Initializes with default structure if missing
   * @returns {Object} Stakes data with life_context, goal_stakes, and onboarding_complete
   */
  function getOrbitStakes() {
    const defaultStakes = {
      life_context: {
        family_situation: "",
        financial_pressure: "",
        who_depends_on_you: "",
        biggest_fear: "",
        what_failure_looks_like: "",
        what_success_unlocks: ""
      },
      goal_stakes: {},
      onboarding_complete: false
    };
    return loadData(STORAGE_KEYS.STAKES, defaultStakes);
  }

  /**
   * Save the complete stakes data to localStorage
   * @param {Object} stakesData - Stakes data to save
   */
  function saveOrbitStakes(stakesData) {
    saveData(STORAGE_KEYS.STAKES, stakesData);
  }

  /**
   * Update or create stakes for a specific goal
   * @param {string} goalId - The goal ID
   * @param {Object} stakeData - Stake data for the goal
   * @param {string} stakeData.personal_stake - Personal stake description
   * @param {string} stakeData.consequence_if_missed - Consequence if goal is missed
   * @param {string} stakeData.who_affected - Who is affected by this goal
   * @param {number} stakeData.emotional_weight - Emotional weight (1-5)
   */
  function updateGoalStake(goalId, stakeData) {
    const currentStakes = getOrbitStakes();
    
    // Validate emotional weight is between 1-5
    const emotionalWeight = Math.max(1, Math.min(5, Number(stakeData.emotional_weight) || 3));
    
    currentStakes.goal_stakes[goalId] = {
      personal_stake: stakeData.personal_stake || "",
      consequence_if_missed: stakeData.consequence_if_missed || "",
      who_affected: stakeData.who_affected || "",
      emotional_weight: emotionalWeight
    };
    
    saveOrbitStakes(currentStakes);
    return currentStakes;
  }

  /**
   * Update the life context section of stakes
   * @param {Object} lifeContextData - Life context data to update
   * @param {string} lifeContextData.family_situation - Family situation
   * @param {string} lifeContextData.financial_pressure - Financial pressure
   * @param {string} lifeContextData.who_depends_on_you - Who depends on you
   * @param {string} lifeContextData.biggest_fear - Biggest fear
   * @param {string} lifeContextData.what_failure_looks_like - What failure looks like
   * @param {string} lifeContextData.what_success_unlocks - What success unlocks
   */
  function updateLifeContext(lifeContextData) {
    const currentStakes = getOrbitStakes();
    
    // Merge provided fields with existing life context
    currentStakes.life_context = {
      ...currentStakes.life_context,
      ...lifeContextData
    };
    
    saveOrbitStakes(currentStakes);
    return currentStakes;
  }

  // ============================================================================
  // STAKES ONBOARDING FLOW
  // ============================================================================

  const ONBOARDING_QUESTIONS = [
    {
      id: 'what_failure_looks_like',
      question: "Before we track anything — what happens to your life if you don't achieve your main goal this year?"
    },
    {
      id: 'who_affected',
      question: "Who in your life would be affected if you fail?"
    },
    {
      id: 'biggest_fear',
      question: "What does your life look like in 3 years if you keep going at your current pace — honestly?"
    },
    {
      id: 'what_success_unlocks',
      question: "What does it look like if you actually finish what you're building?"
    }
  ];

  let currentQuestionIndex = 0;
  let onboardingAnswers = {};

  function showStakesOnboarding() {
    const onboardingScreen = document.getElementById('screen-stakes-onboarding');
    const todayScreen = document.getElementById('screen-today');
    
    if (!onboardingScreen) return;
    
    // Hide all screens, show onboarding
    document.querySelectorAll('.screen').forEach(screen => {
      screen.classList.remove('active');
    });
    onboardingScreen.classList.add('active');
    
    // Reset state
    currentQuestionIndex = 0;
    onboardingAnswers = {};
    
    // Show first question
    showQuestion(0);
  }

  function showQuestion(index) {
    const questionEl = document.getElementById('stakes-question');
    const answerEl = document.getElementById('stakes-answer');
    const progressFill = document.getElementById('stakes-progress-fill');
    const progressText = document.getElementById('stakes-progress-text');
    
    if (!questionEl || !answerEl || !progressFill || !progressText) return;
    
    const question = ONBOARDING_QUESTIONS[index];
    
    // Update question with animation
    questionEl.style.animation = 'none';
    questionEl.offsetHeight; // Trigger reflow
    questionEl.style.animation = 'slide-up 0.5s ease forwards';
    questionEl.textContent = question.question;
    
    // Clear answer
    answerEl.value = '';
    answerEl.focus();
    
    // Update progress
    const progress = ((index + 1) / ONBOARDING_QUESTIONS.length) * 100;
    progressFill.style.width = `${progress}%`;
    progressText.textContent = `Question ${index + 1} of ${ONBOARDING_QUESTIONS.length}`;
  }

  function handleContinue() {
    const answerEl = document.getElementById('stakes-answer');
    if (!answerEl) return;
    
    const currentQuestion = ONBOARDING_QUESTIONS[currentQuestionIndex];
    const answer = answerEl.value.trim();
    
    // Save answer
    onboardingAnswers[currentQuestion.id] = answer;
    
    // Move to next question or complete
    if (currentQuestionIndex < ONBOARDING_QUESTIONS.length - 1) {
      currentQuestionIndex++;
      showQuestion(currentQuestionIndex);
    } else {
      completeOnboarding();
    }
  }

  function handleSkip() {
    // Skip remaining questions and complete
    completeOnboarding();
  }

  function completeOnboarding() {
    // Save all answers to life_context
    updateLifeContext(onboardingAnswers);
    
    // Mark onboarding as complete
    const currentStakes = getOrbitStakes();
    currentStakes.onboarding_complete = true;
    saveOrbitStakes(currentStakes);
    
    // Update global stakes variable
    stakes = currentStakes;
    
    // Hide onboarding, show today screen
    const onboardingScreen = document.getElementById('screen-stakes-onboarding');
    const todayScreen = document.getElementById('screen-today');
    
    if (onboardingScreen) onboardingScreen.classList.remove('active');
    if (todayScreen) todayScreen.classList.add('active');
  }

  function checkStakesOnboarding() {
    const currentStakes = getOrbitStakes();
    
    // Only show onboarding if not completed
    if (!currentStakes.onboarding_complete) {
      showStakesOnboarding();
    }
  }

  function migrateStorage() {
    // Ensure stakes structure exists
    const stakes = JSON.parse(
      localStorage.getItem('orbit_stakes') || 'null'
    );
    if (!stakes) {
      localStorage.setItem('orbit_stakes', JSON.stringify({
        life_context: {
          family_situation: "",
          financial_pressure: "",
          who_depends_on_you: "",
          biggest_fear: "",
          what_failure_looks_like: "",
          what_success_unlocks: ""
        },
        goal_stakes: {},
        onboarding_complete: false
      }));
    }

    // Ensure doom recommendations structure exists
    const doomRec = JSON.parse(
      localStorage.getItem('orbit_doom_recommendations') || 'null'
    );
    if (!doomRec) {
      localStorage.setItem('orbit_doom_recommendations',
        JSON.stringify({
          triggered: [],
          lastRecommendation: null,
          lastDoom: 0,
          lastContextCheck: null
        })
      );
    }
  }

  // Call it at app init:
  migrateStorage();

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
  let stakes = loadData(STORAGE_KEYS.STAKES, {
    life_context: {
      family_situation: "",
      financial_pressure: "",
      who_depends_on_you: "",
      biggest_fear: "",
      what_failure_looks_like: "",
      what_success_unlocks: "",
    },
    goal_stakes: {},
    onboarding_complete: false,
  });

  let pomodoroState = {
    isRunning: false,
    timeLeft: 25 * 60,
    interval: null,
    isBreak: false,
    customDuration: 25,
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

  // Stakes onboarding event listeners
  const stakesContinueBtn = document.getElementById('stakes-continue-btn');
  const stakesSkipBtn = document.getElementById('stakes-skip-btn');
  
  if (stakesContinueBtn) {
    stakesContinueBtn.addEventListener('click', handleContinue);
  }
  
  if (stakesSkipBtn) {
    stakesSkipBtn.addEventListener('click', handleSkip);
  }

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

  /**
   * Extract stakes information from user messages and update life context.
   * 
   * EXTRACTION BEHAVIOR:
   * - Detects family mentions, financial pressure, fears, and goal-related stakes
   * - Only updates fields if they are empty or significantly shorter than new data
   * - Preserves existing strong memories (longer, more detailed responses)
   * - Merges intelligently to avoid overwriting meaningful context
   * 
   * DETECTION RULES:
   * - Family: family, parents, siblings, mom, dad, children, kids, dependents
   * - Financial: rent, money, financial, debt, bills, income, salary, expenses
   * - Fear/Anxiety: fear, worry, anxiety, scared, afraid, terrified, stressed, overwhelmed
   * - Goal stakes: i need to, if i don't, my goal is, i'm scared, depends on, counting on
   * 
   * @param {string} message - User message to extract stakes from
   */
  function extractStakesFromMessage(message) {
    const lowerMessage = message.toLowerCase();
    let updated = false;

    // Check for family/dependent mentions
    // Only update if current value is empty or significantly shorter (preserves detailed memories)
    const familyKeywords = ['family', 'parents', 'siblings', 'mom', 'dad', 'mother', 'father', 'children', 'kids', 'dependents', 'spouse', 'wife', 'husband', 'partner'];
    if (familyKeywords.some(keyword => lowerMessage.includes(keyword))) {
      const currentFamily = stakes.life_context.family_situation || '';
      // Update if empty or new message is significantly more detailed (2x longer)
      if (!currentFamily || message.length > currentFamily.length * 2) {
        stakes.life_context.family_situation = message;
        updated = true;
      }
    }

    // Check for financial pressure
    const financialKeywords = ['rent', 'money', 'financial', 'debt', 'bills', 'income', 'salary', 'expenses', 'budget', 'cost', 'pay', 'loan'];
    if (financialKeywords.some(keyword => lowerMessage.includes(keyword))) {
      const currentFinancial = stakes.life_context.financial_pressure || '';
      if (!currentFinancial || message.length > currentFinancial.length * 2) {
        stakes.life_context.financial_pressure = message;
        updated = true;
      }
    }

    // Check for fear/anxiety about future
    const fearKeywords = ['fear', 'worry', 'anxiety', 'scared', 'afraid', 'terrified', 'stressed', 'overwhelmed', 'panic', 'dread'];
    if (fearKeywords.some(keyword => lowerMessage.includes(keyword))) {
      const currentFear = stakes.life_context.biggest_fear || '';
      if (!currentFear || message.length > currentFear.length * 2) {
        stakes.life_context.biggest_fear = message;
        updated = true;
      }
    }

    // Check for who depends on the user
    const dependentKeywords = ['depends on', 'counting on', 'relying on', 'need me', 'my family needs', 'my kids need'];
    if (dependentKeywords.some(keyword => lowerMessage.includes(keyword))) {
      const currentDepends = stakes.life_context.who_depends_on_you || '';
      if (!currentDepends || message.length > currentDepends.length * 2) {
        stakes.life_context.who_depends_on_you = message;
        updated = true;
      }
    }

    // Check for goal-related stakes and failure consequences
    const goalStakesKeywords = ['i need to', 'if i don\'t', 'my goal is', 'i\'m scared', 'if i fail', 'if this doesn\'t work', 'depends on this'];
    if (goalStakesKeywords.some(keyword => lowerMessage.includes(keyword))) {
      const currentFailure = stakes.life_context.what_failure_looks_like || '';
      if (!currentFailure || message.length > currentFailure.length * 2) {
        stakes.life_context.what_failure_looks_like = message;
        updated = true;
      }
    }

    // Check for success/unlock scenarios
    const successKeywords = ['if i succeed', 'when i finish', 'this will unlock', 'success means', 'achieve this'];
    if (successKeywords.some(keyword => lowerMessage.includes(keyword))) {
      const currentSuccess = stakes.life_context.what_success_unlocks || '';
      if (!currentSuccess || message.length > currentSuccess.length * 2) {
        stakes.life_context.what_success_unlocks = message;
        updated = true;
      }
    }

    if (updated) {
      saveData(STORAGE_KEYS.STAKES, stakes);
    }
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

  // ============================================================================
  // DOOM METER HELPER FUNCTIONS
  // ============================================================================
  
  /**
   * Calculate the expected progress percentage based on time elapsed
   * @param {Date} created - Goal creation date
   * @param {Date} deadline - Goal deadline
   * @param {Date} now - Current date
   * @returns {number} Expected progress percentage (0-1)
   */
  function calculateExpectedProgress(created, deadline, now) {
    const totalDuration = deadline - created;
    const elapsed = now - created;
    return Math.min(1, Math.max(0, elapsed / totalDuration));
  }

  /**
   * Calculate the required pace: hours per hour needed to complete on time
   * Formula: remaining_work / remaining_time
   * Returns > 1 if mathematically impossible (need to work more hours than exist)
   * @param {number} remainingWork - Hours of work remaining
   * @param {number} remainingTime - Hours until deadline
   * @returns {number} Required pace (0 to infinity, >1 = impossible)
   */
  function calculateRequiredPace(remainingWork, remainingTime) {
    if (remainingTime <= 0) {
      // Overdue or no time left: if work remains, pace is infinite
      return remainingWork > 0 ? Infinity : 0;
    }
    if (remainingWork <= 0) {
      // No work remaining: pace is 0
      return 0;
    }
    return remainingWork / remainingTime;
  }

  /**
   * Calculate urgency multiplier based on time remaining and deadline proximity
   * Scales doom: slight pressure early, stronger near deadline, severe when impossible
   * @param {number} hoursRemaining - Hours until deadline
   * @param {number} requiredPace - Required pace from calculateRequiredPace()
   * @param {boolean} isOverdue - Whether goal is overdue
   * @returns {number} Urgency multiplier (0.5 to 5.0)
   */
  function calculateUrgencyMultiplier(hoursRemaining, requiredPace, isOverdue) {
    if (isOverdue) return 2.5;
    if (hoursRemaining <= 6)  return 2.2;
    if (hoursRemaining <= 12) return 1.8;
    if (hoursRemaining <= 24) return 1.4;
    if (hoursRemaining <= 72) return 1.2;
    return 1.0;
  }

  /**
   * Calculate overall goal risk score based on multiple factors
   * Combines pace analysis, progress gap, and deadline pressure
   * @param {Object} goal - Goal object
   * @param {Date} now - Current date
   * @returns {Object} Risk analysis with doom score (0-100)
   */
  function calculateGoalRisk(goal, now) {
    const deadline = new Date(goal.deadline);
    if (!isValidDate(deadline)) {
      return { doom: 0, factors: [] };
    }

    const totalHours = Number(goal.total_hours) || 1;
    const loggedHours = Number(goal.logged_hours) || 0;
    const remainingWork = Math.max(0, totalHours - loggedHours);
    const hoursRemaining = getHoursRemaining(goal, now);

    // Check if overdue
    const deadlineDate = new Date(goal.deadline);
    if (goal.deadline && !goal.deadline.includes('T')) {
      deadlineDate.setHours(23, 59, 59, 999);
    }
    const isOverdue = deadlineDate < now;

    // Calculate required pace
    const requiredPace = calculateRequiredPace(remainingWork, hoursRemaining);

    // Calculate urgency multiplier
    const urgencyMultiplier = calculateUrgencyMultiplier(hoursRemaining, requiredPace, isOverdue);

    // Calculate progress metrics
    const created = new Date(goal.created_at || now);
    const expectedProgress = calculateExpectedProgress(created, deadline, now);
    const actualProgress = calculateActualProgress(loggedHours, totalHours);
    const progressGap = calculateProgressGap(actualProgress, expectedProgress);

    // Base doom from required pace analysis
    let paceDoom = 0;
    if (requiredPace > 1) {
      // Mathematically impossible: very high doom
      paceDoom = 60 + Math.min(30, (requiredPace - 1) * 20);
    } else if (requiredPace > 0.8) {
      // Very tight: high doom
      paceDoom = 40 + (requiredPace - 0.8) * 100;
    } else if (requiredPace > 0.5) {
      // Tight schedule: moderate doom
      paceDoom = 20 + (requiredPace - 0.5) * 66;
    } else if (requiredPace > 0.3) {
      // Manageable: low doom
      paceDoom = (requiredPace - 0.3) * 66;
    }
    // If requiredPace <= 0.3, paceDoom stays at 0

    // Doom from progress gap (behind schedule)
    let progressDoom = 0;
    if (progressGap > 0) {
      // Behind schedule
      progressDoom = Math.min(30, progressGap * 50);
    }

    // Doom from no progress near deadline
    let noProgressDoom = 0;
    if (loggedHours === 0 && hoursRemaining < 72) {
      // No work done and less than 3 days left
      noProgressDoom = Math.min(25, (72 - hoursRemaining) / 3);
    }

    // Doom from overdue status
    let overdueDoom = 0;
    if (isOverdue) {
      const daysOverdue = Math.abs(hoursRemaining) / 24;
      overdueDoom = Math.min(40, daysOverdue * 10);
    }

    // Combine all doom factors with urgency multiplier
    const baseDoom = paceDoom + progressDoom + noProgressDoom + overdueDoom;
    const weightedDoom = baseDoom * urgencyMultiplier;

    // Apply priority weight
    const priorityWeight = calculatePriorityWeight(goal.priority);
    const finalDoom = weightedDoom * priorityWeight;

    // Smooth to avoid spikes
    const smoothedDoom = smoothDoom(finalDoom);

    // Clamp to 0-100
    const clampedDoom = Math.min(100, Math.max(0, smoothedDoom));

    return {
      doom: clampedDoom,
      factors: {
        requiredPace,
        urgencyMultiplier,
        progressGap,
        paceDoom,
        progressDoom,
        noProgressDoom,
        overdueDoom,
        isOverdue,
      }
    };
  }

  /**
   * Calculate the actual progress percentage based on hours logged
   * @param {number} loggedHours - Hours logged so far
   * @param {number} totalHours - Total hours required
   * @returns {number} Actual progress percentage (0-1)
   */
  function calculateActualProgress(loggedHours, totalHours) {
    const total = Math.max(0.01, Number(totalHours) || 1);
    const logged = Math.max(0, Number(loggedHours) || 0);
    return Math.min(1, logged / total);
  }

  /**
   * Calculate progress gap: how far behind (or ahead) the user is
   * Positive = behind schedule, Negative = ahead of schedule
   * @param {number} actualProgress - Actual progress (0-1)
   * @param {number} expectedProgress - Expected progress (0-1)
   * @returns {number} Progress gap (-1 to 1)
   */
  function calculateProgressGap(actualProgress, expectedProgress) {
    return Math.max(-1, Math.min(1, expectedProgress - actualProgress));
  }

  /**
   * Calculate hours remaining until deadline
   * @param {Object} goal - Goal object
   * @param {Date} now - Current date
   * @returns {number} Hours remaining
   */
  function getHoursRemaining(goal, now) {
    if (goal.hours_remaining_override !== null) {
      return goal.hours_remaining_override;
    }

    const deadline = new Date(goal.deadline);
    if (!isValidDate(deadline)) return Infinity;

    let fullDeadline;
    if (goal.has_time_deadline && goal.deadline_time) {
      fullDeadline = new Date(goal.deadline + 'T' + goal.deadline_time);
      if (!isValidDate(fullDeadline)) {
        fullDeadline = deadline;
      }
    } else {
      fullDeadline = deadline;
      if (goal.deadline && !goal.deadline.includes('T')) {
        fullDeadline.setHours(23, 59, 59, 999);
      }
    }

    return Math.max(0, (fullDeadline - now) / 3600000);
  }

  /**
   * Calculate urgency weight based on time remaining
   * Higher weight = more urgent = higher doom contribution
   * @param {number} hoursRemaining - Hours until deadline
   * @param {boolean} isOverdue - Whether goal is overdue
   * @returns {number} Urgency weight (0.5 to 3.0)
   */
  function calculateUrgencyWeight(hoursRemaining, isOverdue) {
    if (isOverdue) return 2.5;
    if (hoursRemaining <= 6)  return 2.2;
    if (hoursRemaining <= 12) return 1.8;
    if (hoursRemaining <= 24) return 1.4;
    if (hoursRemaining <= 72) return 1.2;
    return 1.0;
  }

  /**
   * Calculate priority weight based on goal priority setting
   * @param {number} priority - Goal priority (1-3)
   * @returns {number} Priority weight (0.5 to 1.5)
   */
  function calculatePriorityWeight(priority) {
    const p = Number(priority) || 2;
    return p / 2; // 1 -> 0.5, 2 -> 1.0, 3 -> 1.5
  }

  /**
   * Smooth doom contribution to avoid sudden spikes
   * Uses a sigmoid-like curve for gradual transitions
   * @param {number} rawDoom - Raw doom value
   * @returns {number} Smoothed doom value
   */
  function smoothDoom(rawDoom) {
    const prev = parseFloat(localStorage.getItem('orbit_prev_doom') || '0');
    const smoothed = prev + (rawDoom - prev) * 0.8;
    localStorage.setItem('orbit_prev_doom', smoothed.toString());
    return smoothed;
  }

  /**
   * Calculate vision neglect doom based on how long since vision was updated
   * @param {Object} vision - Vision object
   * @param {Date} now - Current date
   * @returns {number} Vision neglect doom (0-20)
   */
  function calculateVisionNeglectDoom(vision, now) {
    if (!vision || !vision.created_at) return 0;
    
    const created = new Date(vision.created_at);
    const daysSinceCreation = (now - created) / 86400000;
    
    // If vision has linked goals that are making progress, reduce neglect
    const linkedGoals = goals.filter(g => g.linked_vision_id === vision.id);
    if (linkedGoals.length === 0) {
      // Vision with no goals: high neglect if old
      if (daysSinceCreation > 30) {
        const visionDoom = Math.min(20, daysSinceCreation / 3);
        return Math.min(15, visionDoom);
      }
      return 0;
    }
    
    // Vision with goals: check if goals are progressing
    const totalProgress = linkedGoals.reduce((sum, g) => {
      return sum + calculateActualProgress(g.logged_hours, g.total_hours);
    }, 0);
    const avgProgress = totalProgress / linkedGoals.length;
    
    // If average progress is low and vision is old, add neglect doom
    if (avgProgress < 0.3 && daysSinceCreation > 14) {
      const visionDoom = Math.min(15, (daysSinceCreation / 14) * (1 - avgProgress) * 10);
      return Math.min(15, visionDoom);
    }
    
    return 0;
  }

  /**
   * Calculate doom contribution from a single goal
   * Uses the new risk-based calculation system
   * @param {Object} goal - Goal object
   * @param {Date} now - Current date
   * @returns {number} Goal's doom contribution (0-100)
   */
  function calculateGoalDoom(goal, now) {
    const risk = calculateGoalRisk(goal, now);
    return risk.doom;
  }

  /**
   * Main doom calculation function
   * Combines goal doom, vision neglect, and task completion
   * @returns {number} Final doom score (0-100)
   */
  function calculateDoom() {
    // No goals or visions = no doom
    if (goals.length === 0 && visions.length === 0) return 0;

    let totalDoom = 0;
    const now = new Date();

    // Calculate doom from goals
    goals.forEach((goal) => {
      const goalDoom = calculateGoalDoom(goal, now);
      totalDoom += goalDoom;
    });

    // Calculate doom from vision neglect
    visions.forEach((vision) => {
      const visionDoom = calculateVisionNeglectDoom(vision, now);
      if (visionDoom > 0) {
        totalDoom += visionDoom;
      }
    });

    // Add doom from incomplete daily tasks
    const combined = getCombinedTodayTasks();
    if (combined.length > 0) {
      const completedRatio = combined.filter((i) => i.completed).length / combined.length;
      const taskDoom = (1 - completedRatio) * 15; // Max 15 points from tasks
      totalDoom += taskDoom;
    }

    // Normalize by number of goals only (not visions)
    const weightedDoom = goals.length > 0 
      ? totalDoom / goals.length 
      : totalDoom;
    return Math.min(100, Math.max(0, Math.round(weightedDoom)));
  }

  // ============================================================================
  // DOOM RECOMMENDATION ENGINE
  // ============================================================================

  /**
   * Get the goal with the highest risk (doom) score
   * Considers doom level, emotional weight, and stakes
   * @returns {Object|null} Highest risk goal with analysis
   */
  function getHighestRiskGoal() {
    if (goals.length === 0) return null;

    const now = new Date();
    let highestRisk = null;
    let maxRiskScore = -Infinity;

    goals.forEach((goal) => {
      const risk = calculateGoalRisk(goal, now);
      const goalStakes = stakes.goal_stakes[goal.id] || { emotional_weight: 3 };
      
      // Combine doom with emotional weight for risk score
      // Higher emotional weight amplifies the risk perception
      const emotionalMultiplier = goalStakes.emotional_weight / 3; // 1-5 normalized to 0.33-1.67
      const riskScore = risk.doom * emotionalMultiplier;

      if (riskScore > maxRiskScore) {
        maxRiskScore = riskScore;
        highestRisk = {
          goal,
          risk,
          emotionalWeight: goalStakes.emotional_weight,
          riskScore
        };
      }
    });

    return highestRisk;
  }

  /**
   * Calculate whether a goal is still recoverable
   * Considers remaining time, required pace, and work remaining
   * @param {Object} goal - Goal object
   * @returns {Object} Recoverability analysis
   */
  function calculateRecoverability(goal) {
    const now = new Date();
    const deadline = new Date(goal.deadline);
    if (!isValidDate(deadline)) {
      return { recoverable: true, confidence: 0.5, reason: 'No deadline set' };
    }

    const totalHours = Number(goal.total_hours) || 1;
    const loggedHours = Number(goal.logged_hours) || 0;
    const remainingWork = Math.max(0, totalHours - loggedHours);
    const hoursRemaining = getHoursRemaining(goal, now);

    // Check if overdue
    if (hoursRemaining <= 0) {
      return {
        recoverable: false,
        confidence: 1.0,
        reason: 'Goal is overdue',
        hoursOverdue: Math.abs(hoursRemaining)
      };
    }

    // Calculate required pace
    const requiredPace = calculateRequiredPace(remainingWork, hoursRemaining);

    // If pace > 1, mathematically impossible
    if (requiredPace > 1) {
      return {
        recoverable: false,
        confidence: 1.0,
        reason: 'Mathematically impossible - need more hours than exist',
        requiredPace
      };
    }

    // If pace > 0.8, very difficult but possible
    if (requiredPace > 0.8) {
      return {
        recoverable: true,
        confidence: 0.3,
        reason: 'Extremely tight schedule, requires intense focus',
        requiredPace,
        hoursRemaining,
        remainingWork
      };
    }

    // If pace > 0.5, challenging but doable
    if (requiredPace > 0.5) {
      return {
        recoverable: true,
        confidence: 0.6,
        reason: 'Challenging but achievable with consistent effort',
        requiredPace,
        hoursRemaining,
        remainingWork
      };
    }

    // If pace <= 0.5, comfortably recoverable
    return {
      recoverable: true,
      confidence: 0.9,
      reason: 'On track or ahead of schedule',
      requiredPace,
      hoursRemaining,
      remainingWork
    };
  }

  /**
   * Calculate future impact weight for a goal
   * Considers: vision linkage, priority, emotional weight, and stakes
   * @param {Object} goal - Goal object
   * @returns {number} Impact weight (0-1)
   */
  function calculateFutureImpactWeight(goal) {
    let weight = 0.5; // Base weight

    // Vision linkage: goals linked to visions have higher impact
    if (goal.linked_vision_id) {
      const vision = visions.find(v => v.id === goal.linked_vision_id);
      if (vision) {
        weight += 0.2; // Significant boost for vision-linked goals
      }
    }

    // Priority weight
    const priorityWeight = calculatePriorityWeight(goal.priority);
    weight += (priorityWeight - 1) * 0.15; // Adjust based on priority

    // Emotional weight from stakes
    const goalStakes = stakes.goal_stakes[goal.id] || { emotional_weight: 3 };
    const emotionalBoost = (goalStakes.emotional_weight - 3) * 0.1; // 1-5 range
    weight += emotionalBoost;

    // Stakes presence: goals with defined stakes are more important
    if (goalStakes.personal_stake || goalStakes.consequence_if_missed) {
      weight += 0.1;
    }

    // Clamp to 0-1
    return Math.min(1, Math.max(0, weight));
  }

  /**
   * Generate context-aware doom recommendation based on current doom level
   * Recommendations vary by doom level and consider goals, vision, stakes, time, and progress
   * @param {number} doom - Current doom percentage (0-100)
   * @returns {Object} Recommendation with message, actions, and metadata
   */
  function generateDoomRecommendation(doom) {
    const now = new Date();
    const highestRisk = getHighestRiskGoal();
    const recoverability = highestRisk ? calculateRecoverability(highestRisk.goal) : null;
    
    // Get context data
    const urgentGoals = goals.filter(g => {
      const hoursLeft = getHoursRemaining(g, now);
      return hoursLeft > 0 && hoursLeft < 72; // Less than 3 days
    }).sort((a, b) => getHoursLeft(a, now) - getHoursLeft(b, now));

    const visionLinkedGoals = goals.filter(g => g.linked_vision_id);
    const highImpactGoals = goals
      .map(g => ({ goal: g, impact: calculateFutureImpactWeight(g) }))
      .filter(item => item.impact > 0.7)
      .sort((a, b) => b.impact - a.impact)
      .map(item => item.goal);

    // Determine doom level tier
    let doomTier;
    if (doom <= 25) doomTier = 'low';
    else if (doom <= 50) doomTier = 'medium';
    else if (doom <= 75) doomTier = 'high';
    else doomTier = 'critical';

    // Generate recommendation based on tier and context
    switch (doomTier) {
      case 'low':
        return generateLowDoomRecommendation(highestRisk, urgentGoals, highImpactGoals);
      
      case 'medium':
        return generateMediumDoomRecommendation(highestRisk, recoverability, urgentGoals, highImpactGoals);
      
      case 'high':
        return generateHighDoomRecommendation(highestRisk, recoverability, urgentGoals, highImpactGoals, visionLinkedGoals);
      
      case 'critical':
        return generateCriticalDoomRecommendation(highestRisk, recoverability, urgentGoals, highImpactGoals, visionLinkedGoals);
      
      default:
        return { message: '', actions: [], priority: 'low' };
    }
  }

  /**
   * Generate recommendation for low doom (0-25%)
   * Gentle optional suggestions, momentum protection, low pressure
   */
  function generateLowDoomRecommendation(highestRisk, urgentGoals, highImpactGoals) {
    const messages = [];
    const actions = [];

    // If no goals, gentle nudge to set direction
    if (goals.length === 0) {
      return {
        message: "You're in a good place. Consider setting a few goals to give your days direction.",
        actions: [
          { text: 'Add a goal', action: 'add-goal' }
        ],
        priority: 'low',
        tier: 'low'
      };
    }

    // Momentum protection: suggest keeping current pace
    messages.push("You're building good momentum. Keep this rhythm going.");

    // Optional suggestion for highest impact goal
    if (highImpactGoals.length > 0) {
      const goal = highImpactGoals[0];
      const progress = safeProgress(goal.logged_hours, goal.total_hours);
      if (progress < 30) {
        messages.push(`"${goal.title}" could use some attention when you're ready.`);
        actions.push({
          text: `Focus on ${goal.title}`,
          action: 'focus-goal',
          goalId: goal.id
        });
      }
    }

    // Gentle reminder about urgent goals if any
    if (urgentGoals.length > 0) {
      const goal = urgentGoals[0];
      const hoursLeft = getHoursLeft(goal, new Date());
      if (hoursLeft < 48) {
        messages.push(`"${goal.title}" is coming up in ${Math.ceil(hoursLeft)} hours.`);
      }
    }

    return {
      message: messages.join(' '),
      actions: actions,
      priority: 'low',
      tier: 'low'
    };
  }

  /**
   * Generate recommendation for medium doom (25-50%)
   * Identify slipping goals, suggest realistic recovery, mention remaining time
   */
  function generateMediumDoomRecommendation(highestRisk, recoverability, urgentGoals, highImpactGoals) {
    const messages = [];
    const actions = [];

    if (!highestRisk) {
      return {
        message: "Check in on your goals - some may need attention.",
        actions: [{ text: 'Review goals', action: 'review-goals' }],
        priority: 'medium',
        tier: 'medium'
      };
    }

    const goal = highestRisk.goal;
    const hoursLeft = getHoursLeft(goal, new Date());
    const progress = safeProgress(goal.logged_hours, goal.total_hours);

    // Identify slipping goal
    if (highestRisk.risk.doom > 30) {
      messages.push(`"${goal.title}" is slipping behind.`);
      
      // Suggest realistic recovery
      if (recoverability && recoverability.recoverable) {
        const remainingWork = goal.total_hours - (Number(goal.logged_hours) || 0);
        const daysLeft = Math.ceil(hoursLeft / 24);
        const hoursPerDay = remainingWork / Math.max(1, daysLeft);
        
        if (hoursPerDay <= 4) {
          messages.push(`You can recover by dedicating ${hoursPerDay.toFixed(1)}h/day for the next ${daysLeft} days.`);
        } else {
          messages.push(`Recovery is possible but will require significant focus.`);
        }
      } else if (recoverability && !recoverability.recoverable) {
        messages.push(`This goal may need adjustment - ${recoverability.reason}.`);
        actions.push({
          text: 'Adjust deadline or scope',
          action: 'adjust-goal',
          goalId: goal.id
        });
      }

      // Mention remaining time naturally
      if (hoursLeft < 168) { // Less than a week
        const timeStr = hoursLeft < 24 ? `${Math.ceil(hoursLeft)} hours` : `${Math.ceil(hoursLeft / 24)} days`;
        messages.push(`You have ${timeStr} remaining.`);
      }

      actions.push({
        text: `Focus on ${goal.title}`,
        action: 'focus-goal',
        goalId: goal.id
      });
    }

    // Check for other slipping goals
    const slippingGoals = goals.filter(g => {
      const risk = calculateGoalRisk(g, new Date());
      return risk.doom > 25 && g.id !== goal.id;
    });

    if (slippingGoals.length > 0) {
      messages.push(`${slippingGoals.length} other goal${slippingGoals.length > 1 ? 's are' : ' is'} also falling behind.`);
    }

    return {
      message: messages.join(' '),
      actions: actions,
      priority: 'medium',
      tier: 'medium'
    };
  }

  /**
   * Generate recommendation for high doom (50-75%)
   * Stakes-aware recommendations, prioritize urgency, suggest damage control, compress low-value tasks
   */
  function generateHighDoomRecommendation(highestRisk, recoverability, urgentGoals, highImpactGoals, visionLinkedGoals) {
    const messages = [];
    const actions = [];

    if (!highestRisk) {
      return {
        message: "Multiple goals need immediate attention. Focus on what matters most.",
        actions: [{ text: 'Review all goals', action: 'review-goals' }],
        priority: 'high',
        tier: 'high'
      };
    }

    const goal = highestRisk.goal;
    const hoursLeft = getHoursLeft(goal, new Date());
    const goalStakes = stakes.goal_stakes[goal.id] || {};

    // Activate stakes-aware recommendations
    if (goalStakes.personal_stake || goalStakes.consequence_if_missed) {
      const stakeText = goalStakes.personal_stake || goalStakes.consequence_if_missed;
      messages.push(`Remember what's at stake with "${goal.title}": ${stakeText.substring(0, 100)}${stakeText.length > 100 ? '...' : ''}`);
    }

    // Prioritize highest urgency goals
    if (urgentGoals.length > 0) {
      const mostUrgent = urgentGoals[0];
      if (mostUrgent.id !== goal.id) {
        messages.push(`"${mostUrgent.title}" is more urgent with ${Math.ceil(getHoursLeft(mostUrgent, new Date()))} hours left.`);
        actions.push({
          text: `Switch to ${mostUrgent.title}`,
          action: 'focus-goal',
          goalId: mostUrgent.id
        });
      }
    }

    // Suggest damage control for highest risk goal
    if (recoverability) {
      if (recoverability.recoverable && recoverability.confidence < 0.5) {
        messages.push(`"${goal.title}" needs damage control. ${recoverability.reason}`);
        actions.push({
          text: 'Emergency focus session',
          action: 'emergency-focus',
          goalId: goal.id
        });
      } else if (!recoverability.recoverable) {
        messages.push(`"${goal.title}" may not be recoverable. Consider strategic reset.`);
        actions.push({
          text: 'Reset or defer this goal',
          action: 'reset-goal',
          goalId: goal.id
        });
      }
    }

    // Suggest compressing low-value tasks
    const combined = getCombinedTodayTasks();
    const lowValueTasks = combined.filter(t => !t.completed && !t.linked_goal_id);
    if (lowValueTasks.length > 2) {
      messages.push(`Consider postponing ${lowValueTasks.length} low-priority tasks to focus on urgent goals.`);
    }

    // Prioritize vision-linked goals
    if (visionLinkedGoals.length > 0) {
      const visionGoal = visionLinkedGoals.find(g => {
        const risk = calculateGoalRisk(g, new Date());
        return risk.doom > 30;
      });
      if (visionGoal && visionGoal.id !== goal.id) {
        messages.push(`"${visionGoal.title}" connects to your life vision and needs attention.`);
      }
    }

    return {
      message: messages.join(' '),
      actions: actions,
      priority: 'high',
      tier: 'high'
    };
  }

  /**
   * Generate recommendation for critical doom (75-100%)
   * Brutally honest but caring, detect recoverability, emergency action plan or strategic reset
   */
  function generateCriticalDoomRecommendation(highestRisk, recoverability, urgentGoals, highImpactGoals, visionLinkedGoals) {
    const messages = [];
    const actions = [];

    if (!highestRisk) {
      return {
        message: "Critical situation. You need to make hard choices about what to save and what to let go.",
        actions: [{ text: 'Strategic reset', action: 'strategic-reset' }],
        priority: 'critical',
        tier: 'critical'
      };
    }

    const goal = highestRisk.goal;
    const hoursLeft = getHoursLeft(goal, new Date());
    const goalStakes = stakes.goal_stakes[goal.id] || {};

    // Brutally honest but caring
    messages.push(`This is critical. "${goal.title}" is at ${highestRisk.risk.doom.toFixed(0)}% risk.`);

    // Reference stakes if available
    if (goalStakes.personal_stake) {
      messages.push(`You said: "${goalStakes.personal_stake.substring(0, 80)}..."`);
    }

    // Detect if recovery is realistic
    if (recoverability) {
      if (recoverability.recoverable) {
        // Generate emergency action plan
        const remainingWork = goal.total_hours - (Number(goal.logged_hours) || 0);
        const daysLeft = Math.max(1, Math.ceil(hoursLeft / 24));
        const hoursPerDay = remainingWork / daysLeft;

        messages.push(`Recovery is possible but requires ${hoursPerDay.toFixed(1)}h/day for ${daysLeft} days.`);
        
        actions.push({
          text: 'Start emergency plan',
          action: 'emergency-plan',
          goalId: goal.id,
          hoursPerDay,
          daysLeft
        });

        // Suggest dropping other commitments
        const otherActiveGoals = goals.filter(g => g.id !== goal.id && safeProgress(g.logged_hours, g.total_hours) < 100);
        if (otherActiveGoals.length > 0) {
          messages.push(`Consider pausing ${otherActiveGoals.length} other goal${otherActiveGoals.length > 1 ? 's' : ''} temporarily.`);
          actions.push({
            text: 'Pause other goals',
            action: 'pause-other-goals',
            excludeGoalId: goal.id
          });
        }
      } else {
        // Suggest strategic reset
        messages.push(`${recoverability.reason}. Continuing may cause more damage than accepting this.`);
        
        actions.push({
          text: 'Strategic reset',
          action: 'reset-goal',
          goalId: goal.id
        });

        // Suggest focusing on recoverable goals
        const recoverableGoals = goals.filter(g => {
          if (g.id === goal.id) return false;
          const rec = calculateRecoverability(g);
          return rec.recoverable && rec.confidence > 0.5;
        });

        if (recoverableGoals.length > 0) {
          messages.push(`Focus on ${recoverableGoals.length} goal${recoverableGoals.length > 1 ? 's' : ''} that can still be saved.`);
          actions.push({
            text: 'Switch to recoverable goal',
            action: 'focus-goal',
            goalId: recoverableGoals[0].id
          });
        }
      }
    }

    // Avoid toxic pressure - add caring note
    messages.push("This is a moment, not your worth. Make the choice that serves you best.");

    // Check for other critical goals
    const otherCritical = goals.filter(g => {
      if (g.id === goal.id) return false;
      const risk = calculateGoalRisk(g, new Date());
      return risk.doom > 70;
    });

    if (otherCritical.length > 0) {
      messages.push(`${otherCritical.length} other goal${otherCritical.length > 1 ? 's are' : ' is'} also in critical state.`);
    }

    return {
      message: messages.join(' '),
      actions: actions,
      priority: 'critical',
      tier: 'critical'
    };
  }

  /**
   * Check if doom has crossed a threshold and trigger recommendation
   * Thresholds: 25%, 50%, 75%, 100%
   * Also triggers on significant context changes (deadline approach, missed habits, etc.)
   * Only triggers once per threshold per session to avoid spam
   */
  function checkDoomRecommendationTriggers(doom) {
    // Check if temporarily dismissed
    const dismissedUntil = localStorage.getItem('doom_recommendation_dismissed_until');
    if (dismissedUntil) {
      const until = parseInt(dismissedUntil, 10);
      if (Date.now() < until) {
        return; // Skip if still dismissed
      }
    }

    // Load previously triggered thresholds
    const triggeredThresholds = loadData(STORAGE_KEYS.DOOM_RECOMMENDATIONS, {
      triggered: [],
      lastRecommendation: null,
      lastDoom: 0,
      lastContextCheck: null
    });

    const thresholds = [25, 50, 75, 100];
    let newTrigger = null;
    let contextChanged = false;

    // Check if doom has crossed any threshold
    thresholds.forEach(threshold => {
      if (doom >= threshold && !triggeredThresholds.triggered.includes(threshold)) {
        // Only trigger if we're close to the threshold (within 5%)
        if (doom <= threshold + 5) {
          newTrigger = threshold;
          triggeredThresholds.triggered.push(threshold);
        }
      }
    });

    // Check for significant context changes
    const now = new Date();
    const lastContextCheck = triggeredThresholds.lastContextCheck ? new Date(triggeredThresholds.lastContextCheck) : null;
    const timeSinceLastCheck = lastContextCheck ? (now - lastContextCheck) / 60000 : Infinity; // minutes

    // Check for context changes every 5 minutes or if doom changed significantly
    if (timeSinceLastCheck > 5 || Math.abs(doom - (triggeredThresholds.lastDoom || 0)) > 10) {
      contextChanged = detectContextChanges();
      triggeredThresholds.lastContextCheck = now.toISOString();
    }

    // Reset triggered thresholds if doom has dropped significantly
    // This allows re-triggering if doom goes down and back up
    if (doom < 20 && triggeredThresholds.triggered.length > 0) {
      triggeredThresholds.triggered = [];
    }

    // Generate and display recommendation if new trigger or context changed
    if (newTrigger !== null || contextChanged) {
      const recommendation = generateDoomRecommendation(doom);
      triggeredThresholds.lastRecommendation = {
        ...recommendation,
        triggeredAt: newTrigger || 'context-change',
        timestamp: new Date().toISOString()
      };
      triggeredThresholds.lastDoom = doom;
      saveData(STORAGE_KEYS.DOOM_RECOMMENDATIONS, triggeredThresholds);
      renderDoomRecommendation(recommendation);
    }
  }

  /**
   * Detect significant context changes that warrant new recommendations
   * Checks for: deadline proximity, missed habits, goal completion, stakes changes
   * @returns {boolean} True if context has changed significantly
   */
  function detectContextChanges() {
    const now = new Date();
    const triggeredThresholds = loadData(STORAGE_KEYS.DOOM_RECOMMENDATIONS, {
      lastRecommendation: null
    });

    if (!triggeredThresholds.lastRecommendation) {
      return false;
    }

    const lastRecTime = new Date(triggeredThresholds.lastRecommendation.timestamp);
    const timeSinceLastRec = (now - lastRecTime) / 60000; // minutes

    // Don't check too frequently
    if (timeSinceLastRec < 5) {
      return false;
    }

    // Check for deadline proximity changes
    const urgentGoals = goals.filter(g => {
      const hoursLeft = getHoursRemaining(g, now);
      return hoursLeft > 0 && hoursLeft < 72;
    });

    // If number of urgent goals changed significantly
    if (urgentGoals.length > 0) {
      return true;
    }

    // Check for missed habits
    const combined = getCombinedTodayTasks();
    const completedTasks = combined.filter(t => t.completed).length;
    const totalTasks = combined.length;
    
    // If task completion rate dropped significantly
    if (totalTasks > 0 && completedTasks / totalTasks < 0.5 && timeSinceLastRec > 30) {
      return true;
    }

    // Check for goal deadline crossings (goals that became overdue)
    const overdueGoals = goals.filter(g => {
      const deadline = new Date(g.deadline);
      if (!isValidDate(deadline)) return false;
      const hoursLeft = getHoursRemaining(g, now);
      return hoursLeft <= 0;
    });

    if (overdueGoals.length > 0) {
      return true;
    }

    // Check for stakes engine context changes
    if (stakes.onboarding_complete && !triggeredThresholds.lastRecommendation.stakesAware) {
      return true;
    }

    return false;
  }

  /**
   * Render doom recommendation UI component
   * Displays the recommendation message and action buttons
   */
  function renderDoomRecommendation(recommendation) {
    // Check if temporarily dismissed
    const dismissedUntil = localStorage.getItem('doom_recommendation_dismissed_until');
    if (dismissedUntil) {
      const until = parseInt(dismissedUntil, 10);
      if (Date.now() < until) {
        return; // Skip rendering if still dismissed
      } else {
        localStorage.removeItem('doom_recommendation_dismissed_until');
      }
    }

    // Check if recommendation container exists
    let container = document.getElementById('doom-recommendation-container');
    const isUpdate = container !== null;
    
    // Create container if it doesn't exist
    if (!container) {
      container = document.createElement('div');
      container.id = 'doom-recommendation-container';
      container.className = 'doom-recommendation-container';
      
      // Insert after doom meter
      const doomMeter = document.getElementById('doom-meter-top');
      if (doomMeter && doomMeter.parentNode) {
        doomMeter.parentNode.insertBefore(container, doomMeter.nextSibling);
      } else {
        // Fallback: append to app body
        const appBody = document.querySelector('.app-body');
        if (appBody) {
          appBody.insertBefore(container, appBody.firstChild);
        }
      }
    }

    // Set styling based on priority
    const priorityClass = `doom-rec-${recommendation.priority}`;
    
    // Generate action buttons HTML
    const actionsHtml = recommendation.actions.map(action => {
      const buttonClass = action.action === 'reset-goal' || action.action === 'strategic-reset' 
        ? 'doom-rec-action-secondary' 
        : 'doom-rec-action-primary';
      return `<button class="doom-rec-action ${buttonClass}" data-action="${action.action}" ${action.goalId ? `data-goal-id="${action.goalId}"` : ''}>${action.text}</button>`;
    }).join('');

    // Add update animation if this is an update
    if (isUpdate) {
      const existingCard = container.querySelector('.doom-recommendation');
      if (existingCard) {
        existingCard.classList.add('updating');
      }
    }

    container.innerHTML = `
      <div class="doom-recommendation ${priorityClass} visible">
        <div class="doom-rec-header">
          <span class="doom-rec-icon">${getRecommendationIcon(recommendation.tier)}</span>
          <span class="doom-rec-title">${getRecommendationTitle(recommendation.tier)}</span>
          <button class="doom-rec-dismiss" data-action="dismiss-recommendation" aria-label="Dismiss temporarily">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div class="doom-rec-message">${escapeHtml(recommendation.message)}</div>
        <div class="doom-rec-actions">${actionsHtml}</div>
      </div>
    `;

    container.classList.add('visible');

    // Remove event listener to avoid duplicates
    container.removeEventListener('click', handleRecommendationAction);
    // Add event listeners for actions
    container.addEventListener('click', handleRecommendationAction);
  }

  /**
   * Get icon for recommendation based on tier
   */
  function getRecommendationIcon(tier) {
    switch (tier) {
      case 'low': return '💡';
      case 'medium': return '⚠️';
      case 'high': return '🔥';
      case 'critical': return '🚨';
      default: return 'ℹ️';
    }
  }

  /**
   * Get title for recommendation based on tier
   */
  function getRecommendationTitle(tier) {
    switch (tier) {
      case 'low': return 'Suggestion';
      case 'medium': return 'Heads up';
      case 'high': return 'Attention needed';
      case 'critical': return 'Critical';
      default: return 'Recommendation';
    }
  }

  /**
   * Handle recommendation action clicks
   */
  function handleRecommendationAction(e) {
    const actionBtn = e.target.closest('[data-action]');
    if (!actionBtn) return;

    const action = actionBtn.dataset.action;
    const goalId = actionBtn.dataset.goalId;

    switch (action) {
      case 'dismiss-recommendation':
        dismissRecommendation();
        break;
      
      case 'add-goal':
        const addGoalBtn = document.getElementById('add-goal-btn');
        if (addGoalBtn) addGoalBtn.click();
        dismissRecommendation();
        break;
      
      case 'focus-goal':
        if (goalId) {
          navigateToScreen('goals');
          dismissRecommendation();
        }
        break;
      
      case 'review-goals':
        navigateToScreen('goals');
        dismissRecommendation();
        break;
      
      case 'adjust-goal':
        // TODO: Implement goal adjustment modal
        console.log('Adjust goal:', goalId);
        break;
      
      case 'emergency-focus':
      case 'emergency-plan':
        if (goalId) {
          navigateToScreen('today');
          // Start pomodoro
          const pomodoroStart = document.getElementById('pomodoro-start');
          if (pomodoroStart) pomodoroStart.click();
          dismissRecommendation();
        }
        break;
      
      case 'reset-goal':
      case 'strategic-reset':
        if (goalId) {
          if (confirm('Are you sure you want to reset this goal? This action cannot be undone.')) {
            deleteGoal(goalId);
            dismissRecommendation();
          }
        } else {
          // Strategic reset - suggest reviewing all goals
          navigateToScreen('goals');
          dismissRecommendation();
        }
        break;
      
      case 'pause-other-goals':
        // TODO: Implement pause functionality
        console.log('Pause other goals except:', goalId);
        break;
    }
  }

  /**
   * Dismiss the current recommendation temporarily (30 minutes)
   */
  function dismissRecommendation() {
    const container = document.getElementById('doom-recommendation-container');
    if (container) {
      container.classList.remove('visible');
      setTimeout(() => {
        container.remove();
      }, 300);
    }
    
    // Set temporary dismissal for 30 minutes
    const dismissUntil = Date.now() + (30 * 60 * 1000);
    localStorage.setItem('doom_recommendation_dismissed_until', dismissUntil.toString());
  }

  function getDoomColor(doom) {
    if (doom <= 25) return 'var(--doom-safe)';
    if (doom <= 50) return 'var(--doom-rising)';
    if (doom <= 75) return 'var(--doom-warning)';
    return 'var(--doom-critical)';
  }

  // Store previous doom for smooth transitions
  let previousDoom = 0;
  let doomTransitionInterval = null;

  /**
   * Animate a value from start to end over duration
   * Used for smooth doom value transitions
   */
  function animateValue(element, start, end, duration, suffix = '') {
    if (start === end) {
      element.textContent = `${end}${suffix}`;
      return;
    }

    const range = end - start;
    const startTime = performance.now();
    
    // Clear any existing animation
    if (doomTransitionInterval) {
      cancelAnimationFrame(doomTransitionInterval);
    }

    function update(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Ease out cubic for smooth transition
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      const current = start + (range * easeProgress);
      
      element.textContent = `${Math.round(current)}${suffix}`;
      
      if (progress < 1) {
        doomTransitionInterval = requestAnimationFrame(update);
      } else {
        doomTransitionInterval = null;
      }
    }
    
    doomTransitionInterval = requestAnimationFrame(update);
  }

  function updateDoomMeter() {
    const doom = calculateDoom();
    const color = getDoomColor(doom);

    // Smooth doom value transition
    const doomValueEl = document.getElementById('doom-value');
    if (doomValueEl) {
      // Animate the number change for smooth transition
      animateValue(doomValueEl, previousDoom, doom, 500, '%');
      doomValueEl.style.color = color;
    }

    const fill = document.getElementById('doom-fill');
    if (fill) {
      fill.style.width = `${doom}%`;
      fill.style.background = color;
    }

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

    // Update previous doom for next transition
    previousDoom = doom;
    if (doomMeterTop) {
      doomMeterTop.classList.toggle('doom-ambient-hot', doom > 75);
    }

    // Update doom tooltip
    updateDoomTooltip(doom);

    // Update onboarding banner
    updateOnboardingBanner();

    // Update stakes trigger card
    updateStakesTriggerCard(doom);

    // Update due today section
    renderDueToday();

    // Update time critical section
    renderTimeCritical();

    // Check doom recommendation triggers
    checkDoomRecommendationTriggers(doom);

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

  function updateStakesTriggerCard(doom) {
    const card = document.getElementById('stakes-trigger-card');
    if (!card) return;

    // Check if temporarily dismissed
    const dismissedUntil = localStorage.getItem('stakes_trigger_dismissed_until');
    if (dismissedUntil) {
      const until = parseInt(dismissedUntil, 10);
      if (Date.now() < until) {
        card.classList.remove('visible');
        return;
      } else {
        localStorage.removeItem('stakes_trigger_dismissed_until');
      }
    }

    // Only show if doom > 50% and stakes onboarding is complete
    if (doom <= 50 || !stakes.onboarding_complete) {
      card.classList.remove('visible');
      return;
    }

    // Find the goal with the nearest deadline
    const now = new Date();
    const goalsWithDeadlines = goals
      .filter((g) => g.deadline && isValidDate(new Date(g.deadline)))
      .map((g) => ({
        ...g,
        deadlineDate: new Date(g.deadline),
        daysLeft: Math.ceil((new Date(g.deadline) - now) / 86400000),
      }))
      .filter((g) => g.daysLeft > 0)
      .sort((a, b) => a.daysLeft - b.daysLeft);

    if (goalsWithDeadlines.length === 0) {
      card.classList.remove('visible');
      return;
    }

    const nearestGoal = goalsWithDeadlines[0];
    const daysEl = document.getElementById('stakes-days');
    const quoteEl = document.getElementById('stakes-quote');

    if (daysEl) {
      daysEl.textContent = `${nearestGoal.daysLeft} days until your ${nearestGoal.title} deadline.`;
    }

    if (quoteEl) {
      // Use their own words from stakes onboarding
      const quote = stakes.life_context.what_failure_looks_like || stakes.life_context.biggest_fear || '';
      quoteEl.textContent = quote ? `You said:\n'${quote}'` : '';
    }

    card.classList.add('visible');
  }

  function renderDueToday() {
    const section = document.getElementById('due-today-section');
    const cardsContainer = document.getElementById('due-today-cards');
    if (!section || !cardsContainer) return;

    const now = new Date();
    const dueTodayGoals = goals
      .filter((g) => {
        const hoursLeft = getHoursLeft(g);
        return hoursLeft > 0 && hoursLeft <= 24;
      })
      .sort((a, b) => getHoursLeft(a) - getHoursLeft(b));

    if (dueTodayGoals.length === 0) {
      section.classList.add('hidden');
      return;
    }

    section.classList.remove('hidden');

    cardsContainer.innerHTML = dueTodayGoals.map((goal) => {
      const hoursLeft = getHoursLeft(goal);
      const progress = safeProgress(goal.logged_hours, goal.total_hours);
      const isUrgent = hoursLeft < 3;
      const borderClass = isUrgent ? 'urgent' : 'warning';
      const timeDisplay = formatDeadlineWithTime(goal);
      const hoursRemaining = goal.total_hours - (Number(goal.logged_hours) || 0);
      const pomodorosNeeded = Math.ceil(hoursRemaining / 0.5);

      return `
        <div class="due-today-card ${borderClass}" data-goal-id="${escapeHtml(goal.id)}">
          <div class="due-today-card-header">
            <div class="due-today-card-title">
              ⚡ ${escapeHtml(goal.title)}
            </div>
            <div class="due-today-card-time">due ${timeDisplay}</div>
          </div>
          <div class="due-today-card-progress">
            <div class="due-today-card-progress-bar">
              <div class="due-today-card-progress-fill" style="width: ${progress}%"></div>
            </div>
            <div class="due-today-card-progress-text">${Number(goal.logged_hours) || 0}h / ${Number(goal.total_hours) || 0}h logged</div>
          </div>
          <div class="due-today-card-footer">
            <div class="due-today-card-info">${hoursRemaining.toFixed(1)}h remaining · need ${pomodorosNeeded} pomodoros now</div>
            <button class="due-today-card-action" data-action="start-focus" data-goal-id="${escapeHtml(goal.id)}">Start Focus →</button>
          </div>
        </div>
      `;
    }).join('');
  }

  function renderTimeCritical() {
    const section = document.getElementById('time-critical-section');
    const listContainer = document.getElementById('time-critical-list');
    if (!section || !listContainer) return;

    const now = new Date();
    const criticalGoals = goals
      .filter((g) => {
        const hoursLeft = getHoursLeft(g);
        return hoursLeft > 0 && hoursLeft < 24;
      })
      .sort((a, b) => getHoursLeft(a) - getHoursLeft(b))
      .slice(0, 3);

    if (criticalGoals.length === 0) {
      section.classList.add('hidden');
      return;
    }

    section.classList.remove('hidden');

    listContainer.innerHTML = criticalGoals.map((goal) => {
      const hoursLeft = getHoursLeft(goal);
      const isUrgent = hoursLeft < 3;
      const colorClass = isUrgent ? 'urgent' : 'warning';
      
      // Format hours left as "Xh Ym"
      const h = Math.floor(hoursLeft);
      const m = Math.floor((hoursLeft - h) * 60);
      const timeStr = h > 0 ? `${h}h ${m}m` : `${m}m`;

      return `
        <div class="time-critical-item ${colorClass}">
          <span>${escapeHtml(goal.title)}</span>
          <span class="time-critical-item-time">${timeStr} left</span>
        </div>
      `;
    }).join('');
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

  const pomodoroStart = document.getElementById('pomodoro-start');
  const pomodoroReset = document.getElementById('pomodoro-reset');
  const sessionDots = document.getElementById('session-dots');
  const pomodoroShortBreak = document.getElementById('pomodoro-short-break');
  const pomodoroLongBreak = document.getElementById('pomodoro-long-break');
  const pomodoroResumeBanner = document.getElementById('pomodoro-resume-banner');
  const resumeText = document.getElementById('resume-text');
  const pomodoroResume = document.getElementById('pomodoro-resume');
  const pomodoroLogIt = document.getElementById('pomodoro-log-it');
  const timerFocusInput = document.getElementById('timer-focus-input');
  const timerBreakInput = document.getElementById('timer-break-input');
  const timerSettingsApply = document.getElementById('timer-settings-apply');
  const settingsSaved = document.getElementById('settings-saved');

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
    const timerSvgText = document.getElementById('timer-svg-text');
    const timerSvgLabel = document.getElementById('timer-svg-label');
    const timerRing = document.getElementById('timer-ring');
    
    if (timerSvgText) {
      timerSvgText.textContent = formatTime(pomodoroState.timeLeft);
    }
    if (timerSvgLabel) {
      timerSvgLabel.textContent = pomodoroState.isBreak ? 'Break Time' : 'Focus Session';
    }
    pomodoroStart.textContent = pomodoroState.isRunning ? 'Pause' : 'Start';

    // Update ring progress
    if (timerRing) {
      const total = pomodoroState.isBreak
        ? (pomodoroState.breakDuration || 5 * 60)
        : (pomodoroState.customDuration * 60);
      const circumference = 2 * Math.PI * 85; // 534
      const progress = pomodoroState.timeLeft / total;
      const offset = circumference * (1 - progress);
      timerRing.setAttribute('stroke-dashoffset', offset);

      // Update ring color for break mode
      if (pomodoroState.isBreak) {
        timerRing.setAttribute('stroke', '#3d7eff');
      } else {
        timerRing.setAttribute('stroke', '#ff8c00');
      }
    }
  }

  function onPomodoroTick() {
    pomodoroState.timeLeft--;

    if (pomodoroState.timeLeft > 0) {
      updatePomodoroDisplay();
      saveTimerProgress();
      return;
    }

    clearInterval(pomodoroState.interval);
    pomodoroState.interval = null;

    if (!pomodoroState.isBreak) {
      const duration = pomodoroState.customDuration || 25;
      sessions.push({
        id: generateId(),
        duration_minutes: duration,
        quest_id: null,
        habit_id: null,
        note: '',
        logged_at: new Date().toISOString(),
        type: 'pomodoro',
      });
      saveData(STORAGE_KEYS.SESSIONS, sessions);
      renderSessionDots();
      creditPomodoroHours(duration);
      updateDoomMeter();
      window.dispatchEvent(new CustomEvent('orbit:sessionComplete'));

      // Clear saved progress on completion
      clearTimerProgress();

      pomodoroState.isBreak = true;
      const breakMinutes = parseInt(localStorage.getItem('orbit_timer_break') || '5', 10);
      pomodoroState.breakDuration = breakMinutes * 60;
      pomodoroState.timeLeft = breakMinutes * 60;
      pomodoroState.isRunning = true;
      pomodoroState.interval = setInterval(onPomodoroTick, 1000);
    } else {
      pomodoroState.isBreak = false;
      pomodoroState.timeLeft = pomodoroState.customDuration * 60;
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
    // Save progress before resetting if timer was running
    if (pomodoroState.isRunning && pomodoroState.timeLeft > 0) {
      saveTimerProgress();
    }

    clearInterval(pomodoroState.interval);
    pomodoroState.interval = null;
    pomodoroState.isRunning = false;
    pomodoroState.isBreak = false;
    pomodoroState.timeLeft = pomodoroState.customDuration * 60;
    updatePomodoroDisplay();
  }

  function saveTimerProgress() {
    if (pomodoroState.isRunning && pomodoroState.timeLeft > 0) {
      const total = pomodoroState.isBreak
        ? (pomodoroState.breakDuration || 5 * 60)
        : (pomodoroState.customDuration * 60);
      const elapsed = total - pomodoroState.timeLeft;
      localStorage.setItem('orbit_timer_progress', JSON.stringify({
        timeLeft: pomodoroState.timeLeft,
        isBreak: pomodoroState.isBreak,
        breakDuration: pomodoroState.breakDuration,
        customDuration: pomodoroState.customDuration,
        elapsed: elapsed,
        timestamp: Date.now(),
      }));
    }
  }

  function clearTimerProgress() {
    localStorage.removeItem('orbit_timer_progress');
  }

  function loadTimerProgress() {
    const saved = localStorage.getItem('orbit_timer_progress');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        // Only show resume banner if it's from the same day
        const savedDate = new Date(data.timestamp);
        const today = new Date();
        if (savedDate.toDateString() === today.toDateString()) {
          return data;
        } else {
          clearTimerProgress();
        }
      } catch (e) {
        clearTimerProgress();
      }
    }
    return null;
  }

  function showResumeBanner(progress) {
    if (!progress || !pomodoroResumeBanner || !resumeText) return;

    const elapsedMins = Math.round(progress.elapsed / 60);
    resumeText.textContent = `Unfinished session: ${elapsedMins}min — Resume or Log it`;
    pomodoroResumeBanner.classList.add('visible');
  }

  function hideResumeBanner() {
    if (pomodoroResumeBanner) {
      pomodoroResumeBanner.classList.remove('visible');
    }
  }

  function resumeTimer() {
    const progress = loadTimerProgress();
    if (progress) {
      pomodoroState.timeLeft = progress.timeLeft;
      pomodoroState.isBreak = progress.isBreak;
      pomodoroState.breakDuration = progress.breakDuration;
      pomodoroState.customDuration = progress.customDuration;
      hideResumeBanner();
      updatePomodoroDisplay();
    }
  }

  function logUnfinishedSession() {
    const progress = loadTimerProgress();
    if (progress) {
      const duration = Math.round(progress.elapsed / 60);
      if (duration > 0) {
        sessions.push({
          id: generateId(),
          duration_minutes: duration,
          quest_id: null,
          habit_id: null,
          note: '',
          logged_at: new Date().toISOString(),
          type: 'pomodoro',
        });
        saveData(STORAGE_KEYS.SESSIONS, sessions);
        renderSessionDots();
        creditPomodoroHours(duration);
        updateDoomMeter();
      }
      clearTimerProgress();
      hideResumeBanner();
      resetPomodoro();
    }
  }

  function startBreak(duration) {
    clearInterval(pomodoroState.interval);
    pomodoroState.interval = null;
    pomodoroState.isRunning = false;
    pomodoroState.isBreak = true;
    pomodoroState.breakDuration = duration;
    pomodoroState.timeLeft = duration;
    updatePomodoroDisplay();
  }

  function applyTimerSettings() {
    const focusMinutes = parseInt(timerFocusInput.value, 10);
    const breakMinutes = parseInt(timerBreakInput.value, 10);
    
    if (focusMinutes >= 1 && focusMinutes <= 120 && breakMinutes >= 1 && breakMinutes <= 60) {
      pomodoroState.customDuration = focusMinutes;
      localStorage.setItem('orbit_timer_focus', focusMinutes);
      localStorage.setItem('orbit_timer_break', breakMinutes);
      
      if (!pomodoroState.isRunning && !pomodoroState.isBreak) {
        pomodoroState.timeLeft = focusMinutes * 60;
        updatePomodoroDisplay();
      }
      
      // Show saved confirmation
      settingsSaved.classList.add('visible');
      setTimeout(() => {
        settingsSaved.classList.remove('visible');
      }, 1500);
    }
  }

  pomodoroStart.addEventListener('click', startPomodoro);
  pomodoroReset.addEventListener('click', resetPomodoro);

  // Break mode buttons
  if (pomodoroShortBreak) {
    pomodoroShortBreak.addEventListener('click', () => {
      const breakMinutes = parseInt(localStorage.getItem('orbit_timer_break') || '5', 10);
      startBreak(breakMinutes * 60);
    });
  }
  if (pomodoroLongBreak) {
    pomodoroLongBreak.addEventListener('click', () => {
      const breakMinutes = parseInt(localStorage.getItem('orbit_timer_break') || '5', 10);
      startBreak(breakMinutes * 3); // Long break is 3x short break
    });
  }

  // Settings apply button
  if (timerSettingsApply) {
    timerSettingsApply.addEventListener('click', applyTimerSettings);
  }

  // Resume banner buttons
  if (pomodoroResume) {
    pomodoroResume.addEventListener('click', resumeTimer);
  }
  if (pomodoroLogIt) {
    pomodoroLogIt.addEventListener('click', logUnfinishedSession);
  }

  // Load timer settings from localStorage
  const savedFocusMinutes = localStorage.getItem('orbit_timer_focus');
  const savedBreakMinutes = localStorage.getItem('orbit_timer_break');
  
  if (savedFocusMinutes) {
    const value = parseInt(savedFocusMinutes, 10);
    if (value >= 1 && value <= 120) {
      pomodoroState.customDuration = value;
      if (timerFocusInput) {
        timerFocusInput.value = value;
      }
      if (!pomodoroState.isRunning && !pomodoroState.isBreak) {
        pomodoroState.timeLeft = value * 60;
      }
    }
  }
  
  if (savedBreakMinutes && timerBreakInput) {
    const value = parseInt(savedBreakMinutes, 10);
    if (value >= 1 && value <= 60) {
      timerBreakInput.value = value;
    }
  }

  // Load saved progress and show resume banner if applicable
  const savedProgress = loadTimerProgress();
  if (savedProgress) {
    showResumeBanner(savedProgress);
  }

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

  function formatDeadlineWithTime(goal) {
    const date = new Date(goal.deadline);
    if (!isValidDate(date)) return 'No date';
    const now = new Date();

    // If manual hours override is set
    if (goal.hours_remaining_override !== null) {
      const hours = goal.hours_remaining_override;
      if (hours <= 0) return 'Overdue';
      if (hours < 1) return `${Math.floor(hours * 60)}m left`;
      return `${hours}h left`;
    }

    // If has time deadline
    if (goal.has_time_deadline && goal.deadline_time) {
      const fullDeadline = new Date(goal.deadline + 'T' + goal.deadline_time);
      if (!isValidDate(fullDeadline)) return formatDeadline(goal.deadline);
      
      const hoursLeft = (fullDeadline - now) / 3600000;
      
      if (hoursLeft <= 0) return 'Overdue';
      if (hoursLeft < 1) return `${Math.floor(hoursLeft * 60)}m left`;
      if (hoursLeft < 24) {
        const isToday = date.toDateString() === now.toDateString();
        const timeStr = fullDeadline.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        return isToday ? `${timeStr}` : `${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · ${timeStr}`;
      }
      
      // More than 24 hours, show date only
      return formatDeadline(goal.deadline);
    }

    // No time deadline, use existing format
    return formatDeadline(goal.deadline);
  }

  function getHoursLeft(goal) {
    const now = new Date();
    
    // If manual hours override is set
    if (goal.hours_remaining_override !== null) {
      return goal.hours_remaining_override;
    }

    // If has time deadline
    if (goal.has_time_deadline && goal.deadline_time) {
      const fullDeadline = new Date(goal.deadline + 'T' + goal.deadline_time);
      if (!isValidDate(fullDeadline)) {
        const date = new Date(goal.deadline);
        if (!isValidDate(date)) return 0;
        return (date - now) / 3600000;
      }
      return (fullDeadline - now) / 3600000;
    }

    // No time deadline, convert days to hours
    const date = new Date(goal.deadline);
    if (!isValidDate(date)) return 0;
    const daysLeft = Math.ceil((date - now) / 86400000);
    return daysLeft * 24;
  }

  function getDeadlineColorClass(goal) {
    const hoursLeft = getHoursLeft(goal);
    if (hoursLeft <= 0) return 'deadline-overdue';
    if (hoursLeft < 1) return 'deadline-urgent';
    if (hoursLeft < 6) return 'deadline-critical';
    if (hoursLeft < 24) return 'deadline-warning';
    return '';
  }

  function renderGoalCard(goal, showDelete) {
    const progress = safeProgress(goal.logged_hours, goal.total_hours);
    const priority = getPriorityLabel(goal.priority);
    const vision = visions.find((v) => v.id === goal.linked_vision_id);
    const visionTag = vision
      ? `<span class="goal-tag">${escapeHtml(vision.title.length > 12 ? vision.title.substring(0, 12) + '...' : vision.title)}</span>`
      : '';

    const goalStakes = stakes.goal_stakes[goal.id] || {
      personal_stake: '',
      consequence_if_missed: '',
      who_affected: '',
      emotional_weight: 3,
    };

    const deadlineColorClass = getDeadlineColorClass(goal);
    const deadlineDisplay = formatDeadlineWithTime(goal);
    const hoursLeft = getHoursLeft(goal);
    const hasTimeSet = goal.has_time_deadline || goal.hours_remaining_override !== null;

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
          <span class="goal-deadline ${deadlineColorClass}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="4" width="18" height="18" rx="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            ${deadlineDisplay}
            ${hoursLeft < 1 ? '<span class="urgent-badge">URGENT</span>' : ''}
            <button class="deadline-time-toggle" data-goal-id="${escapeHtml(goal.id)}" data-action="toggle-deadline-time" aria-label="Add time">
              ${hasTimeSet ? '▾' : 'add time'}
            </button>
          </span>
        </div>
        <div class="goal-deadline-time-input" id="deadline-time-${escapeHtml(goal.id)}" style="display: none;">
          <div class="deadline-time-field">
            <label>Deadline time</label>
            <input type="time" class="deadline-time-picker" data-goal-id="${escapeHtml(goal.id)}" value="${escapeHtml(goal.deadline_time || '23:59')}">
          </div>
          <div class="deadline-time-field">
            <label>
              <input type="checkbox" class="deadline-hours-override-check" data-goal-id="${escapeHtml(goal.id)}" ${goal.hours_remaining_override !== null ? 'checked' : ''}>
              I only have 
              <input type="number" class="deadline-hours-override" data-goal-id="${escapeHtml(goal.id)}" value="${goal.hours_remaining_override !== null ? goal.hours_remaining_override : ''}" min="0" step="0.5" placeholder="5">
              hours available today
            </label>
          </div>
          <button class="deadline-time-save" data-goal-id="${escapeHtml(goal.id)}">Save</button>
        </div>
        <div class="goal-stakes-section">
          <button class="goal-stakes-toggle" data-goal-id="${escapeHtml(goal.id)}" data-action="toggle-stakes">
            WHY THIS ACTUALLY MATTERS
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="6,9 12,15 18,9"/>
            </svg>
          </button>
          <div class="goal-stakes-content" id="goal-stakes-${escapeHtml(goal.id)}" style="display: none;">
            <div class="goal-stakes-field">
              <label>What do you lose if this goal fails?</label>
              <textarea class="goal-stakes-input" data-goal-id="${escapeHtml(goal.id)}" data-field="personal_stake" placeholder="e.g., The job offer I'm counting on...">${escapeHtml(goalStakes.personal_stake)}</textarea>
            </div>
            <div class="goal-stakes-field">
              <label>Who's affected?</label>
              <textarea class="goal-stakes-input" data-goal-id="${escapeHtml(goal.id)}" data-field="who_affected" placeholder="e.g., My family, my team...">${escapeHtml(goalStakes.who_affected)}</textarea>
            </div>
            <div class="goal-stakes-field">
              <label>Emotional weight: ${goalStakes.emotional_weight}</label>
              <input type="range" class="goal-stakes-slider" data-goal-id="${escapeHtml(goal.id)}" min="1" max="5" value="${goalStakes.emotional_weight}">
              <div class="goal-stakes-slider-labels">
                <span>nice to have</span>
                <span>changes everything</span>
              </div>
            </div>
          </div>
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

  // Handle deadline time toggle
  goalsGrid.addEventListener('click', (e) => {
    const toggleBtn = e.target.closest('[data-action="toggle-deadline-time"]');
    if (!toggleBtn) return;

    const goalId = toggleBtn.dataset.goalId;
    const timeInput = document.getElementById(`deadline-time-${goalId}`);
    if (timeInput) {
      const isHidden = timeInput.style.display === 'none';
      timeInput.style.display = isHidden ? 'block' : 'none';
    }
  });

  // Handle deadline time save
  goalsGrid.addEventListener('click', (e) => {
    const saveBtn = e.target.closest('.deadline-time-save');
    if (!saveBtn) return;

    const goalId = saveBtn.dataset.goalId;
    const goal = goals.find((g) => g.id === goalId);
    if (!goal) return;

    const timePicker = document.querySelector(`.deadline-time-picker[data-goal-id="${goalId}"]`);
    const overrideCheck = document.querySelector(`.deadline-hours-override-check[data-goal-id="${goalId}"]`);
    const overrideInput = document.querySelector(`.deadline-hours-override[data-goal-id="${goalId}"]`);

    if (timePicker) {
      goal.deadline_time = timePicker.value || '23:59';
      goal.has_time_deadline = true;
    }

    if (overrideCheck && overrideInput) {
      if (overrideCheck.checked && overrideInput.value) {
        goal.hours_remaining_override = parseFloat(overrideInput.value);
      } else {
        goal.hours_remaining_override = null;
      }
    }

    saveData(STORAGE_KEYS.GOALS, goals);
    renderGoals();
    updateDoomMeter();
  });

  // Handle due today start focus button
  document.addEventListener('click', (e) => {
    const startFocusBtn = e.target.closest('[data-action="start-focus"]');
    if (!startFocusBtn) return;

    const goalId = startFocusBtn.dataset.goalId;
    // Start pomodoro timer for this goal
    // The pomodoro timer will automatically credit hours to the most behind goal
    // which should be this one since it's due today
    const startBtn = document.getElementById('pomodoro-start');
    if (startBtn) {
      startBtn.click();
    }
  });

  // Handle stakes toggle and save
  goalsGrid.addEventListener('click', (e) => {
    const toggleBtn = e.target.closest('[data-action="toggle-stakes"]');
    if (!toggleBtn) return;

    const goalId = toggleBtn.dataset.goalId;
    const content = document.getElementById(`goal-stakes-${goalId}`);
    if (content) {
      const isExpanded = content.classList.contains('expanded');
      content.classList.toggle('expanded', !isExpanded);
      toggleBtn.classList.toggle('expanded', !isExpanded);
    }
  });

  goalsGrid.addEventListener('input', (e) => {
    const stakesInput = e.target.closest('.goal-stakes-input');
    if (stakesInput) {
      const goalId = stakesInput.dataset.goalId;
      const field = stakesInput.dataset.field;
      if (!stakes.goal_stakes[goalId]) {
        stakes.goal_stakes[goalId] = {
          personal_stake: '',
          consequence_if_missed: '',
          who_affected: '',
          emotional_weight: 3,
        };
      }
      stakes.goal_stakes[goalId][field] = stakesInput.value;
      saveData(STORAGE_KEYS.STAKES, stakes);
    }

    const stakesSlider = e.target.closest('.goal-stakes-slider');
    if (stakesSlider) {
      const goalId = stakesSlider.dataset.goalId;
      const label = stakesSlider.previousElementSibling;
      if (!stakes.goal_stakes[goalId]) {
        stakes.goal_stakes[goalId] = {
          personal_stake: '',
          consequence_if_missed: '',
          who_affected: '',
          emotional_weight: 3,
        };
      }
      stakes.goal_stakes[goalId].emotional_weight = parseInt(stakesSlider.value, 10);
      if (label) {
        label.textContent = `Emotional weight: ${stakesSlider.value}`;
      }
      saveData(STORAGE_KEYS.STAKES, stakes);
    }
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
      deadline_time: '23:59',
      has_time_deadline: false,
      hours_remaining_override: null,
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

    const stakesData = loadData(STORAGE_KEYS.STAKES, {
      life_context: {},
      goal_stakes: {},
      onboarding_complete: false,
    });

    let stakesSection = '';
    if (stakesData.onboarding_complete && Object.keys(stakesData.life_context).length > 0) {
      // Format life context for readability
      const lifeContextStr = Object.entries(stakesData.life_context)
        .filter(([_, value]) => value && value.trim())
        .map(([key, value]) => `- ${key.replace(/_/g, ' ')}: ${value}`)
        .join('\n');

      // Format goal stakes for readability
      const goalStakesStr = Object.entries(stakesData.goal_stakes)
        .map(([goalId, stakeData]) => {
          const goal = goals.find(g => g.id === goalId);
          const goalTitle = goal ? goal.title : goalId;
          const parts = [];
          if (stakeData.personal_stake) parts.push(`Loss: ${stakeData.personal_stake}`);
          if (stakeData.who_affected) parts.push(`Affected: ${stakeData.who_affected}`);
          if (stakeData.emotional_weight) parts.push(`Weight: ${stakeData.emotional_weight}/5`);
          return `- "${goalTitle}": ${parts.join(' | ')}`;
        })
        .join('\n');

      stakesSection = `
WHAT THIS PERSON IS ACTUALLY RISKING:
Life context:
${lifeContextStr || 'Not specified'}

Per-goal stakes:
${goalStakesStr || 'No goal stakes set'}

BEHAVIOR RULES:
- When doom > 50%, reference consequences instead of tasks
- Avoid generic productivity language
- Mention: people affected, future risks, emotional stakes, deadlines
- Example: Instead of "You're behind on DSA", use "The interview your parents are depending on is in X days and you've studied Y hours."
`;
    }

    const totalPoints = getTotalPoints();
    const level = getCurrentLevel(totalPoints);
    const nextLevel = getNextLevel(totalPoints);

    return `You are ORBIT — a life companion AI. Not a productivity coach. Not a therapist. A genuine friend who happens to know everything about what the user is working toward.

Now: ${now.toLocaleString()}

USER CONTEXT (from memory):
${JSON.stringify(memory, null, 2)}

${stakesSection}
Current level: ${level.title} — ${level.subtitle}
Total orbit points: ${totalPoints}
Next level: ${nextLevel ? nextLevel.title + ' (' + (nextLevel.min - totalPoints) + ' pts away)' : 'MAX LEVEL'}

LIFE VISION:
${visions.map((v) => `- ${v.title} (Target: ${v.target_year}) - "${v.why || 'No reason specified'}"`).join('\n') || 'No visions set yet'}

ACTIVE GOALS:
${
  goals
    .map((g) => {
      const progress = safeProgress(g.logged_hours, g.total_hours);
      const hoursLeft = getHoursLeft(g);
      const hoursLogged = Number(g.logged_hours) || 0;
      const totalHours = Number(g.total_hours) || 1;
      
      // Calculate behind by
      const deadline = new Date(g.deadline);
      const created = new Date(g.created_at || now);
      let fullDeadline = deadline;
      if (g.has_time_deadline && g.deadline_time) {
        fullDeadline = new Date(g.deadline + 'T' + g.deadline_time);
      }
      const totalDuration = fullDeadline - created;
      const elapsed = now - created;
      const expectedPct = Math.min(1, Math.max(0, elapsed / totalDuration));
      const expectedHours = totalHours * expectedPct;
      const behindBy = Math.max(0, expectedHours - hoursLogged);
      
      return `- ${g.title}: ${hoursLeft.toFixed(1)}h until deadline, ${hoursLogged}h/${totalHours}h logged, ${behindBy.toFixed(1)}h behind pace`;
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
8. Doom meter affects your tone: ${doom <= 25 ? 'Calm and casual' : doom <= 50 ? 'Gently encouraging' : doom <= 70 ? 'More direct about priorities' : 'Honest about what needs to happen'}.
9. When a goal has less than 24 hours remaining, treat it as the highest priority in the conversation. Reference the exact hours left, not just the date. Time is the variable that matters now.
10. Reference the user's level naturally when relevant. If they're close to leveling up, mention it as motivation — not pressure.`;
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

    // Extract stakes from user message
    extractStakesFromMessage(message);

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

  // Stakes onboarding flow
  function initStakesOnboarding() {
    const overlay = document.getElementById('stakes-onboarding-overlay');
    if (!overlay) return;

    // Only show if onboarding is not complete
    if (stakes.onboarding_complete) {
      return;
    }

    overlay.classList.add('visible');

    let currentStep = 1;
    const answers = {};

    function showStep(step) {
      for (let i = 1; i <= 4; i++) {
        const stepEl = document.getElementById(`stakes-step-${i}`);
        if (stepEl) {
          stepEl.style.display = i === step ? 'block' : 'none';
        }
      }
    }

    function saveAndContinue(step) {
      const answerEl = document.getElementById(`stakes-answer-${step}`);
      if (answerEl) {
        answers[`answer_${step}`] = answerEl.value;
      }

      if (step < 4) {
        currentStep = step + 1;
        showStep(currentStep);
      } else {
        finishOnboarding();
      }
    }

    function skipOnboarding() {
      stakes.onboarding_complete = true;
      saveData(STORAGE_KEYS.STAKES, stakes);
      overlay.classList.remove('visible');
    }

    function finishOnboarding() {
      stakes.life_context.what_failure_looks_like = answers.answer_1 || '';
      stakes.life_context.who_depends_on_you = answers.answer_2 || '';
      stakes.life_context.biggest_fear = answers.answer_3 || '';
      stakes.life_context.what_success_unlocks = answers.answer_4 || '';
      stakes.onboarding_complete = true;
      saveData(STORAGE_KEYS.STAKES, stakes);
      overlay.classList.remove('visible');
    }

    // Add event listeners
    for (let i = 1; i <= 4; i++) {
      const continueBtn = document.getElementById(`stakes-continue-${i}`);
      const skipBtn = document.getElementById(`stakes-skip-${i}`);
      
      if (continueBtn) {
        continueBtn.addEventListener('click', () => saveAndContinue(i));
      }
      if (skipBtn) {
        skipBtn.addEventListener('click', skipOnboarding);
      }
    }

    const finishBtn = document.getElementById('stakes-finish');
    if (finishBtn) {
      finishBtn.addEventListener('click', () => saveAndContinue(4));
    }
  }

  initStakesOnboarding();

  // Stakes trigger card button handlers
  const stakesTriggerAction = document.getElementById('stakes-trigger-action');
  const stakesTriggerDismiss = document.getElementById('stakes-trigger-dismiss');
  
  if (stakesTriggerAction) {
    stakesTriggerAction.addEventListener('click', () => {
      // Open chat panel
      const panel = document.getElementById('chat-panel');
      const toggle = document.getElementById('header-chat-toggle');
      if (panel && toggle) {
        panel.classList.remove('collapsed');
        document.body.classList.add('chat-open');
        toggle.classList.add('active');
        localStorage.setItem('orbit_chat_open', 'true');
        
        // Pre-fill message
        const chatInput = document.getElementById('chat-input');
        if (chatInput) {
          chatInput.value = 'I saw my reality check. Tell me exactly what I need to do today to turn this around.';
          chatInput.focus();
        }
      }
    });
  }
  
  if (stakesTriggerDismiss) {
    stakesTriggerDismiss.addEventListener('click', () => {
      // Temporarily dismiss for 4 hours
      localStorage.setItem('stakes_trigger_dismissed_until', String(Date.now() + 4 * 60 * 60 * 1000));
      
      // Hide the card
      const card = document.getElementById('stakes-trigger-card');
      if (card) {
        card.classList.remove('visible');
      }
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

  // Check stakes onboarding on app initialization
  checkStakesOnboarding();
})();
