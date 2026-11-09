import type {Metadata} from 'next';
import DocumentShell from '@/components/document-shell';
import document from '@/lib/tcc-complete.json';
export const metadata:Metadata={title:'TCC completo em HTML — Do código à supervisão',description:'Texto integral da pesquisa de Pedro Arthur Oliveira Januário, com capítulos, tabela, notas, referências e descrições textuais das figuras.'};
export default function CompleteResearch(){
  const chapters=document.headings.filter(heading=>heading.level===2);
  return <DocumentShell>
    <h1>{document.title}</h1><p><strong>{document.author}</strong></p>
    <p className="document-source-note">Versão em HTML do documento acadêmico publicado. As quatro figuras têm representações textuais, e a tabela conserva sua estrutura de leitura. <a href="/tcc-pedro-arthur.pdf">Abrir o PDF original ({document.sourcePages} páginas)</a>.</p>
    <nav className="document-toc" aria-labelledby="document-toc-title"><h2 id="document-toc-title">Neste documento</h2><ul>{chapters.map(heading=><li key={heading.id}><a href={'#'+heading.id}>{heading.title}</a></li>)}</ul></nav>
    <article aria-label="Texto integral do TCC" dangerouslySetInnerHTML={{__html:document.html}}/>
    <footer><p><a href="#document-main">Voltar ao início do documento</a> · <a href="/explorar">Explorar as ilhas em texto</a></p></footer>
  </DocumentShell>;
}
