ALTER TABLE public.call_scripts
  ADD COLUMN IF NOT EXISTS direction TEXT NOT NULL DEFAULT 'inbound'
    CHECK (direction IN ('inbound','outbound'));

CREATE INDEX IF NOT EXISTS call_scripts_owner_org_direction_idx
  ON public.call_scripts (owner_id, organization_id, direction);

-- Seed outbound scripts for every existing org
INSERT INTO public.call_scripts (
  owner_id, organization_id, title, direction, is_default,
  greeting, qualifying_questions, objection_handlers, closing, full_script
)
SELECT
  o.owner_id,
  o.id,
  CASE WHEN o.kind IN ('feelbass','sonicfeel')
       THEN 'FeelBass — Default outbound (cold call)'
       ELSE 'HSS — Default outbound (cold call)' END,
  'outbound',
  true,
  CASE WHEN o.kind IN ('feelbass','sonicfeel')
       THEN 'Hi — this is [your name] from FeelBass. We do high-impact sound and bass-driven events. Got 30 seconds?'
       ELSE 'Hi — this is [your name] from Home Setup Solutions. We handle TV mounts, smart-home, and full home setups so you don''t have to. Got 30 seconds?' END,
  CASE WHEN o.kind IN ('feelbass','sonicfeel')
       THEN '1) Do you book live music, DJs, or events at your venue?
2) Roughly how often — weekly, monthly, one-offs?
3) Who currently handles your sound and bass setup?
4) What would make you switch — price, sound quality, reliability?
5) Best person and email for a 20-second proposal?'
       ELSE '1) Did you recently move, renovate, or buy new electronics?
2) Are you handling installs yourself or hiring someone?
3) What''s the #1 thing you''ve been putting off (TV, sound bar, smart home, network)?
4) When would you ideally want it done — this week, this month?
5) Best name, address, and number to send a quote to?' END,
  '• "Not interested" → Totally fair. Mind if I ask what you''re using today so I know whether to circle back later?
• "Send me an email" → Happy to. I''ll keep it to 4 lines — what''s the best address? And can I follow up Friday at 10?
• "Too expensive" → I haven''t quoted yet — let me show two price points (budget and pro) and you pick. Worth 5 minutes?
• "Call back later" → Sure — what''s a better time today or tomorrow? I''ll text you 5 min before so you''re ready.',
  'Awesome. I''m going to text/email you a quick link to lock a 15-minute slot. Confirm the best number? Talk soon.',
  ''
FROM public.organizations o
ON CONFLICT DO NOTHING;