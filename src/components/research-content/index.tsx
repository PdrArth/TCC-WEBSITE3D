"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type MouseEvent, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowDownToLine,
  ArrowUpRight,
  ChevronDown,
  Search,
} from "lucide-react";
import sources from "@/lib/sources.json";
import {
  pdfPath,
  researchVersion,
  studies,
  timeline,
  workflow,
} from "@/lib/research";
import {
  developerConclusion,
  futureResearch,
  harnessContent,
  pavilionSections,
  researchCounts,
  researchFrame,
  sddContent,
  type NewsState,
} from "@/lib/pavilion-content";
import type { PavilionId } from "@/lib/experience-contract";
import type { PublicUpdate } from "@/lib/update-types";
import type { ActivityProps } from "./activities";
import { editorialSections } from "./editorial-data";
import { readingHref, readingThemeIds, resolveReadingHash, type ReadingDestination } from "@/lib/reading-navigation.mjs";
import "./content.css";

type Source = (typeof sources)[number];
type SourceGroup = Source["group"];

const sourceGroups: { id: SourceGroup; label: string }[] = [
  { id: "academic", label: "Acadêmicas" },
  { id: "technical", label: "Técnicas, críticas e jornalísticas" },
  { id: "complementary", label: "Complementares" },
];

type ReadingSection = ReadingDestination;
const readingNavigation = readingThemeIds.map((id) => ({ id, label: pavilionSections[id].label }));

const readingLocationEvent = "research-reading-location";

function subscribeToReadingLocation(onChange: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("hashchange", onChange);
  window.addEventListener("popstate", onChange);
  window.addEventListener(readingLocationEvent, onChange);
  return () => {
    window.removeEventListener("hashchange", onChange);
    window.removeEventListener("popstate", onChange);
    window.removeEventListener(readingLocationEvent, onChange);
  };
}

