-- Lists become shared ("everyone") or private to their owner, enforced by the
-- owner_or_visibility row policy. Previously member_id IS NULL meant "shared",
-- but owner_only hid those rows from non-adults entirely. Carry that intent over
-- to the new visibility column so shared lists become readable by everyone.
ALTER TABLE app_tasks__lists ADD COLUMN visibility TEXT NOT NULL DEFAULT 'private';

UPDATE app_tasks__lists SET visibility = 'everyone' WHERE member_id IS NULL;
