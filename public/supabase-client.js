/**
 * Supabase client for ORBIT auth and cloud sync
 * Handles authentication and data synchronization with Supabase
 */

(function() {
  'use strict';

  // Check if Supabase CDN is loaded
  if (typeof window.supabase === 'undefined' || typeof window.supabase.createClient === 'undefined') {
    console.warn('[ORBIT Supabase] Supabase client not loaded. Running in offline mode.');
    window.ORBIT_SUPABASE = {
      isAvailable: false,
      isSignedIn: false,
      user: null,
      syncStatus: 'offline'
    };
    return;
  }

  console.log('[ORBIT Supabase] CDN loaded');

  // Destructure createClient from window.supabase (Supabase v2 syntax)
  const { createClient } = window.supabase;

  // Initialize Supabase client
  const supabaseUrl = window.NEXT_PUBLIC_SUPABASE_URL || 'https://fmadcezhlwnmsxcyvtde.supabase.co';
  const supabaseAnonKey = window.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZtYWRjZXpobHdubXN4Y3l2dGRlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwNTAyNjgsImV4cCI6MjA5NTYyNjI2OH0.j9wkVD0Yx5pBob8XZb3LkslH9M3qyLNV8DySPI6hbJY';

  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('[ORBIT Supabase] Supabase credentials not configured. Running in offline mode.');
    window.ORBIT_SUPABASE = {
      isAvailable: false,
      isSignedIn: false,
      user: null,
      syncStatus: 'offline'
    };
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  // Expose client globally as window.supabaseClient for external access
  window.supabaseClient = supabase;

  console.log('[ORBIT Supabase] Client created');
  console.log('[ORBIT Supabase] Auth ready');

  // Global state
  window.ORBIT_SUPABASE = {
    isAvailable: true,
    isSignedIn: false,
    user: null,
    syncStatus: 'idle', // 'idle', 'syncing', 'synced', 'error'
    lastSyncTime: null
  };

  // ============================================================================
  // AUTHENTICATION
  // ============================================================================

  /**
   * Sign in with Google OAuth
   * @returns {Promise<{error: string|null}>}
   */
  async function signInWithGoogle() {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      });

      if (error) {
        console.error('[ORBIT Supabase] Google sign in error:', error);
        return { error: error.message };
      }

      console.log('[ORBIT Supabase] Redirecting to Google OAuth...');
      return { error: null };
    } catch (err) {
      console.error('[ORBIT Supabase] Google sign in exception:', err);
      return { error: 'Failed to initiate Google sign in' };
    }
  }

  /**
   * Sign out current user
   * @returns {Promise<void>}
   */
  async function signOut() {
    try {
      await supabase.auth.signOut();
      console.log('[ORBIT Supabase] Signed out');
    } catch (err) {
      console.error('[ORBIT Supabase] Sign out error:', err);
    }
  }

  /**
   * Get current session
   * @returns {Promise<Object|null>}
   */
  async function getSession() {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) {
        console.error('[ORBIT Supabase] Get session error:', error);
        return null;
      }
      return session;
    } catch (err) {
      console.error('[ORBIT Supabase] Get session exception:', err);
      return null;
    }
  }

  /**
   * Initialize auth state listener
   * @param {Function} onAuthChange - Callback when auth state changes
   */
  function initAuthListener(onAuthChange) {
    supabase.auth.onAuthStateChange((event, session) => {
      console.log('[ORBIT Supabase] Auth state changed:', event, session?.user?.email);

      if (event === 'SIGNED_IN' && session?.user) {
        window.ORBIT_SUPABASE.isSignedIn = true;
        window.ORBIT_SUPABASE.user = session.user;
      } else if (event === 'SIGNED_OUT') {
        window.ORBIT_SUPABASE.isSignedIn = false;
        window.ORBIT_SUPABASE.user = null;
        window.ORBIT_SUPABASE.syncStatus = 'idle';
      }

      if (onAuthChange) {
        onAuthChange(event, session);
      }
    });
  }

  // ============================================================================
  // CLOUD SYNC
  // ============================================================================

  /**
   * Fetch user data from Supabase
   * @returns {Promise<{data: Object|null, error: string|null, updated_at: string|null}>}
   */
  async function fetchCloudData() {
    if (!window.ORBIT_SUPABASE.isSignedIn || !window.ORBIT_SUPABASE.user) {
      return { data: null, error: 'Not signed in', updated_at: null };
    }

    try {
      const { data, error } = await supabase
        .from('orbit_user_data')
        .select('data, updated_at')
        .eq('user_id', window.ORBIT_SUPABASE.user.id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No data found for user
          return { data: null, error: null, updated_at: null };
        }
        console.error('[ORBIT Supabase] Fetch data error:', error);
        return { data: null, error: error.message, updated_at: null };
      }

      return { data: data?.data, error: null, updated_at: data?.updated_at };
    } catch (err) {
      console.error('[ORBIT Supabase] Fetch data exception:', err);
      return { data: null, error: 'Failed to fetch data', updated_at: null };
    }
  }

  /**
   * Upsert user data to Supabase
   * @param {Object} data - Full data blob to sync
   * @returns {Promise<{error: string|null}>}
   */
  async function upsertCloudData(data) {
    if (!window.ORBIT_SUPABASE.isSignedIn || !window.ORBIT_SUPABASE.user) {
      return { error: 'Not signed in' };
    }

    try {
      const { error } = await supabase
        .from('orbit_user_data')
        .upsert({
          user_id: window.ORBIT_SUPABASE.user.id,
          data: data,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        });

      if (error) {
        console.error('[ORBIT Supabase] Upsert data error:', error);
        window.ORBIT_SUPABASE.syncStatus = 'error';
        return { error: error.message };
      }

      window.ORBIT_SUPABASE.syncStatus = 'synced';
      window.ORBIT_SUPABASE.lastSyncTime = new Date().toISOString();
      console.log('[ORBIT Supabase] Data synced successfully');
      return { error: null };
    } catch (err) {
      console.error('[ORBIT Supabase] Upsert data exception:', err);
      window.ORBIT_SUPABASE.syncStatus = 'error';
      return { error: 'Failed to sync data' };
    }
  }

  // ============================================================================
  // EXPORTS
  // ============================================================================

  window.ORBIT_SUPABASE.signInWithGoogle = signInWithGoogle;
  window.ORBIT_SUPABASE.signOut = signOut;
  window.ORBIT_SUPABASE.getSession = getSession;
  window.ORBIT_SUPABASE.initAuthListener = initAuthListener;
  window.ORBIT_SUPABASE.fetchCloudData = fetchCloudData;
  window.ORBIT_SUPABASE.upsertCloudData = upsertCloudData;

  console.log('[ORBIT Supabase] Client initialized');
})();
