import assert from "node:assert/strict";
import fs from "node:fs";
assert.equal(process.env.TCC_TEST_DB_ISOLATED, "1", "Run only against an isolated test database.");
const origin = process.env.TCC_TEST_ORIGIN;
assert.ok(/^http:\/\/127\.0\.0\.1:\d+$/.test(origin ?? ""), "Set TCC_TEST_ORIGIN to the isolated local server.");
const auth = { Cookie: "__sites_local_auth=1", "Content-Type": "application/json" };
const drafts = JSON.parse(fs.readFileSync(new URL("./fixtures/synthetic-drafts.json",import.meta.url),"utf8"));
async function rpc(name,args={},signed=true) { const r=await fetch(origin+"/mcp",{method:"POST",headers:signed?auth:{"Content-Type":"application/json"},body:JSON.stringify({jsonrpc:"2.0",id:1,method:"tools/call",params:{name,arguments:args}})}); const data=await r.json(); return {status:r.status,data,value:!data.result?.isError && data.result?.content?.[0]?.text?JSON.parse(data.result.content[0].text):null}; }
async function publicNews() { const r=await fetch(origin+"/api/updates");assert.equal(r.status,200);return (await r.json()).updates; }
async function decide(row,decision,requestOrigin=origin) { const r=await fetch(origin+"/api/editorial/decision",{method:"POST",headers:{...auth,Origin:requestOrigin},body:JSON.stringify({id:row.id,revision:row.revision,decision})});const text=await r.text();let data;try{data=JSON.parse(text);}catch{data={error:text};}return {status:r.status,data}; }
assert.equal((await fetch(origin+"/api/editorial")).status,401);
assert.equal((await rpc("read_editorial",{},false)).status,401);
const seeded=await rpc("save_research_drafts",{drafts});assert.equal(seeded.status,200);assert.equal(seeded.value.length,5);assert.equal((await publicNews()).length,0);
const duplicate=await rpc("save_research_drafts",{drafts});assert.deepEqual(duplicate.value.map(x=>[x.id,x.revision]),seeded.value.map(x=>[x.id,x.revision]));
const stale=seeded.value[0];const changed=await rpc("save_research_drafts",{drafts:[{...drafts[0],summary:drafts[0].summary+" Limites registrados para a comparação contextual."}]});assert.equal(changed.value[0].revision,stale.revision+1);
assert.equal((await decide(stale,"published")).data.changed,false);assert.equal((await publicNews()).length,0);
assert.equal((await decide(changed.value[0],"published","https://other.example")).status,403);
assert.equal((await decide(changed.value[0],"published")).data.changed,true);assert.equal((await publicNews()).length,1);
const immutable=await rpc("save_research_drafts",{drafts:[drafts[0]]});assert.equal(immutable.value[0].status,"published");assert.equal(immutable.value[0].summary,changed.value[0].summary);
assert.equal((await decide(seeded.value[1],"discarded")).data.changed,true);
const rejected=await rpc("save_research_drafts",{drafts:[drafts[1]]});assert.equal(rejected.value[0].status,"discarded");
const cannotPublish=await rpc("publish_news",{id:seeded.value[2].id});assert.equal(cannotPublish.data.result.isError,true);
const malformed=await rpc("save_research_drafts",{drafts:[{...drafts[2],checkedDate:"2030-01-01",publicationDate:"2030-01-01"}]});assert.equal(malformed.data.result.isError,true);assert.equal((await publicNews()).length,1);
const recorded=await rpc("record_research_run",{id:"local_validation",checkedAt:new Date().toISOString(),status:"success",summary:"Pesquisa inicial e fluxo editorial conferidos no banco local. A execução em nuvem ainda exige verificação independente."});assert.equal(recorded.status,200);
const readback=await rpc("read_editorial");assert.equal(readback.value.updates.length,5);assert.equal(readback.value.latestRun.id,"local_validation");
const pdf=await fetch(origin+"/tcc-pedro-arthur.pdf");assert.equal(pdf.status,200);assert.ok((await pdf.arrayBuffer()).byteLength>700000);
console.log(JSON.stringify({passed:15,drafts:5,publicationRevisionProtected:true,anonymousWriteBlocked:true,crossOriginBlocked:true,publishedAndDiscardedImmutable:true,cloudAccessVerified:false}));
