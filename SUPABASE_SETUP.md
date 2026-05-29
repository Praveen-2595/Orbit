# Supabase Setup for ORBIT

This document describes the Supabase configuration required for ORBIT's authentication and cloud sync features.

## Environment Variables

Add the following environment variables to your `.env.local` file:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

These will be automatically loaded by the application at runtime.

## Database Schema

### Table: `orbit_user_data`

Stores user data for cloud synchronization.

```sql
CREATE TABLE orbit_user_data (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security
ALTER TABLE orbit_user_data ENABLE ROW LEVEL SECURITY;

-- Create policy to allow users to read their own data
CREATE POLICY "Users can read own data"
  ON orbit_user_data FOR SELECT
  USING (auth.uid() = user_id);

-- Create policy to allow users to insert their own data
CREATE POLICY "Users can insert own data"
  ON orbit_user_data FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create policy to allow users to update their own data
CREATE POLICY "Users can update own data"
  ON orbit_user_data FOR UPDATE
  USING (auth.uid() = user_id);

-- Create index on updated_at for efficient querying
CREATE INDEX idx_orbit_user_data_updated_at ON orbit_user_data(updated_at DESC);
```

### Data Structure

The `data` column contains a JSONB object with all ORBIT localStorage keys:

```json
{
  "orbit_checklist": [...],
  "orbit_daily_checklist": [...],
  "orbit_today_checklist": [...],
  "orbit_daily_reset_date": "...",
  "orbit_goals": [...],
  "orbit_visions": [...],
  "orbit_sessions": [...],
  "orbit_memory": {...},
  "orbit_chat": [...],
  "orbit_chat_open": "true",
  "orbit_stakes": {...},
  "orbit_doom_recommendations": {...},
  "orbit_weekly_template": {...},
  "orbit_today_override": {...},
  "orbit_quick_tasks": [...],
  "orbit_timetable_blocks": [...],
  "orbit_letters": {...},
  "orbit_weekly_reports": [...],
  "orbit_last_report_date": "...",
  "orbit_onboarding_complete": "true",
  "orbit_free_usage": {...},
  "orbit_streak": {...},
  "orbit_daily_activity": {...},
  "orbit_session_points_ui": "0",
  "orbit_habit_points_ui": "0"
}
```

## Authentication Configuration

### Email Auth

ORBIT uses magic link authentication (email-only, no passwords). This is configured in Supabase Auth settings:

1. Go to your Supabase project dashboard
2. Navigate to Authentication > Providers
3. Enable Email provider
4. Disable Email confirmation (optional, for faster sign-in)
5. Set email template redirect URL to your application URL

### Site URL

Set your site URL in Supabase Authentication > URL Configuration to match your deployment:
- Local development: `http://localhost:3000`
- Production: `https://your-domain.com`

## How It Works

### Authentication Flow

1. User clicks "Sign in" in sidebar
2. User enters email address
3. Supabase sends magic link to email
4. User clicks magic link
5. User is signed in and redirected back to app
6. Auth state persists via Supabase session

### Cloud Sync Flow

1. On sign in, app fetches cloud data from `orbit_user_data` table
2. If cloud data exists and local data exists, user is asked to choose:
   - "Use Cloud Data" - replaces local data with cloud data
   - "Keep Local Data" - keeps local data and syncs to cloud
3. If only local data exists, it's synced to cloud
4. If only cloud data exists, it's loaded to local storage
5. Every localStorage write (debounced 5s) triggers sync to cloud if signed in

### Offline Mode

If Supabase is not configured or user is not signed in:
- All features work exactly as before (localStorage only)
- "Sign in" link appears but shows error if clicked without configuration
- No cloud sync occurs
- App functions normally in offline mode

## Security Notes

- Row Level Security (RLS) ensures users can only access their own data
- Anon key is used for client-side operations
- Server-side operations should use service role key (not implemented yet)
- Data is stored as JSONB in a single row per user
- Updated timestamp allows for conflict resolution

## Troubleshooting

### Auth not working
- Check that `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set
- Verify email provider is enabled in Supabase
- Check site URL configuration in Supabase Auth settings
- Check browser console for errors

### Sync not working
- Verify user is signed in (check sidebar for email display)
- Check that `orbit_user_data` table exists and RLS policies are correct
- Check browser console for sync errors
- Verify network connectivity

### Offline mode not working
- The app should work without Supabase configuration
- If it doesn't, check browser console for errors
- Ensure `window.ORBIT_SUPABASE.isAvailable` is false when not configured
