#!/usr/bin/env python3
"""Export the approved TCC into a checked, static HTML fragment.

Development-only tool. The published app reads the generated JSON and needs
neither Python nor Pandoc. No input manuscript or PDF is modified.
"""
from __future__ import annotations

import argparse
import copy
import hashlib
import html
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import subprocess
import sys
from urllib.parse import unquote, urlsplit

REPO = Path(__file__).resolve().parents[2]
DEFAULT_SOURCE = Path("G:/Downloads/Modelo_TCC_ECA_UFSC_Blumenau")
CHAPTERS = ["1_introducao", "2_revisaoBibliografica", "3_metodologia", "4_analiseDiscussao", "5_conclusoes"]
EXPECTED_REFS = 24


def group(text: str, at: int, opening: str = "{", closing: str = "}") -> tuple[str, int]:
    while at < len(text) and text[at].isspace():
        at += 1
    if at >= len(text) or text[at] != opening:
        raise ValueError(f"Expected {opening!r} near {text[at:at+90]!r}")
    depth, start = 1, at + 1
    at += 1
    while at < len(text):
        if text[at] == "\\":
            at += 2
            continue
        if text[at] == opening:
            depth += 1
        elif text[at] == closing:
            depth -= 1
            if not depth:
                return text[start:at], at + 1
        at += 1
    raise ValueError("Unbalanced source group")


def command_arg(text: str, name: str, count: int = 1) -> list[str]:
    found = re.search(r"\\" + re.escape(name) + r"(?![A-Za-z])", text)
    if not found:
        raise ValueError(f"Missing source command: {name}")
    result, at = [], found.end()
    for _ in range(count):
        value, at = group(text, at)
        result.append(value)
    return result


def no_comments(text: str) -> str:
    return re.sub(r"(?<!\\)%[^\n]*", "", text)


def str_inlines(value: str) -> list[dict]:
    result = []
    for index, token in enumerate(value.split()):
        if index:
            result.append({"t": "Space"})
        result.append({"t": "Str", "c": token})
    return result


def para(value: str) -> dict:
    return {"t": "Para", "c": str_inlines(value)}


def inline_text(node) -> str:
    if isinstance(node, list):
        return "".join(inline_text(item) for item in node)
    if not isinstance(node, dict):
        return ""
    if node.get("t") == "Str":
        return node["c"]
    if node.get("t") in {"Space", "SoftBreak", "LineBreak"}:
        return " "
    if node.get("t") in {"Link", "Image", "Span"}:
        return inline_text(node["c"][1])
    if node.get("t") == "Cite":
        return inline_text(node["c"][1])
    return inline_text(node.get("c", []))


def walk(node):
    if isinstance(node, dict):
        if "t" in node:
            yield node
        yield from walk(node.get("c"))
    elif isinstance(node, list):
        for item in node:
            yield from walk(item)


