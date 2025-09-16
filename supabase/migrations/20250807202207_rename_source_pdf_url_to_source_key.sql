-- Rename source_pdf_url column to source_key in jobs table
ALTER TABLE jobs RENAME COLUMN source_pdf_url TO source_key;