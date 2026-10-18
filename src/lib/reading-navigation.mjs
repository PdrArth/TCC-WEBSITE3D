export const readingThemeIds = Object.freeze([
  "pesquisa",
  "gerar",
  "comparar",
  "validar",
  "especificar",
  "evoluir",
  "perspectivas",
]);

/** Old public anchors remain readable while the caderno uses unique chapter ids. */
export const legacyMap = Object.freeze({
  conteudo: "pesquisa",
  evolucao: "gerar",
  produtividade: "comparar",
  trabalho: "validar",
  papel: "especificar",
  novidades: "perspectivas",
  pesquisa: "fontes",
});

const isThemeId = (value) => readingThemeIds.includes(value);

export function resolveReadingHash(hash) {
  if (typeof hash !== "string") return null;
  const value = hash.trim().replace(/^#/, "");
  if (Object.hasOwn(legacyMap, value)) return legacyMap[value];
  if (value === "caderno/fontes") return "fontes";
  if (!value.startsWith("caderno/")) return null;
  const id = value.slice("caderno/".length);
  return isThemeId(id) ? id : null;
}

export function readingHref(id) {
  if (id === "fontes") return "#caderno/fontes";
  if (!isThemeId(id)) throw new TypeError(`Unknown caderno theme: ${String(id)}`);
  return `#caderno/${id}`;
}
