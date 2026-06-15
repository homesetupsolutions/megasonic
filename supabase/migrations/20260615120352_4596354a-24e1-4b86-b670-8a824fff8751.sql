ALTER TABLE public.ai_settings
  ADD COLUMN IF NOT EXISTS reminder_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS reminder_hour integer NOT NULL DEFAULT 9,
  ADD COLUMN IF NOT EXISTS reminder_minute integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reminder_method text NOT NULL DEFAULT 'queue_call',
  ADD COLUMN IF NOT EXISTS reminder_lead_hours integer NOT NULL DEFAULT 24,
  ADD COLUMN IF NOT EXISTS last_reminders_date date;