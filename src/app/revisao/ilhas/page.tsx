import { redirect } from "next/navigation";
import { backendUrl } from "@/lib/deployment-backend.mjs";

export default function AuthorIslands() {
  redirect(backendUrl("/revisao/ilhas").href);
}
