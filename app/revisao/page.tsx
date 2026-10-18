import { redirect } from "next/navigation";
import { backendUrl } from "@/lib/deployment-backend.mjs";

export default function ReviewPage() {
  redirect(backendUrl("/revisao").href);
}
