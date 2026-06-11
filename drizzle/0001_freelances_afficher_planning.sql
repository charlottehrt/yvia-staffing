ALTER TABLE "freelances"
  ADD COLUMN IF NOT EXISTS "afficher_planning" boolean DEFAULT true NOT NULL;
