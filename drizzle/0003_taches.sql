CREATE TABLE "commentaires_tache" (
	"id" serial PRIMARY KEY NOT NULL,
	"tache_id" integer NOT NULL,
	"contenu" text NOT NULL,
	"cree_le" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "taches" (
	"id" serial PRIMARY KEY NOT NULL,
	"nom" text NOT NULL,
	"termine" boolean DEFAULT false NOT NULL,
	"cree_le" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "commentaires_tache" ADD CONSTRAINT "commentaires_tache_tache_id_taches_id_fk" FOREIGN KEY ("tache_id") REFERENCES "public"."taches"("id") ON DELETE cascade ON UPDATE no action;