function resolveInitialSection(fallback?: string): ReadingSection {
  if (typeof fallback === "string") {
    const value = fallback.trim().replace(/^#/, "");
    if ((readingThemeIds as readonly string[]).includes(value)) return value as PavilionId;
    if (value === "fontes") return "fontes";
    const resolved = resolveReadingHash(value);
    if (resolved) return resolved;
  }
  return "pesquisa";
}

function getReadingSectionFromLocation(fallback?: string): ReadingSection {
  if (typeof window !== "undefined") {
    const section = resolveReadingHash(window.location.hash);
    if (section) return section;
  }
  return resolveInitialSection(fallback);
}

function SourceLink({
  id,
  label = "Consultar fonte",
}: {
  id: string;
  label?: string;
}) {
  const source = sources.find((item) => item.id === id);
  if (!source) return null;

  return (
    <a className="rc-source-link" href={source.url} target="_blank" rel="noreferrer">
      {label}
      <ArrowUpRight size={14} aria-hidden="true" />
    </a>
  );
}

function SectionSources({ ids }: { ids: string[] }) {
  return (
    <details className="rc-section-sources">
      <summary className="rc-source-disclosure-summary">
        <span>Fontes desta síntese</span>
        <span className="rc-source-disclosure-count">
          {ids.length} {ids.length === 1 ? "fonte" : "fontes"}
          <ChevronDown size={17} aria-hidden="true" />
        </span>
      </summary>
      <div className="rc-link-row">
        {ids.map((id) => {
          const source = sources.find((item) => item.id === id);
          return source ? <SourceLink key={id} id={id} label={`${source.author} · ${source.year}`} /> : null;
        })}
      </div>
    </details>
  );
}

function EvidenceContrast() {
  return <div className="rc-evidence-contrast" aria-label="Dois resultados, em contextos diferentes">
    <article>
      <p className="rc-eyebrow">Peng et al. · 2023</p>
      <p className="rc-evidence-number">55,8% <span>menos tempo</span></p>
      <p>Uma tarefa controlada: implementar um servidor HTTP em JavaScript com Copilot.</p>
    </article>
    <article>
      <p className="rc-eyebrow">Becker et al. · 2025</p>
      <p className="rc-evidence-number">19% <span>mais tempo</span></p>
      <p>Desenvolvedores experientes, em tarefas reais de projetos de código aberto maduros.</p>
    </article>
  </div>;
}

function StudyCard({ study }: { study: (typeof studies)[number] }) {
  return (
    <article className="rc-study-card">
      <p className="rc-eyebrow">
        {study.author} · {study.year}
      </p>
      <h4>{study.title}</h4>
      {study.tone !== "neutral" && (
        <p className="rc-study-metric">
          <strong>{study.metric}</strong> {study.label}
        </p>
      )}
      <p>{study.summary}</p>
      <details className="rc-details">
        <summary>
          Contexto, método e limites
          <ChevronDown size={16} aria-hidden="true" />
        </summary>
        <dl>
          <dt>Contexto</dt>
          <dd>{study.context}</dd>
          <dt>Método</dt>
          <dd>{study.method}</dd>
          <dt>O que foi medido</dt>
          <dd>{study.measurement}</dd>
          <dt>Limites da leitura</dt>
          <dd>{study.limit}</dd>
        </dl>
      </details>
      <SourceLink id={study.sourceId} label="Pesquisa original" />
    </article>
  );
}

function ResearchFrame() {
  return (
    <div className="rc-frame-grid">
      <article className="rc-frame-card rc-frame-card--problem">
        <p className="rc-eyebrow">Problema de pesquisa</p>
        <p className="rc-frame-copy">{researchFrame.problem}</p>
      </article>
      <article className="rc-frame-card">
        <p className="rc-eyebrow">Hipótese</p>
        <p>{researchFrame.hypothesis}</p>
      </article>
      <article className="rc-frame-card">
        <p className="rc-eyebrow">Recorte</p>
        <p>{researchFrame.context}</p>
      </article>
    </div>
  );
}

function ThemeStepFlow({ steps, label }: { steps: string[]; label: string }) {
  return (
    <ol className="rc-step-flow" aria-label={label}>
      {steps.map((step, index) => (
        <li key={step}>
          <span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
          <strong>{step}</strong>
        </li>
      ))}
    </ol>
  );
}

function ThemeVisual({ pavilionId }: { pavilionId: PavilionId }) {
  const caption = editorialSections[pavilionId].imageCaption;
  let visual: ReactNode;

  if (pavilionId === "pesquisa") {
    visual = <ThemeStepFlow steps={["Pergunta", "Hipótese", "Evidências e limites"]} label="Estrutura da investigação" />;
  } else if (pavilionId === "gerar") {
    visual = (
      <ol className="rc-mini-timeline" aria-label="Marcos públicos registrados na cronologia">
        {timeline.map((item) => (
          <li key={item.name}>
            <time>{item.date}</time><strong>{item.name}</strong><span>{item.event}</span>
          </li>
        ))}
      </ol>
    );
  } else if (pavilionId === "comparar") {
    visual = <EvidenceContrast />;
  } else if (pavilionId === "validar") {
    visual = <ThemeStepFlow steps={["Contexto", "Critérios", "Testes", "Revisão", "Integração", "Manutenção"]} label="Pontos de verificação da solução" />;
  } else if (pavilionId === "especificar") {
    visual = <ThemeStepFlow steps={["Intenção", "Contexto", "Requisitos", "Implementação", "Verificação"]} label="Etapas orientadas por especificação" />;
  } else if (pavilionId === "evoluir") {
    visual = <ThemeStepFlow steps={["Compreender", "Orientar", "Decidir", "Integrar", "Sustentar"]} label="Responsabilidades ao longo do trabalho de software" />;
  } else {
    visual = (
      <ul className="rc-question-list" aria-label="Dimensões propostas para avaliações futuras">
        {["Tempo até uma entrega aceita", "Qualidade e defeitos", "Manutenção", "Custo", "Carga de supervisão"].map((question) => <li key={question}>{question}</li>)}
      </ul>
    );
  }

  return <figure className={`rc-theme-visual rc-theme-visual--${pavilionId}`}>{visual}<figcaption>{caption}</figcaption></figure>;
}

function SddContent({ compact = false }: { compact?: boolean }) {
  return (
    <article className="rc-concept-card">
      <div>
        <p className="rc-eyebrow">Spec-Driven Development</p>
        <h4>O que deve ser construído?</h4>
      </div>
      <p>{sddContent.summary}</p>
      <p>{sddContent.implication}</p>
      {!compact && <p className="rc-muted">{sddContent.nuance}</p>}
      <article className="rc-conceptual-study">
        <div>
          <p className="rc-eyebrow">Piskala · 2026 · proposta conceitual</p>
          <h4>Da especificação ao contrato</h4>
        </div>
        <p>
          O trabalho propõe a especificação como referência para planejar,
          implementar e verificar software em fluxos com assistentes de IA. Ele
          oferece uma base conceitual para SDD; não é um estudo empírico de
          produtividade.
        </p>
        <SourceLink id="piskala2026sdd" label="Consultar o preprint" />
      </article>
      <div className="rc-link-row">
        <SourceLink id="delimarsky2025speckit" label="Aplicação prática · Spec Kit" />
        {!compact && <SourceLink id="fowler2026fragments" label="Contraponto · Fowler" />}
      </div>
    </article>
  );
}

function HarnessContent({ compact = false }: { compact?: boolean }) {
  return (
    <article className="rc-concept-card">
      <div>
        <p className="rc-eyebrow">Harness Engineering</p>
        <h4>Como verificar o que foi feito?</h4>
      </div>
      <p>{harnessContent.summary}</p>
      <p>{harnessContent.implication}</p>
      {!compact && (
        <p className="rc-muted">
          Böckeler diferencia controles computacionais, como testes e análise estática,
          de revisões inferenciais com IA. O texto apresenta um modelo técnico para
          organizar o trabalho com agentes.
        </p>
      )}
      <SourceLink id="bockeler2026harness" label="Base técnica · Böckeler" />
    </article>
  );
}

function ProductivityEvidence() {
  return (
    <div className="rc-evidence">
      <div className="rc-study-grid">
        {studies.map((study) => (
          <StudyCard key={study.sourceId} study={study} />
        ))}
      </div>
      <p className="rc-editorial-note">
        Os percentuais vêm de tarefas, períodos e grupos diferentes e não são
        diretamente comparáveis. Esta revisão não calcula um efeito médio da IA
        sobre a produtividade.
      </p>
    </div>
  );
}

function ToolChronology() {
  return (
    <div className="rc-chronology">
      {timeline.map((item) => (
        <details className="rc-timeline-item" key={item.name}>
          <summary>
            <span className="rc-timeline-date">{item.date}</span>
            <span className="rc-timeline-name">{item.name}</span>
            <span className="rc-timeline-event">{item.event}</span>
            <ChevronDown size={17} aria-hidden="true" />
          </summary>
          <div className="rc-timeline-body">
            <p className="rc-eyebrow">
              {item.category} · {item.event}
            </p>
            <p>{item.description}</p>
            <p className="rc-muted">{item.note}</p>
            <a className="rc-source-link" href={item.source} target="_blank" rel="noreferrer">
              Ver o anúncio original
              <ArrowUpRight size={14} aria-hidden="true" />
            </a>
          </div>
        </details>
      ))}
      <p className="rc-editorial-note">
        <strong>Nota sobre o Cursor.</strong> O histórico oficial confirma uma
        atualização de edição por instruções em julho de 2023. Ela contextualiza o
        uso de IA no editor, mas não comprova o lançamento inicial. A cronologia
        mantém esse registro como contexto, sem incluí-lo entre os oito marcos.
        <a
          className="rc-source-link"
          href="https://cursor.com/changelog/0-2-39"
          target="_blank"
          rel="noreferrer"
        >
          Consultar o registro original
          <ArrowUpRight size={14} aria-hidden="true" />
        </a>
      </p>
    </div>
  );
}

function ProfessionalWork() {
  return (
    <>
      <div className="rc-work-grid">
        {workflow.map((item, index) => (
          <article className="rc-work-card" key={item.title}>
            <p className="rc-eyebrow">{item.code}</p>
            <h4>
              <span aria-hidden="true">{String(index + 1).padStart(2, "0")} </span>
              {item.title}
            </h4>
            <p>{item.text}</p>
            <p className="rc-muted">{item.detail}</p>
          </article>
        ))}
      </div>
      <div className="rc-link-row rc-supported-by">
        <span>Síntese interpretativa do TCC, contextualizada por:</span>
        <SourceLink id="becker2025impact" label="Becker et al." />
        <SourceLink id="chen2026beyond" label="Chen et al." />
        <SourceLink id="bockeler2026harness" label="Böckeler" />
      </div>
    </>
  );
}

function UpdatesContent({
  updates,
  newsState,
}: {
  updates: PublicUpdate[];
  newsState: NewsState;
}) {
  if (newsState === "loading") {
    return <p className="rc-state" role="status">Carregando atualizações…</p>;
  }
  if (newsState === "error") {
    return (
      <p className="rc-state" role="status">
        As atualizações estão indisponíveis no momento. A pesquisa consolidada e o
        PDF continuam acessíveis.
      </p>
    );
  }
  if (updates.length === 0) {
    return (
      <div className="rc-state">
        <h4>Nenhuma atualização publicada</h4>
        <p>Esta área reúne novidades depois de avaliadas e publicadas pelo autor.</p>
      </div>
    );
  }

  const ordered = [...updates].sort(
    (a, b) => Date.parse(b.publicationDate) - Date.parse(a.publicationDate),
  );
  const date = (value: string) =>
    new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeZone: "UTC" }).format(
      new Date(value),
    );

  return (
    <div className="rc-news-grid">
      {ordered.map((item) => (
        <article className="rc-news-card" key={item.id}>
          <p className="rc-eyebrow">
            {item.type === "research"
              ? "Pesquisa original"
              : item.type === "company_case"
                ? "Estudo empresarial"
                : "Anúncio oficial"}
          </p>
          <h4>{item.title}</h4>
          <p className="rc-news-byline">
            {item.organization} · <time dateTime={item.publicationDate}>{date(item.publicationDate)}</time>
          </p>
          <p>{item.summary}</p>
          <details className="rc-details">
            <summary>
              Relação com o TCC e limites
              <ChevronDown size={16} aria-hidden="true" />
            </summary>
            <p>{item.relevance}</p>
            <p>{item.limitations}</p>
            {item.eventDate && <p>Acontecimento: {date(item.eventDate)}</p>}
          </details>
          <a className="rc-source-link" href={item.sourceUrl} target="_blank" rel="noreferrer">
            Consultar fonte
            <ArrowUpRight size={14} aria-hidden="true" />
          </a>
          <p className="rc-muted rc-checked-date">Fonte verificada em {date(item.checkedDate)}</p>
        </article>
      ))}
    </div>
  );
}

