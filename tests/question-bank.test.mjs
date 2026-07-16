import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readJson = async (name) =>
  JSON.parse(await readFile(new URL(`../app/data/${name}`, import.meta.url), "utf8"));

test("complete question banks are structurally valid", async () => {
  const [objective, subjective, geography] = await Promise.all([
    readJson("objective-bank.json"),
    readJson("subjective-bank.json"),
    readJson("geography-bank.json"),
  ]);

  assert.equal(objective.length, 462);
  assert.equal(subjective.length, 220);
  assert.ok(geography.length >= 500);

  const all = [...objective, ...subjective, ...geography];
  assert.equal(new Set(all.map((question) => question.id)).size, all.length);

  for (const question of objective) {
    assert.equal(question.type, "mcq");
    assert.equal(question.options.length, 4);
    assert.match(question.answer, /^[ABCD]$/);
    assert.ok(question.stem.length >= 6);
  }

  for (const question of subjective) {
    assert.ok(["trueFalse", "short", "material"].includes(question.type));
    assert.ok(question.answer.length >= 8);
    assert.ok(question.scoringPoints.length >= 3);
    assert.equal(question.scoringPoints.length, question.keywords.length);
  }

  for (const question of geography) {
    assert.equal(question.subject, "geography");
    assert.ok(question.answer.length >= 4);
    assert.ok(question.sourcePage >= 1);
  }
});
