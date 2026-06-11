ALTER TABLE "projets"
  ADD COLUMN IF NOT EXISTS "statut_commercial" text;
--> statement-breakpoint
UPDATE "projets"
SET "statut_commercial" = 'gagne'
WHERE "statut_commercial" IS NULL;
--> statement-breakpoint
ALTER TABLE "projets"
  ALTER COLUMN "statut_commercial" SET DEFAULT 'a_qualifier';
--> statement-breakpoint
ALTER TABLE "projets"
  ALTER COLUMN "statut_commercial" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "projets"
  ADD COLUMN IF NOT EXISTS "montant_envisage" numeric(12, 2);