function FutureResearch() {
  return (
    <div className="rc-future-grid">
      {futureResearch.map((item) => (
        <article className="rc-future-card" key={item.sourceId}>
          <p className="rc-eyebrow">Possibilidade de investigação futura</p>
          <h4>{item.title}</h4>
          <p>{item.description}</p>
          <SourceLink id={item.sourceId} label="Documento contextual" />
        </article>
      ))}
    </div>
  );
}

function SourceLibrary() {
  const [group, setGroup] = useState<SourceGroup>("academic");
  const [query, setQuery] = useState("");
  const visibleSources = useMemo(() => {
    const normalizedQuery = normalize(query);
    return sources
      .map((source, index) => ({ source, index }))
      .filter(({ source }) => source.group === group)
      .filter(({ source }) =>
        normalize(`${source.title} ${source.author} ${source.year} ${source.contribution} ${source.nature}`).includes(
          normalizedQuery,
        ),
      )
      .sort((a, b) => yearNumber(a.source.year) - yearNumber(b.source.year) || a.index - b.index)
      .map(({ source }) => source);
  }, [group, query]);

  return (
    <div className="rc-library">
      <div className="rc-library-toolbar">
        <div className="rc-source-groups" role="group" aria-label="Filtrar fontes por grupo">
          {sourceGroups.map((item) => {
            const count = sources.filter((source) => source.group === item.id).length;
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={group === item.id}
                onClick={() => setGroup(item.id)}
              >
                {item.label}<span>{count}</span>
              </button>
            );
          })}
        </div>
        <label className="rc-library-search">
          <Search size={17} aria-hidden="true" />
          <span className="rc-visually-hidden">Buscar por título, autoria, ano ou contribuição</span>
          <input
            type="search"
            value={query}
            placeholder="Buscar nas fontes"
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      </div>
      <p className="rc-source-count" role="status">
        {visibleSources.length} {visibleSources.length === 1 ? "publicação" : "publicações"} neste grupo
      </p>
      <div className="rc-source-list">
        {visibleSources.map((source) => (
          <details className="rc-source-entry" key={source.id}>
            <summary>
              <span className="rc-source-year">{source.year}</span>
              <span className="rc-source-title">
                <strong>{source.title}</strong>
                <small>{source.author}</small>
              </span>
              <ChevronDown size={16} aria-hidden="true" />
            </summary>
            <div className="rc-source-body">
              <p className="rc-eyebrow">{source.nature}</p>
              <p>{source.contribution}</p>
              <a className="rc-source-link" href={source.url} target="_blank" rel="noreferrer">
                Consultar publicação original
                <ArrowUpRight size={14} aria-hidden="true" />
              </a>
            </div>
          </details>
        ))}
      </div>
      {visibleSources.length === 0 && (
        <p className="rc-empty-search">
          Nenhuma fonte corresponde à busca neste grupo. Tente outro termo ou selecione
          outro grupo.
        </p>
      )}
    </div>
  );
}

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
}

