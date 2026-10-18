import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  legacyMap,
  readingHref,
  readingThemeIds,
  resolveReadingHash,
} from "../src/lib/reading-navigation.mjs";

const expectedThemes = [
  "pesquisa",
  "gerar",
  "comparar",
  "validar",
  "especificar",
  "evoluir",
  "perspectivas",
];
const sources = JSON.parse(fs.readFileSync(new URL("../src/lib/sources.json", import.meta.url), "utf8"));
const editorial = fs.readFileSync(new URL("../src/components/research-content/editorial-data.ts", import.meta.url), "utf8");
const reader = fs.readFileSync(new URL("../src/components/research-content/index.tsx", import.meta.url), "utf8");
const islandShell = fs.readFileSync(new URL("../src/components/island-experience/index.tsx", import.meta.url), "utf8");

test("caderno keeps seven unique themes in island order and routes old anchors", () => {
  assert.deepEqual(readingThemeIds, expectedThemes);
  assert.deepEqual(Object.values(legacyMap), ["pesquisa", "gerar", "comparar", "validar", "especificar", "perspectivas", "fontes"]);
  assert.equal(resolveReadingHash("#caderno/evoluir"), "evoluir");
  assert.equal(resolveReadingHash("#caderno/fontes"), "fontes");
  assert.equal(resolveReadingHash("#caderno/unknown"), null);
  assert.equal(resolveReadingHash("#trabalho"), "validar");
  assert.equal(resolveReadingHash("#pesquisa"), "fontes");
  assert.deepEqual(
    ["#conteudo", "#evolucao", "#produtividade", "#trabalho", "#papel", "#novidades", "#pesquisa"].map(resolveReadingHash),
    ["pesquisa", "gerar", "comparar", "validar", "especificar", "perspectivas", "fontes"],
  );
  assert.equal(readingHref("validar"), "#caderno/validar");
  assert.equal(readingHref("evoluir"), "#caderno/evoluir");
  assert.notEqual(readingHref("validar"), readingHref("evoluir"));
});

test("each chapter has a unique destination and cites registered source ids", () => {
  const anchors = [...editorial.matchAll(/readingAnchor:\s*"([^"]+)"/g)].map((match) => match[1]);
  const sourceGroups = [...editorial.matchAll(/sourceIds:\s*\[([^\]]+)\]/g)];
  const registeredIds = new Set(sources.map((source) => source.id));
  const citedIds = sourceGroups.flatMap((match) => [...match[1].matchAll(/"([^"]+)"/g)].map((source) => source[1]));

  assert.deepEqual(anchors, expectedThemes);
  assert.equal(new Set(anchors).size, 7);
  assert.equal(sourceGroups.length, 7);
  assert.ok(citedIds.length > 0);
  assert.ok(citedIds.every((id) => registeredIds.has(id)), "every chapter source id must exist in lib/sources.json");
  assert.match(islandShell, /href=\{readingHref\(pavilion\)\}/);
});

test("the library retains all 11 central and 13 complementary source contexts", () => {
  assert.equal(sources.filter((source) => source.group === "academic").length, 5);
  assert.equal(sources.filter((source) => source.group === "technical").length, 6);
  assert.equal(sources.filter((source) => source.group === "complementary").length, 13);
  assert.equal(new Set(sources.map((source) => source.id)).size, 24);
  assert.ok(sources.every((source) => ["title", "author", "year", "url", "group", "nature", "contribution"].every((key) => typeof source[key] === "string" && source[key].length > 0)));
  for (const context of ["Contexto", "Método", "O que foi medido", "Limites da leitura", "As 24 referências citadas"]) {
    assert.ok(reader.includes(context), `reader should preserve ${context.toLocaleLowerCase("pt-BR")}`);
  }
});

test("validation and professional practice have separate chapters", () => {
  assert.equal(readingHref("validar"), "#caderno/validar");
  assert.equal(readingHref("evoluir"), "#caderno/evoluir");
  assert.equal(resolveReadingHash("#trabalho"), "validar");
  const professionIndex = expectedThemes.indexOf("evoluir");
  assert.equal(anchorsFromEditorial()[professionIndex], "evoluir");
  assert.ok(editorial.includes("O trabalho continua depois da geração"));
  assert.ok(editorial.includes("A profissão concentra decisão e continuidade"));
});

function anchorsFromEditorial() {
  return [...editorial.matchAll(/readingAnchor:\s*"([^"]+)"/g)].map((match) => match[1]);
}
