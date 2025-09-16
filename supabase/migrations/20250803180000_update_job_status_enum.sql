-- Add missing status values to job_status enum
ALTER TYPE job_status ADD VALUE 'completed';
ALTER TYPE job_status ADD VALUE 'skipped'; 