function yearNumber(value: string) {
  const year = value.match(/\d{4}/)?.[0];
  return year ? Number(year) : Number.POSITIVE_INFINITY;
}

function MethodAndLibrary() {
  return (
    <>
      <div className="rc-method-grid">
        <article className="rc-method-card">
          <p className="rc-eyebrow">Método</p>
          <h3>Revisão narrativa da literatura</h3>
          <p>{researchFrame.methodology}</p>
          <details className="rc-details">
            <summary>
              Delimitações e limitações
              <ChevronDown size={16} aria-hidden="true" />
            </summary>
            <p>
              Não houve experimento, entrevista ou questionário próprio. Estudos
              publicados que utilizam esses métodos fazem parte da revisão, mas seus
              participantes não são dados coletados por este TCC.
            </p>
            <p>
              Não há registro completo das expressões, datas de busca, quantidade
              inicialmente localizada ou fluxo de exclusões. O trabalho declara essas
              lacunas e não se apresenta como revisão sistemática ou exaustiva.
            </p>
            <p>
              arXiv, GitHub Blog, Martin Fowler, Technology Radar e UOL Tilt são meios
              de acesso às publicações identificadas, não uma lista retrospectiva de
              bases de dados pesquisadas.
            </p>
          </details>
        </article>
        <article className="rc-method-card rc-method-card--pdf">
          <p className="rc-eyebrow">Trabalho completo</p>
          <h3>Leia o TCC</h3>
          <p>
            Pedro Arthur Oliveira Januário<br />
            Engenharia da Computação · Univiçosa
          </p>
          <p className="rc-muted">
            Versão revisada em {researchVersion}. Aprovação em 03/09/2026.
          </p>
          <div className="rc-link-row">
            <a className="rc-primary-link" href={pdfPath} download>
              Baixar PDF <ArrowDownToLine size={16} aria-hidden="true" />
            </a>
            <a className="rc-source-link" href={pdfPath} target="_blank" rel="noreferrer">
              Abrir PDF <ArrowUpRight size={14} aria-hidden="true" />
            </a>
          </div>
        </article>
      </div>
      <div className="rc-library-heading">
        <div>
          <p className="rc-eyebrow">Biblioteca da revisão</p>
          <h3>As 24 referências citadas</h3>
        </div>
        <p>
          {researchCounts.central} fontes centrais: {researchCounts.academic} acadêmicas e {researchCounts.technical} técnicas, críticas e jornalísticas. Mais {researchCounts.complementary} documentos complementares.
        </p>
      </div>
      <SourceLibrary />
      <p className="rc-editorial-note">
        Quatro das cinco fontes acadêmicas são empíricas; uma é conceitual. Essa
        classificação não implica revisão por pares para todos os trabalhos. Anúncios
        de produtos são documentos contextuais, não resultados científicos.
      </p>
    </>
  );
}

