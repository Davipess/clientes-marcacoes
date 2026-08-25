import { readFileSync, writeFileSync, unlinkSync } from "node:fs";

const urlLine = readFileSync("db-user-url.txt", "utf8").trim(); // DATABASE_URL="..."
let env = readFileSync(".env", "utf8");
// Remove qualquer linha DATABASE_URL existente (pode conter nulls de runs anteriores).
env = env
  .split("\n")
  .filter((line) => !line.trimStart().startsWith("DATABASE_URL="))
  .join("\n");
// Insere a nova no topo.
env = urlLine + "\n" + env;
writeFileSync(".env", env, "utf8");
unlinkSync("db-user-url.txt");
console.log(".env atualizado (DATABASE_URL = app_user)");
