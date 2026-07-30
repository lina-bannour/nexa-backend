-- Filières: MP, PC, TSI, BIO, TECHNO  ->  MP, PT, PC, BG
-- Mapping applied to existing data before the type swap:
--   TSI    -> PT
--   TECHNO -> PT
--   BIO    -> BG
--   MP, PC -> unchanged

-- 1) Rename the old enum out of the way.
ALTER TYPE "Filiere" RENAME TO "Filiere_old";

-- 2) Create the new enum with the target values.
CREATE TYPE "Filiere" AS ENUM ('MP', 'PT', 'PC', 'BG');

-- 3) Migrate "users"."filiere" (nullable).
ALTER TABLE "users"
  ALTER COLUMN "filiere" TYPE "Filiere" USING (
    CASE "filiere"::text
      WHEN 'TSI' THEN 'PT'
      WHEN 'TECHNO' THEN 'PT'
      WHEN 'BIO' THEN 'BG'
      ELSE "filiere"::text
    END
  )::"Filiere";

-- 4) Migrate "contests"."filiere" (required).
ALTER TABLE "contests"
  ALTER COLUMN "filiere" TYPE "Filiere" USING (
    CASE "filiere"::text
      WHEN 'TSI' THEN 'PT'
      WHEN 'TECHNO' THEN 'PT'
      WHEN 'BIO' THEN 'BG'
      ELSE "filiere"::text
    END
  )::"Filiere";

-- 5) Drop the old enum.
DROP TYPE "Filiere_old";
