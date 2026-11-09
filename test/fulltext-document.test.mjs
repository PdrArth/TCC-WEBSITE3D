import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

const document=JSON.parse(await readFile(new URL('../src/lib/tcc-complete.json',import.meta.url),'utf8'));
const descriptions=JSON.parse(await readFile(new URL('../scripts/accessibility/figure-descriptions.json',import.meta.url),'utf8'));
const html=document.html;
const decode=value=>value.replaceAll('&amp;','&').replaceAll('&quot;','"').replaceAll('&#39;',"'");
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(match=>decode(match[1]));
const fragments=[...html.matchAll(/\bhref="#([^"]+)"/g)].map(match=>decodeURIComponent(decode(match[1])));

test('the complete HTML is bound to the exact public PDF and reviewed figure descriptions',async()=>{
  const pdf=await readFile(new URL('../public/tcc-pedro-arthur.pdf',import.meta.url));
  const hash=createHash('sha256').update(pdf).digest('hex');
  assert.equal(document.sourcePdfSha256,hash);assert.equal(descriptions.sourcePdfSha256,hash);
  assert.equal(document.sourcePages,39);assert.equal(document.author,'Pedro Arthur Oliveira Januário');
  assert.ok(document.title.startsWith('Mudanças no papel do desenvolvedor na era das IAs generativas:'));
  assert.ok(html.length>90000,'this must contain the full text, not the short existing garden summaries');
  for(const source of ['Main.tex','Main.bbl','capitulos/1_introducao.tex','capitulos/2_revisaoBibliografica.tex','capitulos/2_fontes_revisao.tex','capitulos/2_evolucao_ferramentas.tex','capitulos/3_metodologia.tex','capitulos/4_analiseDiscussao.tex','capitulos/5_conclusoes.tex','referenciasbibliograficas.bib'])assert.ok(document.sourceFiles.includes(source),source);
});

test('all five chapters and both abstracts have navigable headings under the page H1',()=>{
  const chapters=document.headings.filter(heading=>heading.level===2&&/^\d /u.test(heading.title));
  assert.deepEqual(chapters.map(heading=>heading.title),['1 Introdução','2 Revisão da Literatura','3 Metodologia','4 Análise e Discussão','5 Conclusões']);
  assert.doesNotMatch(html,/<h1\b/i);
  assert.ok(document.headings.every(heading=>heading.level>=2&&heading.level<=6&&ids.includes(heading.id)));
  assert.ok(document.headings.some(heading=>heading.title==='Resumo'&&heading.level===2));
  assert.ok(document.headings.some(heading=>heading.title==='Abstract'&&heading.level===2));
  assert.match(html,/<div[^>]+class="tcc-abstract"[^>]+lang="en"/);
  assert.ok(html.includes('This work presents a narrative literature review with documentary support'));
  assert.ok(html.includes('Aprovado em: 03/09/2026'));
  for(const text of ['Caracterização da pesquisa','O paradoxo da produtividade','Limitações da literatura analisada','Trabalhos futuros'])assert.ok(html.includes(text),text);
});

test('the source table preserves eleven complete records, four column headers and the two original groups',()=>{
  const region=html.match(/<div class="document-table-region"[^>]*>(\s*<table\b[\s\S]*?<\/table>)\s*<\/div>/);
  assert.ok(region,'the table must have its own scroll region');
  const regionTag=region[0].slice(0,region[0].indexOf('>')+1);
  assert.ok(regionTag.includes('role="region"'));assert.ok(regionTag.includes('aria-label="Quadro 1 — Fontes da revisão"'));assert.ok(regionTag.includes('tabindex="0"'));
  const bodies=[...region[1].matchAll(/<tbody\b[^>]*>([\s\S]*?)<\/tbody>/g)].map(match=>match[1]);
  assert.equal(bodies.length,2,'each source group must be a real table row group');
  assert.deepEqual(bodies.map(body=>(body.match(/data-source-key=/g)??[]).length),[5,6]);
  assert.ok(bodies[0].includes('Trabalhos acadêmicos'));assert.ok(bodies[1].includes('Fontes técnicas, críticas e jornalísticas'));
  for(const body of bodies)assert.equal((body.match(/scope="rowgroup"/g)??[]).length,1);
  const rows=[...html.matchAll(/<tr\b[^>]*data-source-key="([^"]+)"[^>]*>([\s\S]*?)<\/tr>/g)];
  assert.equal(rows.length,11);
  assert.deepEqual(rows.map(row=>row[1]),['peng2023impact','becker2025impact','vasilescu2025copilot','chen2026beyond','piskala2026sdd','delimarsky2025speckit','bockeler2025sddtools','thoughtworks2025sdd','fowler2026fragments','gomescortiz2026tilt','bockeler2026harness']);
  assert.equal((html.match(/scope="col"/g)??[]).length,4);
  for(const row of rows){assert.equal((row[2].match(/<(?:th|td)\b/g)??[]).length,4);assert.match(row[2],/<th scope="row">/);}
  assert.ok(html.includes('Trabalhos acadêmicos'));assert.ok(html.includes('Fontes técnicas, críticas e jornalísticas'));
  assert.ok(html.includes('Fonte: elaborado pelo autor a partir das referências indicadas no quadro.'));
  assert.ok(html.includes('Quadro 1 – Fontes que fundamentam a análise da revisão.'));
});

