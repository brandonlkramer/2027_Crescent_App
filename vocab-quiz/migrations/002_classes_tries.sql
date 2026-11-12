-- Update for databases created before 2026-11-12 (run once)
ALTER TABLE sessions ADD COLUMN classes TEXT;
ALTER TABLE responses ADD COLUMN tries INTEGER;
