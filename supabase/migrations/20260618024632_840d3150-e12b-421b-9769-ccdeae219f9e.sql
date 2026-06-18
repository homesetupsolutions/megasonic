
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS square_customer_id text,
  ADD COLUMN IF NOT EXISTS square_card_id text,
  ADD COLUMN IF NOT EXISTS card_brand text,
  ADD COLUMN IF NOT EXISTS card_last4 text,
  ADD COLUMN IF NOT EXISTS cancellation_policy text DEFAULT '24 hour notice required, otherwise a $45 cancellation fee will be charged to the card on file.',
  ADD COLUMN IF NOT EXISTS cancellation_fee_cents integer DEFAULT 4500,
  ADD COLUMN IF NOT EXISTS cancellation_fee_charged_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancellation_payment_id text;