function PanelChronology() {
  return <section className="rc-panel-chronology" aria-labelledby="panel-chronology-title">
    <h4 id="panel-chronology-title">Oito marcos públicos</h4>
    <p className="rc-panel-context">Eventos de naturezas diferentes, em ordem temporal e sem escala proporcional.</p>
    <ol className="rc-panel-timeline">
      {timeline.map(item => <li key={item.name}>
        <time>{item.date}</time>
        <div>
          <h5>{item.name}</h5>
          <p className="rc-panel-event">{item.event}</p>
          <p>{item.description}</p>
          <p className="rc-panel-note">{item.note}</p>
          <a className="rc-source-link" href={item.source} target="_blank" rel="noreferrer">Anúncio original<ArrowUpRight size={16} aria-hidden="true" /></a>
        </div>
      </li>)}
    </ol>
    <p className="rc-panel-note rc-panel-cursor">O Cursor permanece como contexto de uma atualização de edição por instruções em julho de 2023; esse registro não comprova seu lançamento inicial. <a href="https://cursor.com/changelog/0-2-39" target="_blank" rel="noreferrer">Consultar o registro original<ArrowUpRight size={15} aria-hidden="true" /></a></p>
  </section>;
}

export const PavilionContent = memo(function PavilionContent({ pavilionId, updates, newsState, onInteract }: {
  pavilionId: PavilionId;
  updates: PublicUpdate[];
  newsState: NewsState;
} & ActivityProps) {
  const section = editorialSections[pavilionId];
  return <div className="research-content rc-pavilion-content rc-island-summary" data-pavilion={pavilionId} data-summary-layout="v14" onClickCapture={(event) => {
    if (event.target instanceof Element && event.target.closest("summary, a, button")) onInteract?.();
  }}>
    <article className="rc-pavilion-essay">
      <header className="rc-summary-heading">
        <h3>{section.title}</h3>
        <p className="rc-summary-lead">{section.lead}</p>
      </header>
      <figure className="rc-panel-hero">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={pavilionId === "gerar" ? "/experience/editorial/cards-v13/gerar.webp" : `/experience/editorial/v9/${pavilionId}.webp`} alt={`Ilustração conceitual da ilha ${pavilionSections[pavilionId].label}; não representa evidência dos estudos.`} width={1200} height={780} decoding="async" />
        <figcaption>Ilustração conceitual · {pavilionSections[pavilionId].label}</figcaption>
      </figure>
      <div className="rc-panel-prose">
        {section.paragraphs.map(paragraph => <section className="rc-panel-paragraph" key={paragraph.heading}>
          <h4>{paragraph.heading}</h4>
          <p>{paragraph.text}</p>
        </section>)}
      </div>
      {pavilionId === "gerar" ? <PanelChronology /> : <ThemeVisual pavilionId={pavilionId} />}
      {pavilionId === "perspectivas" && <UpdatesContent updates={updates} newsState={newsState} />}
      <SectionSources ids={section.sourceIds} />
    </article>
  </div>;
});

