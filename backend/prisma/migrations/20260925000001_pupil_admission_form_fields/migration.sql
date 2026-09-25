-- PRPS physical admission form fields that have no equivalent column yet:
--   - previousSchool : "SCHOOL ATTENDED"
--   - stayWithChild  : "STAY WITH THE CHILD" (living arrangement)
-- Both are nullable additions: no existing rows are touched.
ALTER TABLE "pupils" ADD COLUMN "previousSchool" TEXT;
ALTER TABLE "pupils" ADD COLUMN "stayWithChild" TEXT;
