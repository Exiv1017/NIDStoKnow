-- Normalize legacy module_name values (Title Case with spaces) into slug form (lowercase-hyphen)
-- Safe, idempotent approach:
-- 1. For each distinct legacy name containing a space, compute slug.
-- 2. If slug row does NOT exist: UPDATE in place.
-- 3. If slug row exists: merge metrics into slug row (take maxima / additive where sensible), then delete legacy row.
-- 4. Update referencing tables student_lesson_progress, student_module_quiz, student_module_unit_events
--
-- Run inside a transaction. If anything fails, ROLLBACK.
-- NOTE: Adjust table list if other tables reference module_name.

START TRANSACTION;

-- Helper: create a temporary table mapping legacy names to slug form.
DROP TEMPORARY TABLE IF EXISTS tmp_legacy_modules;
CREATE TEMPORARY TABLE tmp_legacy_modules AS
SELECT DISTINCT module_name AS legacy_name,
       LOWER(REPLACE(module_name,' ', '-')) AS slug
FROM student_progress
WHERE module_name LIKE '% %';

-- Step 1: Process each mapping.
-- We'll cursor via SELECT; MySQL does not easily support procedural logic here in a plain script,
-- so we rely on set-based operations.

-- Case A: Legacy rows whose slug does not yet exist: update directly.
UPDATE student_progress sp
JOIN tmp_legacy_modules t ON sp.module_name = t.legacy_name
LEFT JOIN student_progress slugsp ON slugsp.student_id = sp.student_id AND slugsp.module_name = t.slug
SET sp.module_name = t.slug
WHERE slugsp.id IS NULL; -- only when slug row absent

-- Case B: Legacy rows whose slug version already exists: merge metrics then delete legacy row.
-- Merge by taking maximum of unit flags and counts (lessons/quizzes), and summing time_spent.
UPDATE student_progress slugsp
JOIN tmp_legacy_modules t ON slugsp.module_name = t.slug
JOIN student_progress legacy ON legacy.module_name = t.legacy_name AND legacy.student_id = slugsp.student_id
SET slugsp.lessons_completed = GREATEST(slugsp.lessons_completed, legacy.lessons_completed),
    slugsp.total_lessons    = GREATEST(slugsp.total_lessons, legacy.total_lessons),
    slugsp.overview_completed = GREATEST(slugsp.overview_completed, legacy.overview_completed),
    slugsp.practical_completed = GREATEST(slugsp.practical_completed, legacy.practical_completed),
    slugsp.assessment_completed = GREATEST(slugsp.assessment_completed, legacy.assessment_completed),
    slugsp.quizzes_passed    = GREATEST(slugsp.quizzes_passed, legacy.quizzes_passed),
    slugsp.total_quizzes     = GREATEST(slugsp.total_quizzes, legacy.total_quizzes),
    slugsp.time_spent        = slugsp.time_spent + legacy.time_spent;

-- Update referencing tables BEFORE deleting legacy rows so we don't orphan progress references.
-- student_lesson_progress
UPDATE student_lesson_progress lp
JOIN tmp_legacy_modules t ON lp.module_name = t.legacy_name
SET lp.module_name = t.slug;

-- student_module_quiz
UPDATE student_module_quiz q
JOIN tmp_legacy_modules t ON q.module_name = t.legacy_name
SET q.module_name = t.slug;

-- student_module_unit_events
UPDATE student_module_unit_events e
JOIN tmp_legacy_modules t ON e.module_name = t.legacy_name
SET e.module_name = t.slug;

-- Delete legacy duplicates (only those whose slug counterpart now exists).
DELETE legacy FROM student_progress legacy
JOIN tmp_legacy_modules t ON legacy.module_name = t.legacy_name
JOIN student_progress slugsp ON slugsp.student_id = legacy.student_id AND slugsp.module_name = t.slug;

COMMIT;

-- Verification query suggestion:
-- SELECT student_id, module_name, lessons_completed, overview_completed, practical_completed, assessment_completed, quizzes_passed FROM student_progress ORDER BY student_id, module_name;
