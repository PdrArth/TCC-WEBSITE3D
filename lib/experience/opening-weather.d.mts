import type { Weather } from "./weather.mjs";
export const openingWeatherKinds: Weather[];
export const openingWeatherKey: string;
export type OpeningWeather = { weather: Weather; coordination: "transaction" | "locked" | "storage" | "independent"; position: number | null };
export function claimOpeningWeather(options?: {
  storage?: Pick<Storage, "getItem" | "setItem">;
  database?: IDBFactory;
  locks?: Pick<LockManager, "request">;
  random?: () => number;
}): Promise<OpeningWeather>;
