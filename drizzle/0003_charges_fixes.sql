CREATE TABLE "charges_fixes" (
	"id" serial PRIMARY KEY NOT NULL,
	"libelle" text NOT NULL,
	"montant_mensuel" numeric(12, 2) NOT NULL,
	"date_debut" date NOT NULL,
	"date_fin" date,
	"actif" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "charges_fixes_valeurs" (
	"id" serial PRIMARY KEY NOT NULL,
	"charge_fixe_id" integer NOT NULL,
	"mois" text NOT NULL,
	"montant" numeric(12, 2) NOT NULL,
	CONSTRAINT "une_valeur_par_charge_et_mois" UNIQUE("charge_fixe_id","mois")
);
--> statement-breakpoint
ALTER TABLE "charges_fixes_valeurs" ADD CONSTRAINT "charges_fixes_valeurs_charge_fixe_id_charges_fixes_id_fk" FOREIGN KEY ("charge_fixe_id") REFERENCES "public"."charges_fixes"("id") ON DELETE cascade ON UPDATE no action;