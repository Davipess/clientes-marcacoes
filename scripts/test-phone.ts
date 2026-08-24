import "dotenv/config";
import { phoneSchema } from "../lib/validation";
import { normalizePhone } from "../lib/crypto";

let pass = 0;
let fail = 0;
function expect(valid: boolean, phone: string) {
  const r = phoneSchema.safeParse(phone);
  if (r.success === valid) {
    pass++;
    console.log(`  OK   "${phone}" -> ${valid ? "aceite" : "rejeitado"}`);
  } else {
    fail++;
    console.error(
      `  FAIL "${phone}" -> esperado ${valid ? "ACEITE" : "REJEITADO"}, obtido ${r.success ? "ACEITE" : "REJEITADO"}`,
    );
  }
}

console.log("[Validos]");
expect(true, "912 345 678");
expect(true, "912345678");
expect(true, "+351 912 345 678");
expect(true, "+351912345678");
expect(true, "(+351) 912-345-678");
expect(true, "212345678"); // fixo PT
expect(true, "+44 20 7183 8750"); // Reino Unido
expect(true, "+1 415 555 2671"); // EUA
expect(true, "+33 1 42 68 53 00"); // Frana

console.log("[Invalidos]");
expect(false, "30304304043"); // 11 digitos sem + (o exemplo do utilizador)
expect(false, "12345"); // curto demais
expect(false, "912 345 67890123"); // longo demais
expect(false, "abcdefghij");
expect(false, "912-345-678 ext 5"); // "ext" no  digito
expect(false, ""); // vazio
expect(false, "812345678"); // 9 digitos mas comeca por 8 (nao PT valido)
expect(false, "912345"); // 6 digitos

console.log("\n[Normalizacao: variantes = mesma identidade]");
const variants = [
  "912 345 678",
  "912345678",
  "+351 912 345 678",
  "+351912345678",
  "(+351) 912-345-678",
  "0912 345 678",
  "00351912345678",
];
const hashes = new Set(variants.map((v) => normalizePhone(v)));
if (hashes.size === 1) {
  pass++;
  console.log(`  OK   ${variants.length} variantes -> 1 identidade (${[...hashes][0]})`);
} else {
  fail++;
  console.error(`  FAIL variantes produziram ${hashes.size} identidades: ${[...hashes]}`);
}

console.log(`\n=== ${pass} passaram, ${fail} falharam ===`);
process.exitCode = fail > 0 ? 1 : 0;
