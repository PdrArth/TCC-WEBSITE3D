import { backendRedirect } from "@/lib/deployment-backend.mjs";

export function POST(request: Request) {
  return backendRedirect(request, "/api/editorial/decision");
}
