-- Add metadata column to jobs table for storing additional dynamic fields
ALTER TABLE jobs ADD COLUMN metadata JSONB DEFAULT '{}';

-- Add an index on metadata for better query performance
CREATE INDEX IF NOT EXISTS idx_jobs_metadata_gin ON jobs USING GIN (metadata);

-- Add a comment to explain the column purpose
COMMENT ON COLUMN jobs.metadata IS 'JSONB field for storing additional dynamic job metadata like progress, error details, processing info, etc.'; 