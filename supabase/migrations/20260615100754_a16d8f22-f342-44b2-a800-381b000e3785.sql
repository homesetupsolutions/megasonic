ALTER TABLE public.voice_calls
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS voice_calls_owner_started_idx ON public.voice_calls (owner_id, started_at DESC);