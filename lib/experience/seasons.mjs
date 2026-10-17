/**
 * Conventional Southern Hemisphere meteorological quarters, in the visitor's
 * local calendar. This is a scenic Minas Gerais / inland Southeast interpretation,
 * not an astronomical calendar or a live weather forecast.
 */
export const seasonCalendar = "Trimestres meteorológicos do hemisfério sul";
export const seasonRegion = "Minas Gerais e interior do Sudeste";

export const seasonInfo = {
  spring: {
    name: "Primavera",
    description: "Flores, verde novo e transição do período seco para o chuvoso.",
    months: [8, 9, 10], leafDensity: 1, flowerDensity: 1, dryness: .2,
    foliage: { evergreen: 1, semiDeciduous: 1, deciduous: .97, understory: 1 },
    litterDensity: .16, fallingLeaves: .06, waterColor: "#72aaa2",
    palette: { dark: "#507046", sage: "#83a16c", light: "#a3b879", deep: "#385c3c", dry: "#b1b181", ivory: "#eee0b2", flower: "#bb92b8", sky: "#e4eee4", ground: "#90a47e" },
  },
  summer: {
    name: "Verão",
    description: "Vegetação mais intensa, ar quente e maior presença de chuva.",
    months: [11, 0, 1], leafDensity: 1, flowerDensity: .55, dryness: .05,
    foliage: { evergreen: 1, semiDeciduous: 1, deciduous: 1, understory: 1 },
    litterDensity: .1, fallingLeaves: .035, waterColor: "#669f96",
    palette: { dark: "#3f6c3a", sage: "#63925c", light: "#90ae66", deep: "#2e5335", dry: "#a3aa76", ivory: "#eadca8", flower: "#aa9cbe", sky: "#dcece5", ground: "#73936b" },
  },
  autumn: {
    name: "Outono",
    description: "Verde mais discreto, tons de palha e chuva diminuindo aos poucos.",
    months: [2, 3, 4], leafDensity: .88, flowerDensity: .22, dryness: .54,
    foliage: { evergreen: .98, semiDeciduous: .88, deciduous: .79, understory: .93 },
    litterDensity: .64, fallingLeaves: .72, waterColor: "#80a59a",
    palette: { dark: "#65724b", sage: "#929b70", light: "#abb182", deep: "#4b6242", dry: "#b5aa80", ivory: "#d8c8a5", flower: "#a498a1", sky: "#e9e7dc", ground: "#a5a17d" },
  },
  winter: {
    name: "Inverno",
    description: "Estação seca, gramíneas em tons de palha e árvores perenes preservadas.",
    months: [5, 6, 7], leafDensity: .75, flowerDensity: .08, dryness: .87,
    foliage: { evergreen: .94, semiDeciduous: .72, deciduous: .48, understory: .82 },
    litterDensity: .4, fallingLeaves: .16, waterColor: "#88a78e",
    palette: { dark: "#757951", sage: "#a2a17d", light: "#b7b08b", deep: "#556445", dry: "#c3b58c", ivory: "#d4c4a4", flower: "#a9a18e", sky: "#e9e7df", ground: "#afa789" },
  },
};

/** Scenic responses use the species already authored in the v9 garden. */
export function vegetationGroup(nodeName = "") {
  if (/ipe_(amarelo|roxo)/i.test(nodeName)) return "deciduous";
  if (/pau_brasil|quaresmeira/i.test(nodeName)) return "semiDeciduous";
  if (/palmeira|palm|banana|araucaria|jabuticab|pitangueira|cypress/i.test(nodeName)) return "evergreen";
  return "understory";
}

export function vegetationDensity(season, nodeName, flower = false) {
  const info = seasonInfo[season] ?? seasonInfo.spring;
  if (!flower) return info.foliage[vegetationGroup(nodeName)];
  // The dry-season ipês keep some blossom while their whole leaves thin out.
  // This is an illustrative garden response, not a phenology or climate model.
  if (/ipe_(amarelo|roxo)/i.test(nodeName) && season === "winter") return .58;
  if (/quaresmeira/i.test(nodeName) && season === "summer") return .86;
  return info.flowerDensity;
}

export function getSeason(date = new Date()) {
  const month = date.getMonth();
  if (!Number.isFinite(month)) return "spring";
  if (month === 11 || month < 2) return "summer";
  if (month < 5) return "autumn";
  if (month < 8) return "winter";
  return "spring";
}
