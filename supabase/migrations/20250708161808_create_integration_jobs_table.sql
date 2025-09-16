CREATE TYPE sync_direction AS ENUM ('push', 'pull');
CREATE TABLE IF NOT EXISTS public.integration_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  integration_id UUID NOT NULL REFERENCES public.integrations(id) ON DELETE CASCADE,
  status job_status NOT NULL DEFAULT 'pending',
  sync_direction sync_direction NOT NULL,
  logs JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
