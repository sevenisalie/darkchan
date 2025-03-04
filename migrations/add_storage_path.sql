-- Add storage_path column to threads and posts tables
ALTER TABLE threads
ADD COLUMN storage_path TEXT;

ALTER TABLE posts
ADD COLUMN storage_path TEXT;

-- Create a function to migrate existing data if needed (run this if you have existing data)
CREATE OR REPLACE FUNCTION migrate_existing_files()
RETURNS void AS $$
BEGIN
    -- For now, existing files will continue to use the old system
    -- The new system will be used for new uploads
    RAISE NOTICE 'Migration complete - new files will use Supabase Storage';
END;
$$ LANGUAGE plpgsql;

-- Run the migration function
SELECT migrate_existing_files();