class Exporter:
    def __init__(self, source: Path, pandoc: str):
        self.source, self.pandoc = source.resolve(), pandoc
        self.files: set[str] = set()
        self.figures = json.loads((REPO / "scripts/accessibility/figure-descriptions.json").read_text(encoding="utf-8"))
        self.figure_source: list[dict] = []

    def read(self, name: str) -> str:
        path = (self.source / name).resolve()
        if self.source not in path.parents:
            raise ValueError("An input escaped the manuscript directory")
        self.files.add(path.relative_to(self.source).as_posix())
        return path.read_text(encoding="utf-8-sig")

    def pandoc_run(self, text: str, *args: str) -> str:
        result = subprocess.run([self.pandoc, *args], input=text, encoding="utf-8", text=True, capture_output=True, check=True)
        if result.stderr.strip():
            print(result.stderr.strip(), file=sys.stderr)
        return result.stdout

    def expand(self, name: str, stack: tuple[str, ...] = ()) -> str:
        if name in stack:
            raise ValueError(f"Cyclic input: {name}")
        text = no_comments(self.read(name))
        return re.sub(r"\\(?:input|include)\{([^}]+)\}", lambda match: self.expand(match[1] if match[1].endswith(".tex") else match[1]+".tex", stack+(name,)), text)

    def reference_sources(self) -> tuple[list[str], str]:
        text = self.read("Main.bbl")
        matches = list(re.finditer(r"\\bibitem(?:\[[^\]]*\])?\{([^}]+)\}", text))
        bodies = []
        for index, match in enumerate(matches):
            part = text[match.end():matches[index+1].start() if index+1 < len(matches) else text.find(r"\end{thebibliography}")]
            ref_info = re.search(r"\\abntrefinfo", part)
            if ref_info:
                at = ref_info.end()
                for _ in range(3):
                    _, at = group(part, at)
                part = part[at:].strip()
            body, _ = group(part, 0)
            bodies.append((match[1], body))
        if len(bodies) != EXPECTED_REFS:
            raise ValueError(f"Expected {EXPECTED_REFS} references in the compiled bibliography, got {len(bodies)}")
        return [key for key, _ in bodies], "\n\n".join(r"\begin{quote}"+"\nGARDENREFERENCE_"+key+"\n\n"+body+"\n"+r"\end{quote}" for key, body in bodies)

    def replace_figure(self, match: re.Match) -> str:
        text, index = match[1], len(self.figure_source)
        if index >= len(self.figures["figures"]):
            raise ValueError("An undescribed figure was found")
        caption_match = re.search(r"\\caption(?:\[[\s\S]*?\])?", text)
        if not caption_match:
            raise ValueError("A figure has no caption")
        caption, caption_end = group(text, caption_match.end())
        label = command_arg(text, "label")[0]
        notes = text[caption_end:]
        notes = re.sub(r"\\label\{[^}]+\}", "", notes)
        notes = re.sub(r"\\begin\{minipage\}\{[^}]+\}|\\end\{minipage\}", "", notes)
        notes = re.sub(r"\\(?:footnotesize|SingleSpacing|smallskip)\b", "", notes)
        notes = re.sub(r"\\par\b", "\n\n", notes).strip()
        description = self.figures["figures"][index]
        self.figure_source.append({"label": label, "number": index+1})
        body = [f"GARDENFIGURE_{index+1}", caption, "GARDENDESCRIPTION", r"\textbf{Descrição da figura:} "+description["shortDescription"], r"\begin{itemize}"]
        body += [r"\item "+item for item in description["items"]]
        body += [r"\end{itemize}", "GARDENFIGURENOTES", notes]
        return "\n\n"+r"\begin{quote}"+"\n\n"+"\n\n".join(body)+"\n\n"+r"\end{quote}"+"\n\n"

    def frontmatter(self, main: str) -> str:
        get = lambda name: command_arg(main, name)[0]
        name_parts = command_arg(main, "DEELautor", 2)
        self.title, self.author = get("titulo"), " ".join(name_parts)
        # This institutional paragraph is literal in the matching local class.
        style = self.read("style/UFSC-ECA-Monograph.sty")
        institution = "Centro Universitário de Viçosa -- Univiçosa"
        if institution not in style:
            raise ValueError("The institutional front matter needs review")
        presentation = "Trabalho de Conclusão de Curso apresentado ao "+institution+" como parte dos requisitos para a conclusão do curso de graduação em "+get("curso")+"."
        return "\n\n".join([
            r"\section*{Identificação do trabalho}\label{tcc-identificacao}",
            r"\textbf{Título:} "+self.title,
            r"\textbf{Autor:} "+self.author,
            institution+". "+get("curso")+". "+get("local")+", "+get("data")+".",
            presentation,
            r"\textbf{Orientador:} "+get("orientador"),
            r"\section*{Aprovação}\label{tcc-aprovacao}",
            "Aprovado em: "+get("dataaprovacao"),
            "Banca examinadora:",
            r"\begin{itemize}",
            r"\item "+get("membrob"),
            r"\item "+get("membroc"),
            r"\item "+get("orientadoraprovacao")+". Orientador. "+institution+".",
            r"\end{itemize}",
            r"\section*{Resumo}\label{tcc-resumo}",get("DEELresumo"),
            r"\textbf{Palavras-chave:} "+get("palavraschave"),
            r"\section*{Abstract}\label{tcc-abstract}",get("DEELabstract"),
            r"\textbf{Keywords:} "+get("keywords"),
        ])

    def export(self) -> dict:
        public_pdf = REPO / "public/tcc-pedro-arthur.pdf"
        digest = hashlib.sha256(public_pdf.read_bytes()).hexdigest()
        if digest != hashlib.sha256((self.source / "Main.pdf").read_bytes()).hexdigest():
            raise ValueError("The manuscript PDF does not match the public PDF")
        if digest != self.figures["sourcePdfSha256"]:
            raise ValueError("Figure descriptions belong to a different PDF; review before reusing")
        main = no_comments(self.read("Main.tex"))
        expected_includes = [f"capitulos/{name}" for name in CHAPTERS]
        includes = re.findall(r"\\include\{([^}]+)\}", main)
        if includes != expected_includes:
            raise ValueError("The manuscript chapter sequence changed")
        for empty in ("DEELdedicatoria", "DEELagradecimentos", "DEELepigrafe"):
            if command_arg(main,empty)[0].strip():
                raise ValueError(f"New front matter must be incorporated: {empty}")
        body = "\n\n".join(self.expand(name+".tex") for name in includes)
        body = re.sub(r"\\begin\{figure\}(?:\[[^\]]*\])?([\s\S]*?)\\end\{figure\}", self.replace_figure, body)
        original_keys, references = self.reference_sources()
        if len(self.figure_source) != 4:
            raise ValueError("Expected all four described figures")
        source = self.frontmatter(main)+"\n\n"+body+"\n\n"+references
        source = source.replace(r"\citeonline",r"\citet").replace(r"\protect", "")
        # BibTeX's dotless-i accent spells the same printed glyph as Unicode í.
        # Without this decoding Pandoc emits ı + combining acute, which is a
        # different character sequence for searching and speech engines.
        source = source.replace(r"\'\i", "í")
        source = re.sub(r"\\SingleSpacing\b", "", source)
        ast = json.loads(self.pandoc_run(source,"-f","latex","-t","json"))
        reference_blocks = {}
        blocks = []
        for block in ast["blocks"]:
            if block["t"] == "BlockQuote":
                marker = inline_text(block["c"][0]).strip()
                if marker.startswith("GARDENREFERENCE_"):
                    reference_blocks[marker.removeprefix("GARDENREFERENCE_")] = block["c"][1:]
                    continue
                if marker.startswith("GARDENFIGURE_"):
                    number = int(marker.rsplit("_",1)[1]); pieces = block["c"]
                    description_at = next(i for i,p in enumerate(pieces) if inline_text(p).strip() == "GARDENDESCRIPTION")
                    notes_at = next(i for i,p in enumerate(pieces) if inline_text(p).strip() == "GARDENFIGURENOTES")
                    caption = copy.deepcopy(pieces[1:description_at])
                    caption[0]["c"] = str_inlines(f"Figura {number} – ")+[{"t":"Space"}]+caption[0]["c"]
                    block = {"t":"Figure","c":[[self.figure_source[number-1]["label"],["tcc-figure"],[["data-tcc-figure",str(number)]]],[None,caption],
                        [{"t":"Div","c":[["",["tcc-figure-description"],[]],pieces[description_at+1:notes_at]]},
                         {"t":"Div","c":[["",["tcc-figure-notes"],[]],pieces[notes_at+1:]]}]]}
            blocks.append(block)
        if set(reference_blocks) != set(original_keys):
            raise ValueError("A compiled reference was lost while parsing")
        ast["blocks"] = blocks

        chapter, section, subsection = 0, 0, 0
        label_numbers = {item["label"]:str(item["number"]) for item in self.figure_source}
        label_numbers["quadro:fontes-revisao"] = "1"
        body_headings = []
        for node in walk(ast["blocks"]):
            if node["t"] != "Header":
                continue
            level, attrs, content = node["c"]
            unnumbered = "unnumbered" in attrs[1]
            number = ""
            if not unnumbered:
                if level == 1:
                    chapter += 1; section = subsection = 0; number = str(chapter)
                elif level == 2:
                    section += 1; subsection = 0; number = f"{chapter}.{section}"
                elif level == 3:
                    subsection += 1; number = f"{chapter}.{section}.{subsection}"
                if number:
                    label_numbers[attrs[0]] = number
                    node["c"][2] = str_inlines(number)+[{"t":"Space"}]+content
                body_headings.append(copy.deepcopy(node))
            node["c"][0] = level+1
            if attrs[0] in {"tcc-identificacao","tcc-aprovacao","tcc-resumo","tcc-abstract"}:
                node["c"][0] = 2
        if chapter != 5:
            raise ValueError("Expected all five chapters")

        # Pandoc's LaTeX reader numbers figures by chapter. The PDF uses global
        # figures and a separate Quadro counter, so resolve the original refs.
        for node in walk(ast["blocks"]):
            if node["t"] == "Link":
                attrs, _, target = node["c"]
                info = dict(attrs[2])
                if info.get("reference-type") == "ref":
                    label = info["reference"]
                    if label not in label_numbers:
                        raise ValueError(f"Unresolved manuscript reference: {label}")
                    node["c"] = [["",[],[]],str_inlines(label_numbers[label]),["#"+label,""]]
            elif node["t"] == "Table":
                # The LaTeX reader already places its label on a surrounding Div.
                node["c"][0] = ["",["tcc-source-table"],[]]
                caption_blocks = node["c"][1][1]
                caption_blocks[0]["c"] = str_inlines("Quadro 1 –")+[{"t":"Space"}]+caption_blocks[0]["c"]
                count = 0
                source_rows = []
                for table_body in node["c"][4]:
                    for row in table_body[3]:
                        citations = [item["c"][0][0]["citationId"] for item in walk(row) if item["t"] == "Cite"]
                        if citations:
                            row[0][2].append(["data-source-key",citations[0]]); source_rows.append(row); count += 1
                if count != 11:
                    raise ValueError(f"Expected eleven source rows in the table, got {count}")
                # The LaTeX longtable repeats print-only headers/footers. Keep
                # its eleven complete source rows, and rebuild its two groups.
                table_source = self.read("capitulos/2_fontes_revisao.tex")
                groups = ["Trabalhos acadêmicos","Fontes técnicas, críticas e jornalísticas"]
                footer = "Fonte: elaborado pelo autor a partir das referências indicadas no quadro."
                if any(value not in table_source for value in groups+[footer]):
                    raise ValueError("The source table groups/footer changed")
                def group_row(label):
                    return [["",["tcc-source-group"],[]],[[["",[],[["scope","rowgroup"]]],{"t":"AlignLeft"},1,4,[{"t":"Plain","c":[{"t":"Strong","c":str_inlines(label)}]}]]]]
                node["c"][4] = [[["",[],[]],1,[group_row(groups[0])],source_rows[:5]],[["",[],[]],1,[group_row(groups[1])],source_rows[5:]]]
                node["c"][5] = [["",[],[]],[[["",[],[]],[[["",[],[]],{"t":"AlignLeft"},1,4,[para(footer)]]]]]]

        # Keep the four-column source table scrollable without making the
        # document itself overflow. Keyboard users can focus this region.
        # Materialize the nodes first so walking does not visit its new copy.
        tables = [node for node in walk(ast["blocks"]) if node["t"] == "Table"]
        for node in tables:
            table = copy.deepcopy(node)
            node.clear()
            node.update({"t":"Div","c":[["",["document-table-region"],[["role","region"],["aria-label","Quadro 1 — Fontes da revisão"],["tabindex","0"]]],[table]]})

        # Wrap the original Abstract and its keywords in the correct language.
        start = next(i for i,b in enumerate(ast["blocks"]) if b["t"] == "Header" and b["c"][1][0] == "tcc-abstract")
        end = next(i for i in range(start+1,len(ast["blocks"])) if ast["blocks"][i]["t"] == "Header" and ast["blocks"][i]["c"][0] == 2)
        abstract = ast["blocks"][start:end]
        abstract[0]["c"][1][2].append(["lang","en"])
        ast["blocks"][start:end] = [abstract[0],{"t":"Div","c":[["",["tcc-abstract"],[["lang","en"]]],abstract[1:]]}]
        # Replace the printed list/summary with navigable structures; page
        # numbers belong to the unchanged PDF, so they are not invented here.
        lists = [{"t":"Header","c":[2,["tcc-lista-figuras",[],[]],str_inlines("Lista de figuras")]},
                 {"t":"BulletList","c":[[{"t":"Plain","c":[{"t":"Link","c":[["",[],[]],str_inlines(f"Figura {index+1} – {description['title']}"),["#"+self.figure_source[index]["label"],""]]}]}] for index,description in enumerate(self.figures["figures"])]},
                 {"t":"Header","c":[2,["tcc-sumario",[],[]],str_inlines("Sumário")]}]
        toc, path = [],[]
        for heading in body_headings:
            level,attrs,inlines = heading["c"]
            item = [{"t":"Plain","c":[{"t":"Link","c":[["",[],[]],copy.deepcopy(inlines),["#"+attrs[0],""]]}]}]
            if level == 1:
                toc.append(item); path=[item]
            else:
                parent=path[min(level-2,len(path)-1)]
                if parent[-1]["t"]!="BulletList":parent.append({"t":"BulletList","c":[]})
                parent[-1]["c"].append(item)
                path=path[:level-1]+[item]
        lists.append({"t":"Div","c":[["",["tcc-document-toc"],[["role","navigation"],["aria-label","Sumário do TCC"]]],[{"t":"BulletList","c":toc}]]})
        insertion=next(i for i,block in enumerate(ast["blocks"]) if block["t"]=="Header" and block["c"][1][0]=="chp:intro")
        ast["blocks"][insertion:insertion]=lists
        ast["blocks"] += [{"t":"Header","c":[2,["tcc-referencias",[],[]],str_inlines("Referências bibliográficas")]},{"t":"Div","c":[["refs",[],[]],[]]}]
        ast["meta"] = {"lang":{"t":"MetaString","c":"pt-BR"},"link-citations":{"t":"MetaBool","c":True}}
        temporary = REPO / ".sites-runtime/accessibility-export"
        temporary.mkdir(parents=True,exist_ok=True)
        bibliography = temporary / "references.bib"
        bibliography.write_text(self.read("referenciasbibliograficas.bib").replace("urlaccessdate", "urldate"),encoding="utf-8")
        processed = json.loads(self.pandoc_run(json.dumps(ast,ensure_ascii=False),"-f","json","-t","json","--citeproc","--bibliography",str(bibliography)))
        refs = next(node for node in walk(processed["blocks"]) if node["t"] == "Div" and node["c"][0][0] == "refs")
        generated_keys = {entry["c"][0][0].removeprefix("ref-") for entry in refs["c"][1]}
        if generated_keys != set(original_keys):
            raise ValueError(f"Citation/reference mismatch: {generated_keys ^ set(original_keys)}")
        # Retain the literal rendered bibliography from the compiled manuscript,
        # including access dates, instead of silently reformatting its fields.
        # Pandoc adds role=list to the bibliography container automatically.
        refs["c"][0] = ["refs",["tcc-references"],[["aria-label","Referências bibliográficas"]]]
        refs["c"][1] = [{"t":"Div","c":[["ref-"+key,["tcc-reference-entry"],[["role","listitem"]]],reference_blocks[key]]} for key in original_keys]
        raw = [node for node in walk(processed["blocks"]) if node["t"] in {"RawInline","RawBlock"}]
        if raw:
            raise ValueError(f"Unconverted source markup: {raw[:3]}")
        output = self.pandoc_run(json.dumps(processed,ensure_ascii=False),"-f","json","-t","html5","--wrap=none")
        (temporary / "before-validation.html").write_text(output,encoding="utf-8")
        sanitizer = StaticHtml(); sanitizer.feed(output); sanitizer.close()
        output, headings = sanitizer.result()
        return {"title":self.title,"author":self.author,"sourcePdfSha256":digest,"sourcePages":39,"html":output,"headings":headings,
                "figureCount":len(self.figure_source),"referenceCount":len(original_keys),"sourceFiles":sorted(self.files)}


