/**
 * ORBIT Auth and Sync System
 * Handles authentication UI, cloud sync, and conflict resolution
 */

(function() {
  'use strict';

  // ============================================================================
  // CONFIGURATION
  // ============================================================================

  const SYNC_DEBOUNCE_MS = 5000; // 5 seconds debounce
  const STORAGE_KEYS = [
    'orbit_checklist',
    'orbit_daily_checklist',
    'orbit_today_checklist',
    'orbit_daily_reset_date',
    'orbit_goals',
    'orbit_visions',
    'orbit_sessions',
    'orbit_memory',
    'orbit_chat',
    'orbit_chat_open',
    'orbit_stakes',
    'orbit_doom_recommendations',
    'orbit_weekly_template',
    'orbit_today_override',
    'orbit_quick_tasks',
    'orbit_timetable_blocks',
    'orbit_letters',
    'orbit_weekly_reports',
    'orbit_last_report_date',
    'orbit_onboarding_complete',
    'orbit_free_usage',
    'orbit_streak',
    'orbit_daily_activity',
    'orbit_session_points_ui',
    'orbit_habit_points_ui'
  ];

  // ============================================================================
  // STATE
  // ============================================================================

  let syncTimeout = null;
  let isSyncing = false;

  // ============================================================================
  // DOM ELEMENTS
  // ============================================================================

  const authSection = document.getElementById('auth-section');
  const conflictModal = document.getElementById('conflict-modal');
  const conflictUseCloud = document.getElementById('conflict-use-cloud');
  const conflictUseLocal = document.getElementById('conflict-use-local');

  // ============================================================================
  // AUTH UI
  // ============================================================================

  function updateAuthUI() {
    if (!authSection) return;

    if (!window.ORBIT_SUPABASE || !window.ORBIT_SUPABASE.isAvailable) {
      // Supabase not available - show nothing
      authSection.innerHTML = '';
      return;
    }

    if (window.ORBIT_SUPABASE.isSignedIn && window.ORBIT_SUPABASE.user) {
      const user = window.ORBIT_SUPABASE.user;
      const email = user.email;
      const name = user.user_metadata?.full_name || user.user_metadata?.name || email;

      // Log user metadata for debugging
      console.log('[ORBIT Auth] User metadata:', user.user_metadata);
      console.log('[ORBIT Auth] Identity data:', user.identities);

      // Try multiple possible fields for Google profile image
      const avatarUrl = user.user_metadata?.picture ||
                        user.user_metadata?.avatar_url ||
                        user.identities?.[0]?.identity_data?.avatar_url ||
                        user.identities?.[0]?.identity_data?.picture;

      const syncStatus = window.ORBIT_SUPABASE.syncStatus;
      let syncIndicator = '';

      if (syncStatus === 'syncing') {
        syncIndicator = '<span class="sync-indicator syncing">⏳ Syncing</span>';
      } else if (syncStatus === 'synced') {
        syncIndicator = '<span class="sync-indicator synced">☁ Synced</span>';
      } else if (syncStatus === 'error') {
        syncIndicator = '<span class="sync-indicator error">⚠ Offline</span>';
      } else {
        syncIndicator = '<span class="sync-indicator">☁ Synced</span>';
      }

      const avatarHtml = avatarUrl
        ? `<img src="${escapeHtml(avatarUrl)}" alt="" class="auth-avatar-img" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" /><div class="auth-avatar-initials" style="display:none;">${escapeHtml(name.charAt(0).toUpperCase())}</div>`
        : `<div class="auth-avatar-initials">${escapeHtml(name.charAt(0).toUpperCase())}</div>`;

      authSection.innerHTML = `
        <div class="auth-card">
          <div class="auth-card-header">
            <div class="auth-avatar">${avatarHtml}</div>
            <div class="auth-info">
              <div class="auth-name" title="${escapeHtml(email)}">${escapeHtml(name)}</div>
              ${syncIndicator}
            </div>
            <div class="auth-actions">
              <button type="button" class="auth-icon-button" id="auth-signout-link" title="Sign out">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                  <polyline points="16,17 21,12 16,7"/>
                  <line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      `;

      // Re-attach sign out listener
      const signoutLink = document.getElementById('auth-signout-link');
      if (signoutLink) {
        signoutLink.addEventListener('click', handleSignOut);
      }
    } else {
      authSection.innerHTML = `
        <div class="auth-card">
          <div class="auth-card-header">
            <div class="auth-avatar auth-avatar-google">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
            </div>
            <div class="auth-info">
              <div class="auth-title">Cloud Sync</div>
              <div class="auth-subtitle">Sign in to back up your progress</div>
            </div>
            <div class="auth-actions">
              <button type="button" class="auth-button" id="auth-signin-link">Sign in</button>
            </div>
          </div>
        </div>
      `;
      const signinLink = document.getElementById('auth-signin-link');
      if (signinLink) {
        signinLink.addEventListener('click', handleSignIn);
      }
    }
  }

  async function handleSignIn(e) {
    if (e) e.preventDefault();

    if (!window.ORBIT_SUPABASE || !window.ORBIT_SUPABASE.isAvailable) {
      console.error('[ORBIT Auth] Supabase is not configured. Running in offline mode.');
      return;
    }

    const result = await window.ORBIT_SUPABASE.signInWithGoogle();

    if (result.error) {
      console.error('[ORBIT Auth] Google sign in error:', result.error);
    }
  }

  async function handleSignOut(e) {
    if (e) e.preventDefault();
    
    if (window.ORBIT_SUPABASE && window.ORBIT_SUPABASE.signOut) {
      await window.ORBIT_SUPABASE.signOut();
    }
    updateAuthUI();
  }

  // ============================================================================
  // CLOUD SYNC
  // ============================================================================

  /**
   * Get all ORBIT data from localStorage
   * @returns {Object} All ORBIT data
   */
  function getAllLocalData() {
    const data = {};
    STORAGE_KEYS.forEach(key => {
      try {
        const value = localStorage.getItem(key);
        if (value) {
          data[key] = JSON.parse(value);
        }
      } catch (err) {
        console.error(`[ORBIT Sync] Failed to parse ${key}:`, err);
      }
    });
    return data;
  }

  /**
   * Set all ORBIT data to localStorage
   * @param {Object} data - All ORBIT data
   */
  function setAllLocalData(data) {
    STORAGE_KEYS.forEach(key => {
      if (data[key] !== undefined) {
        try {
          localStorage.setItem(key, JSON.stringify(data[key]));
        } catch (err) {
          console.error(`[ORBIT Sync] Failed to save ${key}:`, err);
        }
      }
    });
  }

  /**
   * Trigger sync with debounce
   */
  function triggerSync() {
    if (!window.ORBIT_SUPABASE || !window.ORBIT_SUPABASE.isAvailable) {
      return;
    }

    if (!window.ORBIT_SUPABASE.isSignedIn) {
      return;
    }

    // Clear existing timeout
    if (syncTimeout) {
      clearTimeout(syncTimeout);
    }

    // Update sync status to syncing
    window.ORBIT_SUPABASE.syncStatus = 'syncing';
    updateAuthUI();

    // Debounce sync
    syncTimeout = setTimeout(async () => {
      await performSync();
    }, SYNC_DEBOUNCE_MS);
  }

  /**
   * Perform actual sync
   */
  async function performSync() {
    if (isSyncing) return;
    isSyncing = true;

    try {
      const localData = getAllLocalData();
      const result = await window.ORBIT_SUPABASE.upsertCloudData(localData);

      if (result.error) {
        console.error('[ORBIT Sync] Sync failed:', result.error);
        window.ORBIT_SUPABASE.syncStatus = 'error';
      } else {
        window.ORBIT_SUPABASE.syncStatus = 'synced';
      }
    } catch (err) {
      console.error('[ORBIT Sync] Sync exception:', err);
      window.ORBIT_SUPABASE.syncStatus = 'error';
    } finally {
      isSyncing = false;
      updateAuthUI();
    }
  }

  /**
   * Fetch cloud data and handle conflict resolution
   */
  async function fetchAndResolveCloudData() {
    if (!window.ORBIT_SUPABASE || !window.ORBIT_SUPABASE.isAvailable) {
      return;
    }

    const cloudResult = await window.ORBIT_SUPABASE.fetchCloudData();

    if (cloudResult.error) {
      console.error('[ORBIT Sync] Fetch failed:', cloudResult.error);
      return;
    }

    // No cloud data exists - just sync local data
    if (!cloudResult.data) {
      triggerSync();
      return;
    }

    // Cloud data exists - check if we need to resolve conflict
    const localData = getAllLocalData();
    const cloudUpdatedAt = new Date(cloudResult.updated_at).getTime();

    // Check if conflict has already been resolved
    const conflictResolved = localStorage.getItem('orbit_sync_conflict_resolved');
    if (conflictResolved === 'true') {
      console.log('[ORBIT Sync] Conflict already resolved, skipping modal');
      triggerSync();
      return;
    }

    // Check if local data has been modified (we don't track local timestamps, so we assume local is always newer if it exists)
    const hasLocalData = Object.keys(localData).length > 0;

    if (hasLocalData) {
      // Check if cloud and local data are identical
      const localDataStr = JSON.stringify(localData);
      const cloudDataStr = JSON.stringify(cloudResult.data);

      if (localDataStr === cloudDataStr) {
        console.log('[ORBIT Sync] Cloud and local data are identical, no conflict');
        triggerSync();
        return;
      }

      // Show conflict resolution modal
      console.log('[ORBIT Sync] Conflict detected, showing modal');
      showConflictModal(cloudResult.data, localData);
    } else {
      // No local data, use cloud data
      console.log('[ORBIT Sync] No local data, using cloud data');
      setAllLocalData(cloudResult.data);
      triggerSync();
      // Reload page to apply changes
      window.location.reload();
    }
  }

  function showConflictModal(cloudData, localData) {
    if (!conflictModal) return;

    // Store data for later use
    conflictModal.dataset.cloudData = JSON.stringify(cloudData);
    conflictModal.dataset.localData = JSON.stringify(localData);

    conflictModal.classList.add('active');
  }

  function hideConflictModal() {
    if (conflictModal) {
      conflictModal.classList.remove('active');
      delete conflictModal.dataset.cloudData;
      delete conflictModal.dataset.localData;
    }
  }

  function handleUseCloud() {
    if (!conflictModal || !conflictModal.dataset.cloudData) return;

    try {
      const cloudData = JSON.parse(conflictModal.dataset.cloudData);
      setAllLocalData(cloudData);
      hideConflictModal();
      // Store conflict resolution decision
      localStorage.setItem('orbit_sync_conflict_resolved', 'true');
      console.log('[ORBIT Sync] User chose cloud data');
      triggerSync();
      // Reload page to apply changes
      window.location.reload();
    } catch (err) {
      console.error('[ORBIT Sync] Failed to use cloud data:', err);
      hideConflictModal();
    }
  }

  function handleUseLocal() {
    // Keep local data, just sync it to cloud
    hideConflictModal();
    // Store conflict resolution decision
    localStorage.setItem('orbit_sync_conflict_resolved', 'true');
    console.log('[ORBIT Sync] User chose local data');
    triggerSync();
  }

  // ============================================================================
  // LOCAL STORAGE INTERCEPTION
  // ============================================================================

  /**
   * Intercept localStorage.setItem to trigger sync
   */
  const originalSetItem = localStorage.setItem;
  localStorage.setItem = function(key, value) {
    const result = originalSetItem.call(this, key, value);
    
    // Only trigger sync for ORBIT keys
    if (STORAGE_KEYS.includes(key)) {
      triggerSync();
    }
    
    return result;
  };

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  function init() {
    // Set up Supabase env vars from window if available
    if (typeof window !== 'undefined') {
      window.NEXT_PUBLIC_SUPABASE_URL = window.NEXT_PUBLIC_SUPABASE_URL || '';
      window.NEXT_PUBLIC_SUPABASE_ANON_KEY = window.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    }

    // Initialize auth UI
    updateAuthUI();

    // Set up event listeners for conflict modal
    if (conflictUseCloud) {
      conflictUseCloud.addEventListener('click', handleUseCloud);
    }

    if (conflictUseLocal) {
      conflictUseLocal.addEventListener('click', handleUseLocal);
    }

    // Close conflict modal on overlay click
    if (conflictModal) {
      conflictModal.addEventListener('click', (e) => {
        if (e.target === conflictModal) {
          hideConflictModal();
        }
      });
    }

    // Initialize Supabase auth listener
    if (window.ORBIT_SUPABASE && window.ORBIT_SUPABASE.initAuthListener) {
      window.ORBIT_SUPABASE.initAuthListener(async (event, session) => {
        updateAuthUI();

        if (event === 'SIGNED_IN' && session) {
          // Fetch cloud data and resolve conflicts
          await fetchAndResolveCloudData();
        } else if (event === 'SIGNED_OUT') {
          // Clear sync status
          if (window.ORBIT_SUPABASE) {
            window.ORBIT_SUPABASE.syncStatus = 'idle';
          }
        }
      });

      // Check for existing session on load
      window.ORBIT_SUPABASE.getSession().then(async (session) => {
        if (session && session.user) {
          window.ORBIT_SUPABASE.isSignedIn = true;
          window.ORBIT_SUPABASE.user = session.user;
          updateAuthUI();
          // Fetch cloud data and resolve conflicts
          await fetchAndResolveCloudData();
        }
      });
    }

    console.log('[ORBIT Auth] Auth system initialized');
  }

  // Helper function
  function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
