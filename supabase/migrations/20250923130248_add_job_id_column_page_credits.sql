-- Step 1: Add the column (just the type)
ALTER TABLE page_credits
ADD COLUMN job_id UUID;

-- Step 2: Add the foreign key constraint
ALTER TABLE page_credits
ADD CONSTRAINT fk_page_credits_job
FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE;
