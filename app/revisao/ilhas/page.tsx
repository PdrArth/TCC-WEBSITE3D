import Link from "next/link";
import { requireChatGPTUser } from "@/app/chatgpt-auth";
import { requireOwner, AccessError } from "@/lib/owner";
import ResearchWorld from "@/components/research-world";
export const dynamic="force-dynamic";
export default async function AuthorIslands(){
  await requireChatGPTUser("/revisao/ilhas");
  try{await requireOwner();}catch(error){return <main className="unauthorized"><h1>Área exclusiva do autor.</h1><p>{error instanceof AccessError?error.message:"Os ajustes estão indisponíveis no momento."}</p><Link href="/">Voltar às ilhas</Link></main>;}
  return <ResearchWorld showSettings/>;
}
