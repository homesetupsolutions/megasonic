
-- ORGANIZATIONS
CREATE TABLE public.organizations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('sonicfeel','homesetup','other')),
  square_location_id TEXT,
  square_enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (owner_id, slug)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations TO authenticated;
GRANT ALL ON public.organizations TO service_role;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own orgs" ON public.organizations FOR ALL
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE TRIGGER trg_orgs_updated BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- SERVICES (master catalog)
CREATE TABLE public.services (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'CAD',
  duration_minutes INTEGER,
  sku TEXT,
  square_catalog_id TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_services_org ON public.services(organization_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.services TO authenticated;
GRANT ALL ON public.services TO service_role;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own services" ON public.services FOR ALL
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE TRIGGER trg_services_updated BEFORE UPDATE ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- PRICE CHANGE REQUESTS (approval queue)
CREATE TABLE public.price_change_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
  change_type TEXT NOT NULL CHECK (change_type IN ('create','update','delete','price_only')),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','applied','failed')),
  requested_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  applied_at TIMESTAMPTZ,
  square_synced BOOLEAN NOT NULL DEFAULT false,
  propagation_log JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_pcr_org_status ON public.price_change_requests(organization_id, status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.price_change_requests TO authenticated;
GRANT ALL ON public.price_change_requests TO service_role;
ALTER TABLE public.price_change_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own pcr" ON public.price_change_requests FOR ALL
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE TRIGGER trg_pcr_updated BEFORE UPDATE ON public.price_change_requests
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- BOOKINGS
CREATE TABLE public.bookings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  customer_email TEXT,
  customer_phone TEXT,
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','completed','cancelled','no_show')),
  notes TEXT,
  source TEXT NOT NULL DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_bookings_org_time ON public.bookings(organization_id, scheduled_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bookings TO authenticated;
GRANT ALL ON public.bookings TO service_role;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own bookings" ON public.bookings FOR ALL
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE TRIGGER trg_bookings_updated BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- SQUARE SYNC LOG
CREATE TABLE public.square_sync_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  status TEXT NOT NULL,
  response JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_sqlog_org ON public.square_sync_log(organization_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.square_sync_log TO authenticated;
GRANT ALL ON public.square_sync_log TO service_role;
ALTER TABLE public.square_sync_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own sqlog" ON public.square_sync_log FOR ALL
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

-- Add org_id to linked_projects
ALTER TABLE public.linked_projects
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;

-- Auto-seed two orgs when a new profile is created
CREATE OR REPLACE FUNCTION public.seed_default_orgs()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.organizations (owner_id, name, slug, kind)
  VALUES
    (NEW.id, 'SonicFeel Inc', 'sonicfeel', 'sonicfeel'),
    (NEW.id, 'Home Setup Solutions', 'homesetup', 'homesetup')
  ON CONFLICT (owner_id, slug) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_orgs ON public.profiles;
CREATE TRIGGER trg_seed_orgs
AFTER INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.seed_default_orgs();

-- Backfill orgs for existing profiles
INSERT INTO public.organizations (owner_id, name, slug, kind)
SELECT p.id, 'SonicFeel Inc', 'sonicfeel', 'sonicfeel' FROM public.profiles p
ON CONFLICT (owner_id, slug) DO NOTHING;

INSERT INTO public.organizations (owner_id, name, slug, kind)
SELECT p.id, 'Home Setup Solutions', 'homesetup', 'homesetup' FROM public.profiles p
ON CONFLICT (owner_id, slug) DO NOTHING;
