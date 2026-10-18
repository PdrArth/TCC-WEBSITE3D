import type { PavilionId } from "./experience-contract.js";

export type ReadingDestination = PavilionId | "fontes";
export type LegacyReadingAnchor =
  | "conteudo"
  | "evolucao"
  | "produtividade"
  | "trabalho"
  | "papel"
  | "novidades"
  | "pesquisa";

export const readingThemeIds: readonly PavilionId[];
export const legacyMap: Readonly<Record<LegacyReadingAnchor, ReadingDestination>>;
export function resolveReadingHash(hash: string): ReadingDestination | null;
export function readingHref(id: ReadingDestination): string;
