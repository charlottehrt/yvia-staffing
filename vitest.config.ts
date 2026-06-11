import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Résout l'alias "@/..." (= ./src) dans les tests, comme tsconfig le fait pour l'app.
// Les tests existants n'utilisent que des imports relatifs : cet alias ne les affecte pas.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
