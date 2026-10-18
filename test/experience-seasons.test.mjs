import test from "node:test";
import assert from "node:assert/strict";
import { getSeason, seasonCalendar, seasonInfo, seasonRegion, vegetationDensity, vegetationGroup } from "../src/lib/experience/seasons.mjs";

test("the local calendar assigns the four Southern Hemisphere meteorological quarters", () => {
  const expected = ["summer", "summer", "autumn", "autumn", "autumn", "winter", "winter", "winter", "spring", "spring", "spring", "summer"];
  for (let year = 2025; year <= 2027; year++) {
    for (let month = 0; month < 12; month++) {
      assert.equal(getSeason(new Date(year, month, 1, 0, 0, 0)), expected[month]);
      assert.equal(getSeason(new Date(year, month + 1, 0, 23, 59, 59)), expected[month]);
    }
  }
  assert.equal(getSeason(new Date(NaN)), "spring");
  assert.ok(seasonCalendar.includes("meteorológicos"));
  assert.ok(seasonRegion.includes("Minas Gerais"));
});

test("every season has coherent Portuguese metadata and a dry Southeast winter", () => {
  assert.deepEqual(Object.keys(seasonInfo), ["spring", "summer", "autumn", "winter"]);
  const covered = [];
  for (const info of Object.values(seasonInfo)) {
    assert.ok(info.name && info.description);
    covered.push(...info.months);
    assert.ok(info.leafDensity > .3 && info.leafDensity <= 1);
    assert.ok(info.flowerDensity >= 0 && info.flowerDensity <= 1);
    assert.ok(info.litterDensity >= 0 && info.litterDensity <= 1);
    assert.ok(info.fallingLeaves >= 0 && info.fallingLeaves <= 1);
    assert.match(info.waterColor, /^#[0-9a-f]{6}$/i);
    for (const color of Object.values(info.palette)) assert.match(color, /^#[0-9a-f]{6}$/i);
  }
  assert.deepEqual(covered.toSorted((a, b) => a - b), Array.from({ length: 12 }, (_, month) => month));
  assert.ok(seasonInfo.winter.leafDensity < seasonInfo.summer.leafDensity);
  assert.ok(seasonInfo.winter.dryness > seasonInfo.summer.dryness);
  assert.ok(seasonInfo.spring.flowerDensity > seasonInfo.autumn.flowerDensity);
});

test("the authored Southeast garden keeps its perennials while deciduous trees respond to dry weather", () => {
  const evergreen = ["palmeira", "palmeira_jovem", "banana", "araucaria", "jabuticabeira", "pitangueira"];
  for (const kind of evergreen) {
    const node = `ambient_leaves_pesquisa_${kind}`;
    assert.equal(vegetationGroup(node), "evergreen");
    assert.ok(vegetationDensity("winter", node) >= .9, `${kind} must keep its crown in winter`);
    assert.ok(vegetationDensity("summer", node) >= vegetationDensity("winter", node));
  }
  for (const kind of ["ipe_amarelo", "ipe_roxo"]) {
    const node = `ambient_leaves_perspectivas_${kind}`;
    assert.equal(vegetationGroup(node), "deciduous");
    assert.ok(vegetationDensity("winter", node) < .6);
    assert.ok(vegetationDensity("autumn", node) > vegetationDensity("winter", node));
    assert.ok(vegetationDensity("winter", node, true) > seasonInfo.winter.flowerDensity);
  }
  assert.equal(vegetationGroup("ambient_leaves_especificar_pau_brasil"), "semiDeciduous");
  assert.equal(vegetationGroup("ambient_leaves_validar_understory"), "understory");
  assert.ok(seasonInfo.autumn.litterDensity > seasonInfo.summer.litterDensity);
  assert.ok(seasonInfo.autumn.fallingLeaves > seasonInfo.winter.fallingLeaves);
});
