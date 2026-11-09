export type DiscoveryId='birds'|'fish'|'butterflies'|'ducks'|'turtles'|'fireflies'|'rainbow'|'meteor'|'waterfall'|'feeding'|'greeting'|'fishing';
export type DiscoveryLedger=Partial<Record<DiscoveryId,string>>;
export const DISCOVERY_KEY:string;
export const discoveryCatalog:{id:DiscoveryId;name:string;group:string;description:string}[];
export function parseDiscoveries(value:unknown):DiscoveryLedger;
export function recordDiscovery(entries:DiscoveryLedger,id:string,date?:string):DiscoveryLedger;
