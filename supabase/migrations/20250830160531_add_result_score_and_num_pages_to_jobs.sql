-- Add result_score and num_pages columns to jobs table
-- result_score: A numeric score indicating the quality/confidence of the parsing result (0.0 to 1.0)
-- num_pages: The total number of pages in the processed document

ALTER TABLE jobs ADD COLUMN result_score DECIMAL(3,2) CHECK (result_score >= 0.0 AND result_score <= 1.0);
ALTER TABLE jobs ADD COLUMN num_pages INTEGER CHECK (num_pages > 0);

-- Create index on result_score for filtering by quality
CREATE INDEX IF NOT EXISTS idx_jobs_result_score ON jobs(result_score);

-- Create composite index for user_id + result_score for user-specific quality filtering
CREATE INDEX IF NOT EXISTS idx_jobs_user_result_score ON jobs(user_id, result_score);

-- Add comments to explain the column purposes
COMMENT ON COLUMN jobs.result_score IS 'Quality score of the parsing result, ranging from 0.0 (poor) to 1.0 (excellent)';
COMMENT ON COLUMN jobs.num_pages IS 'Total number of pages in the processed bank statement document';
