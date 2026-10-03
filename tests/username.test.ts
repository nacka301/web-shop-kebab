import assert from "node:assert/strict";
import { test } from "node:test";
import { loginIdentifierToEmail, normalizeUsername } from "../src/lib/auth/username";

test("korisničko ime postaje adresa koja ne prima poštu", () => {
  assert.equal(loginIdentifierToEmail("Ankica"), "ankica@prijava.local");
  assert.equal(loginIdentifierToEmail("  ankica  "), "ankica@prijava.local");
});

test("pravi e-mail ostaje nepromijenjen", () => {
  assert.equal(loginIdentifierToEmail("vlasnik@primjer.hr"), "vlasnik@primjer.hr");
});

test("neispravna imena se odbijaju", () => {
  assert.equal(normalizeUsername("ab"), null);
  assert.equal(normalizeUsername("ime s razmakom"), null);
  assert.equal(normalizeUsername("smash.vinkovci"), "smash.vinkovci");
});
