-- Drop indexes first
DROP INDEX IF EXISTS idx_job_steps_job_id;
DROP INDEX IF EXISTS idx_job_steps_status;
DROP INDEX IF EXISTS idx_job_steps_order;

-- Drop the job_steps table
DROP TABLE IF EXISTS job_steps;
