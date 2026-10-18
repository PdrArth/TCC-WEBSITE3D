export const DEFAULT_BACKEND_ORIGIN: string;
export function backendUrl(path: string, origin?: string): URL;
export function backendRedirect(request: Request, path: string, origin?: string): Response;
