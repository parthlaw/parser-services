-- Create status enum type for jobs
CREATE TYPE job_status AS ENUM ('pending', 'processing', 'success', 'failed');

CREATE TABLE IF NOT EXISTS jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_pdf_url TEXT NOT NULL,
  status job_status NOT NULL DEFAULT 'pending',
  result_s3_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
