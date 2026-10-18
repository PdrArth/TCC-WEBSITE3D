/** Reading order shared by the map, the world, and the chapter navigation. */
export const pavilionIds = ["pesquisa", "gerar", "comparar", "validar", "especificar", "evoluir", "perspectivas"] as const;
export type PavilionId = (typeof pavilionIds)[number];
export const islandNames: Record<PavilionId, string> = {
  pesquisa: "A pesquisa", gerar: "Ferramentas", comparar: "Produtividade",
  validar: "Validação", especificar: "Especificação", evoluir: "Profissão", perspectivas: "Perspectivas",
};
export const islandDescriptions: Record<PavilionId, string> = {
  pesquisa: "A pergunta, a hipótese e como o TCC foi feito",
  gerar: "Da sugestão de código à delegação de tarefas",
  comparar: "O que os estudos medem e por que divergem",
  validar: "Revisão, qualidade e Harness Engineering",
  especificar: "Contexto, requisitos e Spec-Driven Development",
  evoluir: "Integração, manutenção e o papel do desenvolvedor",
  perspectivas: "Conclusões, trabalhos futuros e novidades",
};
export type Vec3 = [number, number, number];
export type CameraPose = { position: Vec3; target: Vec3; fov: number };
export type FishRoutes = {
  routes: { points: [number, number][]; cumulative: number[]; headings: number[]; length: number; speed: number; phase: number; color: string; scale: number }[];
  waterHeight: number; seed: number;
};

export interface WorldEnvironmentManifest {
  water: { height: number; center: [number, number]; radii: [number, number]; shoreline: [number, number][] };
  land: { id: PavilionId; center: [number, number]; radius: number; height: number }[];
  decorativeLand?: { id: string; center: [number, number]; radius: number; height: number }[];
  waterObstacles?: { center: [number, number]; radius: number }[];
  fishRoutes?: FishRoutes;
  roofs?: { center: [number, number]; halfExtents: [number, number]; height: number; ridgeRise: number; yaw: number }[];
  bridges: { from: [number, number]; to: [number, number]; width: number; height: number; lighting?:boolean }[];
  vegetation: { evergreen: string[]; deciduous: string[] };
  lights: { pavilion: PavilionId; position: Vec3 }[];
  lighthouse: { position: Vec3; direction: Vec3 };
}

export interface WorldManifest {
  schemaVersion: 1 | 2 | 3;
  units: "meters";
  upAxis: "Y";
  assets: { world: string; worldLow: string; avatar: string; poster: string };
  initialCamera: CameraPose;
  movingCamera: { offset: Vec3; targetOffset: Vec3; damping: number; azimuthLock: true };
  spawn: Vec3;
  pavilions: Record<PavilionId, {
    entry: Vec3;
    focus: Vec3;
    hitNode: string;
    camera: CameraPose;
    posterPoint: [number, number];
  }>;
  navigation: {
    nodes: Record<string, { position: Vec3 }>;
    edges: [string, string][];
    destinations: Record<PavilionId, string>;
  };
  avatar?: { speed: number; scale: number };
  ambientNodes?: string[];
  bridges?: { from: PavilionId; to: PavilionId; nodes: string[] }[];
  birdPerches?: { position: Vec3; island: PavilionId }[];
  birdShelters?: { position: Vec3; island: string }[];
  cameraBounds?: { minZoom: number; maxZoom: number };
  environment?: WorldEnvironmentManifest;
  islandLife?: import("./experience/island-life.mjs").IslandLifeLayout;
  preparedLifeGeometry?: import("./experience/life-geometry.mjs").PreparedLifeGeometry;
}

export interface AudioTrackManifest {
  url: string;
  title: string;
  author: string;
  source: string;
  license: string;
  attribution: string;
  volume: number;
  assetSource?: string;
  licenseSource?: string;
  verifiedAt?: string;
  sha256?: string;
  startAtSeconds?: number;
}

export interface AudioManifest {
  music: AudioTrackManifest;
  playlist?: AudioTrackManifest[];
  selection: { url: string; volume: number };
  arrival: { url: string; volume: number };
  thunder?: { url: string; volume: number };
}
