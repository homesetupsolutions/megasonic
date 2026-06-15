CREATE TABLE IF NOT EXISTS public.call_scripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  greeting TEXT NOT NULL DEFAULT '',
  qualifying_questions TEXT NOT NULL DEFAULT '',
  objection_handlers TEXT NOT NULL DEFAULT '',
  closing TEXT NOT NULL DEFAULT '',
  full_script TEXT NOT NULL DEFAULT '',
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.call_scripts TO authenticated;
GRANT ALL ON public.call_scripts TO service_role;

ALTER TABLE public.call_scripts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their own call scripts"
  ON public.call_scripts FOR ALL
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE TRIGGER call_scripts_touch_updated_at
  BEFORE UPDATE ON public.call_scripts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX IF NOT EXISTS call_scripts_owner_org_idx ON public.call_scripts (owner_id, organization_id);

-- Seed two default scripts for every existing owner who has organizations
INSERT INTO public.call_scripts (owner_id, organization_id, title, is_default, greeting, qualifying_questions, objection_handlers, closing, full_script)
SELECT
  o.owner_id,
  o.id,
  CASE WHEN o.kind IN ('feelbass','sonicfeel') THEN 'FeelBass — Default inbound call'
       ELSE 'HSS — Default inbound call' END,
  true,
  CASE WHEN o.kind IN ('feelbass','sonicfeel')
       THEN 'Thanks for calling FeelBass — this is your AI assistant. How can I help you feel the bass today?'
       ELSE 'Thanks for calling Home Setup Solutions, this is your AI assistant. Are you calling to schedule a home setup, get a quote, or follow up on an existing job?' END,
  CASE WHEN o.kind IN ('feelbass','sonicfeel')
       THEN '1) Are you calling about an event, a rental, or a service?
2) What''s the date and approximate start time?
3) What''s the venue or address?
4) Roughly how many people are you expecting?
5) Best phone number and name to put this under?'
       ELSE '1) What service do you need — TV mount, smart-home install, full setup, repair?
2) What''s the address?
3) What''s the soonest day that works for you — morning or afternoon?
4) Best name and phone number to confirm with?
5) Any photos you can text after we hang up?' END,
  '• "It''s too expensive" → Totally hear you. We can break it into two visits or start with the priority items. Want me to pencil in a free 15-minute consult instead?
• "I need to think about it" → No problem. I''ll hold a tentative slot for 24 hours so you don''t lose it — what''s the best time to follow up?
• "I''ll call back" → I can lock in your slot in 30 seconds right now and you can cancel free up to 24 hours before. Want me to do that?',
  'Great — I''m booking you in. I''ll send a text confirmation to the number you gave me. The owner reviews every booking and you''ll get a final confirmation within the hour. Anything else before I let you go?',
  ''
FROM public.organizations o
ON CONFLICT DO NOTHING;