class StaticHtml(HTMLParser):
    TAGS = set("p h2 h3 h4 h5 h6 div section figure figcaption ol ul li table caption colgroup col thead tbody tfoot tr th td a span strong em br hr sup sub blockquote dl dt dd code cite".split())
    VOID = {"br","hr","col"}
    ATTRS = {"id","class","href","role","lang","tabindex","aria-label","aria-labelledby","aria-describedby","aria-hidden","data-cites","data-source-key","data-tcc-figure","scope","colspan","rowspan","start"}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts, self.ids, self.rendered_ids, self.links, self.headings = [],set(),set(),[],[]
        self.current_heading = None
        self.in_thead, self.in_source_row = False,False
        self.cell_index = 0
        self.stack = []

    @staticmethod
    def prefix(value):
        return value if value.startswith("tcc-") else "tcc-"+value

    def handle_starttag(self, tag, attrs):
        if tag not in self.TAGS:
            raise ValueError(f"Forbidden generated tag: {tag}")
        attributes = dict(attrs)
        if any(name.lower().startswith("on") for name in attributes):
            raise ValueError("Generated event handler")
        if attributes.get("role") == "doc-endnotes":
            attributes["aria-label"] = "Notas do TCC"
        elif attributes.get("role") == "doc-noteref":
            attributes["aria-label"] = "Ler nota "+attributes.get("href", "").removeprefix("#fn")
        elif attributes.get("role") == "doc-backlink":
            attributes["aria-label"] = "Voltar ao trecho da nota "+attributes.get("href", "").removeprefix("#fnref")
        if tag == "thead": self.in_thead = True
        if tag == "tr": self.in_source_row = "data-source-key" in attributes; self.cell_index = 0
        if tag in {"td","th"}:
            if self.in_thead:
                tag = "th"; attributes["scope"] = "col"
            elif self.in_source_row and self.cell_index == 0:
                tag = "th"; attributes["scope"] = "row"
            self.cell_index += 1
        rendered = []
        for name,value in attributes.items():
            if name not in self.ATTRS: continue
            if name == "id":
                if not value or re.search(r"[\s<>\"']",value) or value in self.ids: raise ValueError(f"Duplicate/unsafe id: {value}")
                self.ids.add(value); value = self.prefix(value)
                if value in self.rendered_ids:raise ValueError(f"Duplicate namespaced id: {value}")
                self.rendered_ids.add(value)
            elif name == "href":
                if value.startswith("#"):
                    target = unquote(value[1:]); self.links.append(target); value = "#"+self.prefix(target)
                else:
                    url = urlsplit(value)
                    if url.scheme not in {"http","https","mailto"} or url.username or url.password: raise ValueError(f"Unsafe link: {value}")
            elif name in {"aria-labelledby","aria-describedby"}:
                value = " ".join(self.prefix(part) for part in value.split())
            elif name == "tabindex" and value not in {"0","-1"}:
                raise ValueError(f"Unsafe tabindex: {value}")
            rendered.append(f'{name}="{html.escape(value,quote=True)}"')
        if re.fullmatch("h[2-6]",tag):
            if not attributes.get("id"):raise ValueError("A heading has no anchor")
            self.current_heading = {"id":self.prefix(attributes.get("id","")),"title":"","level":int(tag[1])}
            self.headings.append(self.current_heading)
        # LaTeX grouping around an accent becomes a bare span in Pandoc.
        # Removing that inert wrapper keeps words whole in accessibility APIs.
        emit_tag = not (tag == "span" and not rendered)
        if emit_tag:
            self.parts.append("<"+tag+(" "+" ".join(rendered) if rendered else "")+">")
        # Match rewritten table cell closing tags without changing content.
        if tag not in self.VOID:
            self.stack.append((tag,emit_tag))

    def handle_endtag(self, tag):
        if tag in self.VOID: return
        if not self.stack: raise ValueError("Unbalanced HTML")
        actual,emit_tag = self.stack.pop()
        if actual != tag and {actual,tag} != {"th","td"}: raise ValueError(f"Unbalanced generated tags: {actual}/{tag}")
        if emit_tag:self.parts.append(f"</{actual}>")
        if tag == "thead":self.in_thead=False
        if tag == "tr":self.in_source_row=False
        if re.fullmatch("h[2-6]",tag):self.current_heading=None

    def handle_data(self,data):
        self.parts.append(html.escape(data,quote=False))
        if self.current_heading is not None:self.current_heading["title"]+=data

    def result(self):
        if self.stack:raise ValueError("Unclosed generated HTML")
        missing = set(self.links)-self.ids
        if missing:raise ValueError(f"Dangling generated anchors: {missing}")
        for heading in self.headings:heading["title"]=" ".join(heading["title"].split())
        output = "".join(self.parts)
        if re.search(r"\\(?:cite|ref|begin|end|textit|label)\b",output):raise ValueError("Raw LaTeX in generated HTML")
        return output,self.headings


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source",type=Path,default=DEFAULT_SOURCE)
    parser.add_argument("--pandoc",type=Path)
    args=parser.parse_args()
    if args.pandoc:
        binary=str(args.pandoc.resolve())
    else:
        sys.path.insert(0,str(REPO/".sites-runtime/pandoc"))
        import pypandoc
        binary=pypandoc.get_pandoc_path()
    result=Exporter(args.source,binary).export()
    destination=REPO/"src/lib/tcc-complete.json"
    destination.write_text(json.dumps(result,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(f"Exported {len(result['html'])} HTML characters, {len(result['headings'])} headings, {result['figureCount']} figures and {result['referenceCount']} references.")


if __name__ == "__main__":
    main()
