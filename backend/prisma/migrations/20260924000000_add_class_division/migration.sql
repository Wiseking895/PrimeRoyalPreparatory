-- Optional class division support (streams A, B, C, D).
-- Adds a nullable column only: existing class rows are untouched and keep
-- division = NULL (an undivided class). No data rewrite, no reset.
ALTER TABLE "classes" ADD COLUMN "division" TEXT;