function ReadingThemeBody({ pavilionId, updates, newsState }: {
  pavilionId: PavilionId;
  updates: PublicUpdate[];
  newsState: NewsState;
}) {
  if (pavilionId === "pesquisa") {
    return <>
      <ResearchFrame />
      <p className="rc-editorial-note">{researchFrame.methodology}</p>
      <p>{researchCounts.central} fontes centrais ({researchCounts.academic} acadêmicas e {researchCounts.technical} técnicas, críticas e jornalísticas) sustentam a análise. Outras {researchCounts.complementary} fontes documentais contextualizam ferramentas e perguntas futuras.</p>
    </>;
  }
  if (pavilionId === "gerar") {
    return <>
      <h3>O que os anúncios permitem afirmar</h3>
      <p>Os registros documentam datas, versões e capacidades anunciadas. Não são experimentos comparativos de produtividade ou qualidade; recursos descritos em documentação atual não devem ser atribuídos automaticamente a versões anteriores.</p>
      <ToolChronology />
      <p className="rc-editorial-note">O Cursor aparece como atualização de edição por instruções, sem que o registro consultado confirme seu lançamento inicial. As documentações de <SourceLink id="opencodeDocs" label="OpenCode" /> e <SourceLink id="augmentDocs" label="Augment Code" /> complementam a descrição funcional atual.</p>
    </>;
  }
  if (pavilionId === "comparar") {
    return <>
      <ProductivityEvidence />
      <p className="rc-editorial-note">Métricas de atividade e relatos de percepção respondem a perguntas distintas e precisam ser interpretados em seu próprio contexto.</p>
    </>;
  }
  if (pavilionId === "validar") {
    return <>
      <HarnessContent />
      <h3>Critérios para aceitar uma proposta</h3>
      <p>Verificar conformidade com uma especificação não garante que ela represente corretamente a necessidade. Na interpretação do TCC, a revisão humana examina requisitos, pressupostos, dependências e consequências da integração.</p>
      <p className="rc-editorial-note">Os estudos de produtividade desta revisão não oferecem uma medida única da qualidade em produção nem quantificam um efeito universal dos mecanismos de Harness Engineering. Testes, análise estática e revisão apoiam a verificação; não substituem a avaliação técnica do contexto.</p>
    </>;
  }
  if (pavilionId === "especificar") {
    return <>
      <SddContent />
      <p>A especificação oferece critérios para examinar a implementação, mas depende de objetivos adequados e contexto suficiente. A compreensão do problema pode mudar durante o desenvolvimento; por isso, o TCC trata SDD como abordagem emergente e revisável.</p>
    </>;
  }
  if (pavilionId === "evoluir") {
    return <>
      <p className="rc-editorial-note">O ciclo abaixo é uma síntese interpretativa do TCC, não um protocolo experimental nem uma sequência obrigatória.</p>
      <ProfessionalWork />
      <article className="rc-conclusion-card">
        <p className="rc-eyebrow">Interpretação do TCC</p>
        <h3>{developerConclusion.title}</h3>
        {developerConclusion.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
      </article>
      <p>A coluna de Gomes e Cortiz contextualiza expectativas sobre equipes, salários e perfil profissional no Brasil. Ela não permite estimar causalmente efeitos da IA sobre emprego, remuneração ou tamanho das equipes.</p>
      <SourceLink id="gomescortiz2026tilt" label="Contexto de mercado · UOL Tilt" />
    </>;
  }
  return <>
    <article className="rc-conclusion-card">
      <p className="rc-eyebrow">Síntese interpretativa do TCC</p>
      <h3>{developerConclusion.title}</h3>
      {developerConclusion.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
    </article>
    <h3 className="rc-subsection-title">Perguntas para trabalhos futuros</h3>
    <p>Tempo total até uma entrega aceita, qualidade, defeitos, manutenção, custo e carga de supervisão são dimensões a investigar em contextos diversos. Cobalt e Flightdeck são documentos de fornecedores, não resultados independentes.</p>
    <FutureResearch />
    <h3 className="rc-subsection-title">Atualizações avaliadas pelo autor</h3>
    <p>As novidades publicadas preservam fonte, datas e limitações. Elas podem atualizar o contexto sem alterar automaticamente as conclusões da revisão consolidada.</p>
    <UpdatesContent updates={updates} newsState={newsState} />
  </>;
}

function ReadingChapterNavigation({
  activeSection,
  onNavigate,
}: {
  activeSection: ReadingSection;
  onNavigate: (event: MouseEvent<HTMLAnchorElement>, section: ReadingSection) => void;
}) {
  const currentIndex = activeSection === "fontes" ? -1 : readingThemeIds.indexOf(activeSection);
  const previous = currentIndex > 0 ? readingThemeIds[currentIndex - 1] : null;
  const next = currentIndex >= 0 && currentIndex < readingThemeIds.length - 1 ? readingThemeIds[currentIndex + 1] : null;
  const destination = activeSection === "fontes" ? "pesquisa" : previous;

  return (
    <nav className="rc-chapter-navigation" aria-label="Avançar ou voltar no caderno">
      {destination ? (
        <a data-direction="previous" href={readingHref(destination)} onClick={(event) => onNavigate(event, destination)}>
          <ArrowLeft size={18} aria-hidden="true" />
          <span><small>{activeSection === "fontes" ? "Voltar ao caderno" : "Tema anterior"}</small>{pavilionSections[destination].label}</span>
        </a>
      ) : <span aria-hidden="true" />}
      {next ? (
        <a data-direction="next" href={readingHref(next)} onClick={(event) => onNavigate(event, next)}>
          <span><small>Tema {currentIndex + 2} de 7</small>{pavilionSections[next].label}</span>
          <ArrowUpRight size={18} aria-hidden="true" />
        </a>
      ) : currentIndex === readingThemeIds.length - 1 ? (
        <a data-direction="next" href={readingHref("fontes")} onClick={(event) => onNavigate(event, "fontes")}>
          <span><small>Encerrar a leitura</small>Método e fontes</span>
          <ArrowUpRight size={18} aria-hidden="true" />
        </a>
      ) : <span aria-hidden="true" />}
    </nav>
  );
}

function readSavedPosition(section: ReadingSection) {
  try {
    const value = Number(window.sessionStorage.getItem(`tcc-reading-scroll-v8:${section}`));
    return Number.isFinite(value) && value >= 0 ? value : 0;
  } catch {
    return 0;
  }
}

function saveReadingPosition(section: ReadingSection, position: number) {
  try {
    window.sessionStorage.setItem(`tcc-reading-scroll-v8:${section}`, String(Math.max(0, Math.round(position))));
  } catch {
    // Storage can be disabled; navigation remains usable without scroll restoration.
  }
}

function getReaderPosition(root: HTMLElement | null) {
  const scroller = root?.closest<HTMLElement>(".island-reading");
  return scroller ? scroller.scrollTop : window.scrollY;
}

function restoreReaderPosition(root: HTMLElement | null, position: number) {
  const scroller = root?.closest<HTMLElement>(".island-reading");
  if (scroller) scroller.scrollTo({ top: position, behavior: "auto" });
  else window.scrollTo({ top: position, behavior: "auto" });
}

export function ResearchReading({ updates, newsState, initialSection, onThemeChange }: {
  updates: PublicUpdate[];
  newsState: NewsState;
  initialSection?: string;
  onThemeChange?: (id: ReadingSection) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const onThemeChangeRef = useRef(onThemeChange);
  const leavingPositionRef = useRef<{ section: ReadingSection; position: number } | null>(null);
  const subscribeLocation = useCallback((onChange: () => void) => subscribeToReadingLocation(() => {
    const node = rootRef.current;
    const previous = node?.dataset.readingSection as ReadingSection | undefined;
    const destination = getReadingSectionFromLocation();
    if (previous && previous !== destination) {
      const position = getReaderPosition(node);
      leavingPositionRef.current = { section: previous, position };
      saveReadingPosition(previous, position);
    }
    onChange();
  }), []);
  const activeSection = useSyncExternalStore(
    subscribeLocation,
    () => getReadingSectionFromLocation(initialSection),
    () => resolveInitialSection(initialSection),
  );

  useEffect(() => { onThemeChangeRef.current = onThemeChange; }, [onThemeChange]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      restoreReaderPosition(rootRef.current, readSavedPosition(activeSection));
      const heading = rootRef.current?.querySelector<HTMLElement>("#rc-current-theme-title");
      if (heading) {
        heading.tabIndex = -1;
        heading.focus({ preventScroll: true });
      }
    });
    onThemeChangeRef.current?.(activeSection);
    return () => window.cancelAnimationFrame(frame);
  }, [activeSection]);

  useEffect(() => {
    const root = rootRef.current;
    const scroller = root?.closest<HTMLElement>(".island-reading");
    const scrollTarget: HTMLElement | Window = scroller ?? window;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let lastPosition = readSavedPosition(activeSection);
    if (leavingPositionRef.current?.section !== activeSection) leavingPositionRef.current = null;
    const save = () => saveReadingPosition(activeSection, leavingPositionRef.current?.section === activeSection ? leavingPositionRef.current.position : lastPosition);
    const handleScroll = () => {
      if (leavingPositionRef.current?.section === activeSection) return;
      lastPosition = getReaderPosition(root ?? null);
      if (timer) clearTimeout(timer);
      timer = setTimeout(save, 100);
    };
    scrollTarget.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      scrollTarget.removeEventListener("scroll", handleScroll);
      if (timer) clearTimeout(timer);
      // The next chapter may already have clamped scrollTop in this cleanup.
      // Persist the position observed in this chapter, before that DOM change.
      save();
    };
  }, [activeSection]);

  const selectSection = (section: ReadingSection) => {
    if (section === activeSection) {
      leavingPositionRef.current = null;
      saveReadingPosition(section, 0);
      restoreReaderPosition(rootRef.current, 0);
      rootRef.current?.querySelector<HTMLElement>("#rc-current-theme-title")?.focus({ preventScroll: true });
      return;
    }
    const position = getReaderPosition(rootRef.current);
    leavingPositionRef.current = { section: activeSection, position };
    saveReadingPosition(activeSection, position);
    // A deliberate chapter selection starts at its heading. Browser history
    // can still restore a position saved while leaving that chapter.
    saveReadingPosition(section, 0);
    const hash = readingHref(section);
    if (window.location.hash !== hash) {
      window.history.pushState(window.history.state, "", `${window.location.pathname}${window.location.search}${hash}`);
    }
    window.dispatchEvent(new Event(readingLocationEvent));
  };

  const handleSectionLink = (event: MouseEvent<HTMLAnchorElement>, section: ReadingSection) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault(); event.stopPropagation(); selectSection(section);
  };

  const activeThemeIndex = activeSection === "fontes" ? -1 : readingThemeIds.indexOf(activeSection);
  const currentLabel = activeSection === "fontes" ? "Método e fontes" : pavilionSections[activeSection].label;

  return (
    <div ref={rootRef} className="research-content rc-reading" data-reading-section={activeSection}>
      <header className="rc-reading-header">
        <label className="garden-chapter-select">Tema do caderno<select value={activeSection} onChange={event => selectSection(event.target.value as ReadingSection)}>{readingNavigation.map((item, index) => <option value={item.id} key={item.id}>{index + 1}. {item.label}</option>)}<option value="fontes">Método e fontes</option></select></label>
        <nav className="rc-reading-nav" aria-label="Temas do caderno">
          {readingNavigation.map((item, index) => (
            <a
              key={item.id}
              href={readingHref(item.id)}
              aria-current={activeSection === item.id ? "step" : undefined}
              onClick={(event) => handleSectionLink(event, item.id)}
            >
              <span aria-hidden="true">{index + 1}</span>{item.label}
            </a>
          ))}
          <a
            className="rc-nav-library"
            href={readingHref("fontes")}
            aria-current={activeSection === "fontes" ? "page" : undefined}
            onClick={(event) => handleSectionLink(event, "fontes")}
          >Método e fontes</a>
        </nav>
      </header>

      {activeSection === "fontes" ? (
        <article className="rc-essay rc-reading-section rc-reading-library" aria-labelledby="rc-current-theme-title">
          <p className="rc-eyebrow">Acervo · transparência da revisão</p>
          <h2 id="rc-current-theme-title">Como a revisão foi construída.</h2>
          <p className="rc-reading-deck">Método, limites e publicações que sustentam a pesquisa.</p>
          <p>O trabalho compara publicações considerando contexto, método, tarefas e perfil dos participantes, métricas, achados e limitações. Pesquisa empírica, proposta conceitual, análise técnica, documento de produto e contexto jornalístico cumprem funções diferentes na argumentação.</p>
          <MethodAndLibrary />
          <ReadingChapterNavigation activeSection={activeSection} onNavigate={handleSectionLink} />
        </article>
      ) : (
        <article className="rc-essay rc-reading-section" aria-labelledby="rc-current-theme-title" key={activeSection}>
          <header className="rc-theme-heading">
            <p className="rc-eyebrow rc-chapter-badge">
              <span>Tema {activeThemeIndex + 1} de 7</span>{currentLabel}
            </p>
            <h2 id="rc-current-theme-title">{editorialSections[activeSection].title}</h2>
            <p className="rc-reading-deck">{editorialSections[activeSection].lead}</p>
          </header>
          <figure className="rc-theme-scene">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/experience/editorial/v9/${activeSection}.webp`} alt={`Maquete da ilha ${activeThemeIndex + 1}: ${currentLabel}`} width={1200} height={780} loading="lazy" />
            <figcaption><span>Ilustração editorial · modelagem própria</span>{editorialSections[activeSection].imageCaption}<small>Imagem de apoio conceitual; não representa evidência dos estudos.</small></figcaption>
          </figure>
          <ThemeVisual pavilionId={activeSection} />
          <div className="rc-theme-copy">
            {editorialSections[activeSection].paragraphs.map((paragraph) => (
              <div className="rc-pavilion-paragraph" key={paragraph.heading}>
                <h3>{paragraph.heading}</h3><p>{paragraph.text}</p>
              </div>
            ))}
            <ReadingThemeBody pavilionId={activeSection} updates={updates} newsState={newsState} />
            <SectionSources ids={editorialSections[activeSection].sourceIds} />
            <ReadingChapterNavigation activeSection={activeSection} onNavigate={handleSectionLink} />
          </div>
        </article>
      )}
    </div>
  );
}
