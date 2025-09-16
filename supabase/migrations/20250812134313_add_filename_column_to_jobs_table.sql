-- Add filename column to jobs table for easier querying and filtering
ALTER TABLE jobs ADD COLUMN filename TEXT;

-- Create index on filename for better query performance
CREATE INDEX IF NOT EXISTS idx_jobs_filename ON jobs(filename);

-- Create composite index for user_id + filename for better filtering
CREATE INDEX IF NOT EXISTS idx_jobs_user_filename ON jobs(user_id, filename);

-- Add a comment to explain the column purpose
COMMENT ON COLUMN jobs.filename IS 'Original filename of the uploaded bank statement for easy filtering and display';
