import Link from "next/link";
import { requireChatGPTUser, chatGPTSignOutPath } from "@/app/chatgpt-auth";
import { requireOwner, AccessError } from "@/lib/owner";
import EditorialReview from "@/components/editorial-review";
export const dynamic = "force-dynamic";
export default function ReviewPage() { return <AuthorizedReview />; }
async function AuthorizedReview() {
  await requireChatGPTUser("/revisao");
  try { await requireOwner(); } catch (error) { return <main className="unauthorized"><h1>Área exclusiva<br />do autor.</h1><p>{error instanceof AccessError ? error.message : "A revisão está indisponível no momento."}</p><Link className="primary-link" href="/">Voltar à pesquisa</Link></main>; }
  return <EditorialReview signOutPath={chatGPTSignOutPath("/")} />;
}
