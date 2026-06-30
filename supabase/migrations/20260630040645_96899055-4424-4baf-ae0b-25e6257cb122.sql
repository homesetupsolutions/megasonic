
-- 1) Approval requests expire after 7 days, hard-cap to 50 pending at a time.
ALTER TABLE public.price_change_requests
  ADD COLUMN IF NOT EXISTS expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days');

CREATE INDEX IF NOT EXISTS idx_pcr_expires ON public.price_change_requests(expires_at) WHERE status = 'pending';

CREATE OR REPLACE FUNCTION public.expire_old_price_requests()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.price_change_requests
     SET status = 'rejected', reason = COALESCE(reason,'') || ' [auto-expired]'
   WHERE status = 'pending' AND expires_at < now();
$$;

CREATE OR REPLACE FUNCTION public.enforce_pending_cap()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE n int;
BEGIN
  IF NEW.status = 'pending' THEN
    PERFORM public.expire_old_price_requests();
    SELECT count(*) INTO n FROM public.price_change_requests
     WHERE owner_id = NEW.owner_id AND status = 'pending';
    IF n >= 50 THEN
      RAISE EXCEPTION 'Pending approval cap reached (50). Approve or reject some first.';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_pcr_cap ON public.price_change_requests;
CREATE TRIGGER trg_pcr_cap BEFORE INSERT ON public.price_change_requests
FOR EACH ROW EXECUTE FUNCTION public.enforce_pending_cap();

-- 2) IVR / voice settings on ai_settings
ALTER TABLE public.ai_settings
  ADD COLUMN IF NOT EXISTS ivr_voice text NOT NULL DEFAULT 'alloy',
  ADD COLUMN IF NOT EXISTS ivr_greeting text NOT NULL DEFAULT 'Thanks for calling SonicFeel. Press 1 for HSS, 2 for FeelBass, 9 for ET our AI assistant.',
  ADD COLUMN IF NOT EXISTS auto_approve_under_cents integer NOT NULL DEFAULT 0;

-- 3) SIP trunk config per CallCentric DID
CREATE TABLE IF NOT EXISTS public.sip_trunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  did text NOT NULL,
  label text,
  provider text NOT NULL DEFAULT 'callcentric',
  sip_username text,
  sip_password text,
  sip_server text NOT NULL DEFAULT 'sip.callcentric.com',
  sip_port integer NOT NULL DEFAULT 5060,
  inbound_route text NOT NULL DEFAULT 'ivr',   -- ivr | et | extension | voicemail
  inbound_extension text,
  voice text NOT NULL DEFAULT 'alloy',
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, did)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sip_trunks TO authenticated;
GRANT ALL ON public.sip_trunks TO service_role;
ALTER TABLE public.sip_trunks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own sip trunks" ON public.sip_trunks
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE TRIGGER trg_sip_trunks_updated BEFORE UPDATE ON public.sip_trunks
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
