export type AccessibilityPreferences = {motion:'system'|'reduced'|'paused';contrast:'system'|'high'|'dark';palette:'original'|'blue-amber'|'monochrome';textSize:'normal'|'large'|'larger';spacing:boolean;textView:boolean;captions:boolean;flashes:boolean;announcements:boolean};
export type ResolvedAccessibility = AccessibilityPreferences & {reducedMotion:boolean;paused:boolean;theme:'normal'|'high'|'dark';allowFlashes:boolean};
export const ACCESSIBILITY_KEY:string;
export const accessibilityDefaults:Readonly<AccessibilityPreferences>;
export function parseAccessibility(value:unknown):AccessibilityPreferences;
export function resolveAccessibility(preferences:AccessibilityPreferences,system?:{reducedMotion?:boolean;moreContrast?:boolean}):ResolvedAccessibility;
export function contrastRatio(a:string,b:string):number;
export const accessiblePalettes:Record<AccessibilityPreferences['palette'],string[]>;
