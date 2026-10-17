import type { PavilionId } from "./experience-contract";
import sources from "./sources.json";

export type NewsState = "loading" | "ready" | "error";

export const researchFrame = {
  problem:
    "Como a adoção de inteligências artificiais generativas está transformando o desenvolvimento de software e o papel do desenvolvedor, considerando ganhos de produtividade, limitações e mudanças no mercado?",
  hypothesis:
    "As inteligências artificiais generativas aumentam a produtividade em diversas tarefas, mas não substituem o desenvolvedor. Elas deslocam parte do trabalho para especificação, supervisão, validação, revisão, arquitetura e decisão técnica. Nesse cenário, Spec-Driven Development ajuda a explicar por que a especificação ganha centralidade em fluxos orientados por IA.",
  context:
    "O TCC examina produtividade percebida e medida, limitações e retrabalho, mudanças no processo de desenvolvimento e a prática profissional. Spec-Driven Development aprofunda a discussão sobre especificação; Harness Engineering ajuda a explicar os mecanismos de orientação, verificação e feedback ao redor dos agentes.",
  methodology:
    "Revisão narrativa da literatura com apoio documental e análise qualitativa. A comparação considera contexto, método, tarefas e perfil dos participantes, métricas, achados e limitações. As publicações não são tratadas como evidência equivalente.",
} as const;

export const sddContent = {
  summary:
    "A especificação explicita objetivos, restrições e critérios de aceitação. Ela orienta a implementação e oferece uma referência para verificar o resultado.",
  implication:
    "Essa organização dá mais peso ao contexto e à capacidade do desenvolvedor de formular o problema.",
  nuance:
    "Especificações também evoluem. Aprendizagem durante a implementação e ciclos de feedback evitam tratar o processo como uma sequência rígida.",
} as const;

export const harnessContent = {
  summary:
    "Guias, testes, análise estática, revisão e feedback formam um ambiente de orientação e controle ao redor do agente de programação.",
  implication:
    "São propostas de processo. Sua eficácia precisa ser avaliada no contexto em que serão usadas.",
} as const;

export const developerConclusion = {
  title: "A responsabilidade técnica continua com o desenvolvedor",
  paragraphs: [
    "A síntese do TCC é que os ganhos de produtividade existem em determinados cenários, mas não são universais. O efeito depende da tarefa, da experiência e da forma de medir.",
    "A transformação amplia o peso da base técnica e da especificação, além de exigir atenção à qualidade, à segurança, ao custo e ao esforço de supervisão.",
    "O desenvolvedor continua essencial para compreender o problema, orientar a solução, verificar o que foi produzido e responder pela integração e manutenção do software.",
  ],
} as const;

export const futureResearch = [
  {
    sourceId: "cobalt2026introducing",
    title: "Tempo, qualidade, custo e supervisão",
    description:
      "O anúncio do Cobalt apresenta um ambiente de tarefas em computador na nuvem, com execução e retorno para revisão. O TCC o registra como possível objeto de investigação futura dessas dimensões, não como evidência de desempenho.",
  },
  {
    sourceId: "codemote2026flightdeck",
    title: "Carga de supervisão e coordenação",
    description:
      "A apresentação do Flightdeck descreve o acompanhamento de terminais, conversas e estados de agentes. Esse tipo de ambiente pode orientar estudos futuros sobre supervisão e coordenação, sem comprovar seus efeitos.",
  },
] as const;

const byGroup = (group: string) => sources.filter((source) => source.group === group);

export const researchCounts = {
  academic: byGroup("academic").length,
  technical: byGroup("technical").length,
  complementary: byGroup("complementary").length,
  central: byGroup("academic").length + byGroup("technical").length,
  total: sources.length,
} as const;

export const pavilionSections: Record<PavilionId, { label: string; description: string }> = {
  pesquisa: {
    label: "A pesquisa",
    description:
      "A pergunta, a hipótese e o método delimitam o que a revisão pode discutir.",
  },
  gerar: {
    label: "Ferramentas",
    description:
      "A cronologia documenta como as ferramentas ampliaram as formas de sugerir, editar e delegar tarefas.",
  },
  comparar: {
    label: "Produtividade",
    description:
      "Estudos com tarefas, participantes e métricas diferentes mostram por que produtividade exige comparação contextual.",
  },
  validar: {
    label: "Validação",
    description:
      "Revisão, critérios de qualidade e Harness Engineering ajudam a examinar o trabalho de agentes de código.",
  },
  especificar: {
    label: "Especificação",
    description:
      "SDD organiza contexto, requisitos e critérios para orientar a implementação e verificar a solução.",
  },
  evoluir: {
    label: "Profissão",
    description:
      "A entrega continua depois da geração: compreender, revisar, integrar e manter também fazem parte do trabalho do desenvolvedor.",
  },
  perspectivas: {
    label: "Perspectivas",
    description:
      "Conclusões, possibilidades de pesquisa futura e atualizações avaliadas pelo autor.",
  },
};
