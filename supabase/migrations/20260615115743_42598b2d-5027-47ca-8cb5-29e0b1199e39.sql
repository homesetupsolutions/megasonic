-- Phone devices (Yealink etc.) for provisioning
CREATE TABLE public.phone_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mac_address TEXT NOT NULL UNIQUE,
  label TEXT,
  model TEXT,
  sip_username TEXT,
  sip_password TEXT,
  sip_server TEXT,
  sip_port INTEGER DEFAULT 5060,
  ringtone_url TEXT,
  extra_config JSONB DEFAULT '{}'::jsonb,
  provision_token TEXT NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  last_provisioned_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.phone_devices TO authenticated;
GRANT ALL ON public.phone_devices TO service_role;
ALTER TABLE public.phone_devices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own phone devices" ON public.phone_devices FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE TRIGGER phone_devices_touch BEFORE UPDATE ON public.phone_devices FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Call detail records from desk phones
CREATE TABLE public.phone_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id UUID REFERENCES public.phone_devices(id) ON DELETE SET NULL,
  mac_address TEXT,
  direction TEXT NOT NULL CHECK (direction IN ('inbound','outbound')),
  event TEXT NOT NULL,
  caller_number TEXT,
  caller_name TEXT,
  callee_number TEXT,
  duration_seconds INTEGER DEFAULT 0,
  answered BOOLEAN DEFAULT false,
  missed BOOLEAN DEFAULT false,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  raw JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.phone_calls TO authenticated;
GRANT ALL ON public.phone_calls TO service_role;
ALTER TABLE public.phone_calls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own phone calls" ON public.phone_calls FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE INDEX phone_calls_owner_started_idx ON public.phone_calls(owner_id, started_at DESC);