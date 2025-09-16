-- Create job_steps table for tracking pipeline step execution
CREATE TABLE IF NOT EXISTS job_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  step_name TEXT NOT NULL,
  step_order INTEGER NOT NULL,
  status job_status NOT NULL DEFAULT 'pending',
  s3_output_path TEXT,
  execution_time_ms INTEGER,
  error_details JSONB,
  step_config JSONB, -- Store the step configuration
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Add unique constraint to prevent duplicate steps per job
  UNIQUE(job_id, step_name)
);

-- Add index for faster queries
CREATE INDEX idx_job_steps_job_id ON job_steps(job_id);
CREATE INDEX idx_job_steps_status ON job_steps(status);
CREATE INDEX idx_job_steps_order ON job_steps(job_id, step_order); 