test('four figures preserve their meanings, attribution and nonvisual alternatives',()=>{
  assert.equal(document.figureCount,4);assert.equal((html.match(/<figure\b/g)??[]).length,4);
  for(let number=1;number<=4;number++){assert.ok(html.includes(`data-tcc-figure="${number}"`));assert.ok(html.includes(`Figura ${number} –`));}
  assert.equal((html.match(/class="tcc-figure-description"/g)??[]).length,4);
  for(const text of ['retorna da validação à especificação','spec-first','spec-anchored','spec-as-source','CfRs','feedforward','feedback','espaçamento sem escala temporal proporcional','prévia pública'])assert.ok(html.includes(text),text);
  assert.ok(html.includes('Descrição da figura:'));
});

test('citations, original bibliography entries, notes and navigation have no missing or duplicate anchors',()=>{
  const references=ids.filter(id=>id.startsWith('tcc-ref-'));
  assert.equal(document.referenceCount,24);assert.equal(references.length,24);
  assert.equal(ids.length,new Set(ids).size);
  for(const fragment of fragments)assert.ok(ids.includes(fragment),`missing ${fragment}`);
  for(const reference of references)assert.ok(fragments.includes(reference),`uncited ${reference}`);
  assert.match(html,/role="doc-noteref"/);assert.match(html,/role="doc-backlink"/);
  assert.match(html,/role="doc-noteref" aria-label="Ler nota 1"/);
  assert.match(html,/role="doc-backlink" aria-label="Voltar ao trecho da nota 1"/);
  assert.match(html,/role="doc-endnotes" aria-label="Notas do TCC"/);
  const referenceList=html.match(/<div id="tcc-refs"[^>]*>/)?.[0]??'';
  assert.ok(referenceList.includes('role="list"'));assert.ok(referenceList.includes('aria-label="Referências bibliográficas"'));
  assert.ok(html.includes('Acesso em: 2026-04-06.'));
  assert.ok(html.includes('Disponível em:'));
  assert.ok(html.includes('BÖCKELER, B.'));
  assert.doesNotMatch(html,/<span\s*>/i,'inert accent wrappers must not fragment words for assistive technology');
  assert.doesNotMatch(html,/ı\u0301/);
  assert.ok(document.headings.some(heading=>heading.title==='Referências bibliográficas'));
});

test('the generated static fragment contains no executable markup, unsafe URLs or unconverted LaTeX',()=>{
  assert.doesNotMatch(html,/<(?:script|iframe|object|embed|style|form|input|button)\b/i);
  assert.doesNotMatch(html,/\son[a-z]+\s*=/i);
  assert.doesNotMatch(html,/\b(?:href|src)\s*=\s*["']\s*(?:javascript|data|vbscript):/i);
  assert.doesNotMatch(html,/\\(?:cite|citet|citeonline|ref|begin|end|textit|label)\b/);
  assert.doesNotMatch(html,/GARDEN(?:FIGURE|REFERENCE|DESCRIPTION)|citation not found|\[\?\]/i);
  for(const match of html.matchAll(/\bhref="([^"]+)"/g)){
    const url=decode(match[1]);if(url.startsWith('#'))continue;
    const parsed=new URL(url);assert.ok(['http:','https:','mailto:'].includes(parsed.protocol),url);
    assert.equal(parsed.username,'');assert.equal(parsed.password,'');
  }
  for(const match of html.matchAll(/\btabindex="([^"]*)"/g))assert.ok(['0','-1'].includes(match[1]));
});
