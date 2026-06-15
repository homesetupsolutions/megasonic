
-- Allow new kind values
ALTER TABLE public.organizations DROP CONSTRAINT IF EXISTS organizations_kind_check;
ALTER TABLE public.organizations ADD CONSTRAINT organizations_kind_check
  CHECK (kind IN ('sonicfeel','homesetup','feelbass','hss','other'));

UPDATE public.organizations SET kind = 'feelbass', name = 'FeelBass', slug = 'feelbass' WHERE slug = 'sonicfeel';
UPDATE public.organizations SET kind = 'hss', name = 'HSS - Home Setup Solutions', slug = 'hss' WHERE slug = 'homesetup';

CREATE OR REPLACE FUNCTION public.seed_default_orgs()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
BEGIN
  INSERT INTO public.organizations (owner_id, name, slug, kind)
  VALUES
    (NEW.id, 'FeelBass', 'feelbass', 'feelbass'),
    (NEW.id, 'HSS - Home Setup Solutions', 'hss', 'hss')
  ON CONFLICT (owner_id, slug) DO NOTHING;
  RETURN NEW;
END;
$function$;

CREATE TABLE public.square_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  square_location_id text NOT NULL,
  name text NOT NULL,
  address text, status text, currency text, raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(owner_id, square_location_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.square_locations TO authenticated;
GRANT ALL ON public.square_locations TO service_role;
ALTER TABLE public.square_locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manages own square locations" ON public.square_locations
  FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE TRIGGER trg_square_locations_updated BEFORE UPDATE ON public.square_locations
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.external_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  provider text NOT NULL,
  label text,
  status text NOT NULL DEFAULT 'pending',
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  secrets_ref text,
  last_synced_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.external_connections TO authenticated;
GRANT ALL ON public.external_connections TO service_role;
ALTER TABLE public.external_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manages own connections" ON public.external_connections
  FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE TRIGGER trg_external_connections_updated BEFORE UPDATE ON public.external_connections
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(owner_id, endpoint)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manages own push subs" ON public.push_subscriptions
  FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

CREATE TABLE public.voice_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  from_number text, to_number text,
  direction text NOT NULL DEFAULT 'inbound',
  status text NOT NULL DEFAULT 'received',
  transcript text, ai_summary text, ai_intent text,
  proposed_booking jsonb,
  duration_seconds int, recording_url text, raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.voice_calls TO authenticated;
GRANT ALL ON public.voice_calls TO service_role;
ALTER TABLE public.voice_calls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manages own voice calls" ON public.voice_calls
  FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE TRIGGER trg_voice_calls_updated BEFORE UPDATE ON public.voice_calls
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.services ADD COLUMN IF NOT EXISTS imported_from_square boolean NOT NULL DEFAULT false;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS square_location_id text;
