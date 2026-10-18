import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const sources = JSON.parse(await readFile(new URL("../src/lib/sources.json", import.meta.url), "utf8"));
const packagePaths = Object.fromEntries(["react", "react/jsx-runtime", "lucide-react"].map(name => [name, import.meta.resolve(name)]));
async function compiled(path, replacements = {}) {
  const source = (await readFile(new URL(path, import.meta.url), "utf8"))
    .replace(/import sources from "[^"]+sources\.json";/, `const sources = ${JSON.stringify(sources)};`)
    .replace(/import "\.\/content\.css";/, "");
  let code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  for (const [specifier, destination] of Object.entries({ ...packagePaths, ...replacements })) code = code.replaceAll(JSON.stringify(specifier), JSON.stringify(destination));
  return "data:text/javascript;base64," + Buffer.from(code).toString("base64");
}
const researchUrl = await compiled("../src/lib/research.ts");
const editorialUrl = await compiled("../src/components/research-content/editorial-data.ts");
const pavilionUrl = await compiled("../src/lib/pavilion-content.ts");
const readerUrl = await compiled("../src/components/research-content/index.tsx", {
  "@/lib/research": researchUrl,
  "@/lib/pavilion-content": pavilionUrl,
  "./editorial-data": editorialUrl,
  "@/lib/reading-navigation.mjs": new URL("../src/lib/reading-navigation.mjs", import.meta.url).href,
});
const { PavilionContent } = await import(readerUrl);
const { editorialSections } = await import(editorialUrl);
const { timeline } = await import(researchUrl);
const panel = pavilionId => renderToStaticMarkup(createElement(PavilionContent, { pavilionId, updates: [], newsState: "ready" }));

test("every island renders its existing art and all three paragraphs without hidden tabs", () => {
  for (const [id, section] of Object.entries(editorialSections)) {
    const html = panel(id);
    assert.match(html, /data-summary-layout="v14"/);
    assert.equal((html.match(/class="rc-panel-paragraph"/g) ?? []).length, 3);
    assert.equal(html.includes('role="tab'), false);
    for (const paragraph of section.paragraphs) assert.ok(html.includes(paragraph.heading));
    assert.ok(html.indexOf('class="rc-panel-hero"') < html.indexOf('class="rc-summary-heading"'));
    assert.ok(html.includes("não representa evidência dos estudos"));
    assert.ok(html.includes("Fontes desta síntese"));
  }
});

test("tools show all eight unaltered dated events, caveats and original links together", () => {
  const html = panel("gerar");
  const chronology = html.split('class="rc-panel-timeline"')[1].split("</ol>")[0];
  assert.equal((chronology.match(/<li>/g) ?? []).length, 8);
  let previous = -1;
  for (const event of timeline) {
    const index = chronology.indexOf(event.name);
    assert.ok(index > previous);
    previous = index;
    assert.ok(chronology.includes(event.date));
    assert.ok(chronology.includes(event.note));
    assert.ok(chronology.includes(event.source));
  }
  assert.ok(html.includes("sem escala proporcional"));
  assert.ok(html.includes("não comprova seu lançamento inicial"));
  assert.ok(html.includes("https://cursor.com/changelog/0-2-39"));
});

test("summaries retain the productivity contrast and the notebook remains wide with an 18px body floor", async () => {
  const html = panel("comparar");
  for (const text of ["55,8%", "19%", "não devem ser somados", "percepção não equivale"]) assert.ok(html.includes(text));
  const css = await readFile(new URL("../src/components/research-content/reading-v10.css", import.meta.url), "utf8");
  assert.match(css, /width: min\(1400px, calc\(100% - 2 \* var\(--reader-gutter\)\)\)/);
  assert.match(css, /--reader-type: clamp\(22px, 1\.43vw, 24px\)/);
  assert.match(css, /--reader-type: 18px/);
});
