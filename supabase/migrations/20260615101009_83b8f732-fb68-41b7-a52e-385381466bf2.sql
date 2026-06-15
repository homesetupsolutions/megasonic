ALTER TABLE public.external_connections
  ADD CONSTRAINT external_connections_owner_provider_key UNIQUE (owner_id, provider);