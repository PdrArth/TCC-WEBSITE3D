import type { PavilionId } from "@/lib/experience-contract";

type EditorialParagraph = {
  heading: string;
  text: string;
};

export type EditorialSection = {
  number: string;
  title: string;
  lead: string;
  paragraphs: EditorialParagraph[];
  imageCaption: string;
  sourceIds: string[];
  readingAnchor: PavilionId;
};

/** Sínteses editoriais derivadas do TCC revisado e conferidas com SOURCES.md. */
export const editorialSections: Record<PavilionId, EditorialSection> = {
  pesquisa: {
    number: "01/07",
    title: "A pergunta define o que precisa ser observado.",
    lead: "A revisão investiga como a IA generativa altera a produtividade e o trabalho de desenvolvimento, sem presumir que todos os usos produzam o mesmo efeito.",
    paragraphs: [
      {
        heading: "Problema e hipótese",
        text: "O TCC pergunta como a adoção de IA generativa transforma o desenvolvimento de software e o papel do desenvolvedor, considerando produtividade, limitações e mudanças no mercado. A hipótese admite ganhos em algumas tarefas e propõe que parte do trabalho se desloca para especificação, supervisão, validação, revisão, arquitetura e decisão técnica.",
      },
      {
        heading: "Recorte metodológico",
        text: "O estudo é uma revisão narrativa da literatura com apoio documental e análise qualitativa. Compara contexto, método, tarefas, perfil dos participantes, métricas, achados e limitações; não coleta dados próprios por entrevistas, questionários ou experimento. Estudos publicados que usam esses métodos continuam podendo integrar a revisão.",
      },
      {
        heading: "Dois grupos de fontes",
        text: "A bibliografia reúne 11 fontes centrais: cinco acadêmicas — quatro empíricas e uma conceitual — e seis técnicas, críticas ou jornalísticas. Outras 13 fontes documentais complementam a cronologia de ferramentas e as possibilidades de trabalhos futuros; anúncios de produtos não são tratados como evidência empírica de produtividade.",
      },
    ],
    imageCaption: "A pesquisa começa pela pergunta, explicita a hipótese e delimita o que as fontes permitem concluir.",
    sourceIds: ["peng2023impact", "vasilescu2025copilot", "piskala2026sdd"],
    readingAnchor: "pesquisa",
  },
  gerar: {
    number: "02/07",
    title: "Ferramentas ampliam o que pode ser delegado.",
    lead: "Sugestão no editor, edição, execução e delegação passaram a coexistir em diferentes ambientes de desenvolvimento.",
    paragraphs: [
      {
        heading: "Uma cronologia de eventos distintos",
        text: "A revisão registra oito marcos públicos entre 2022 e 2025, desde a disponibilidade geral do GitHub Copilot até a prévia pública do Antigravity. Cada data conserva a natureza anunciada pela fonte: disponibilidade geral, lançamento comercial, liberação de uma versão reescrita ou prévia pública.",
      },
      {
        heading: "Formas de assistência que coexistem",
        text: "As ferramentas passaram a reunir sugestões, edição por instruções, leitura do repositório, execução de tarefas e acompanhamento de agentes. A cronologia documenta essa ampliação, mas não descreve uma substituição completa de uma forma de assistência por outra.",
      },
      {
        heading: "Anúncios contextualizam; estudos medem",
        text: "Publicações oficiais ajudam a identificar datas e capacidades anunciadas. Elas não comparam produtividade ou qualidade de maneira independente; essa avaliação depende das pesquisas e de seus contextos, métricas e limites.",
      },
    ],
    imageCaption: "A cronologia distingue eventos públicos e mostra a convivência entre sugestão, edição e delegação.",
    sourceIds: ["dohmke2022copilot", "anthropic2025claudecodega", "openai2025codexga", "google2025antigravity"],
    readingAnchor: "gerar",
  },
  comparar: {
    number: "03/07",
    title: "Produtividade não cabe em um único percentual.",
    lead: "Os resultados variam conforme a tarefa, a experiência dos participantes, o sistema estudado e a métrica escolhida.",
    paragraphs: [
      {
        heading: "Ganhos em uma tarefa delimitada",
        text: "Peng et al. (2023) observaram que participantes com Copilot concluíram 55,8% mais rápido uma tarefa controlada de implementação de servidor HTTP em JavaScript. O resultado sustenta aceleração naquele experimento; não estima o efeito da IA em todo o ciclo de desenvolvimento.",
      },
      {
        heading: "Um resultado em outra direção",
        text: "Becker et al. (2025) encontraram 19% mais tempo de execução entre desenvolvedores experientes que trabalhavam em projetos de código aberto maduros. Participantes, tarefas, ferramentas e período diferem do experimento de Peng; os percentuais não são medidas diretamente comparáveis e não devem ser somados ou convertidos em média.",
      },
      {
        heading: "Atividade e percepção respondem a outras perguntas",
        text: "Stray et al. (2026) não identificaram mudança estatisticamente significativa nas métricas de commits após a adoção do Copilot; os usuários já eram mais ativos antes. Chen et al. (2026) discutem dimensões relatadas por desenvolvedores em questionário e entrevistas. Commits não representam todo o trabalho, e percepção não equivale a uma estimativa causal de desempenho.",
      },
    ],
    imageCaption: "Resultados diferentes precisam ser lidos junto de suas tarefas, participantes e métricas.",
    sourceIds: ["peng2023impact", "becker2025impact", "vasilescu2025copilot", "chen2026beyond"],
    readingAnchor: "comparar",
  },
  validar: {
    number: "04/07",
    title: "Aceitar uma proposta exige verificar o que ela resolve.",
    lead: "Código produzido é uma etapa da entrega; sua adequação precisa ser examinada no contexto do sistema e dos requisitos.",
    paragraphs: [
      {
        heading: "Qualidade inclui contexto e integração",
        text: "Uma proposta pode parecer correta isoladamente e ainda contrariar requisitos, convenções, dependências ou decisões de arquitetura. A revisão precisa perguntar se ela resolve o problema, se pode ser testada e se continua compreensível e sustentável depois da integração.",
      },
      {
        heading: "Harness Engineering organiza verificações",
        text: "Böckeler (2026) descreve mecanismos de orientação, testes, análise estática, revisão e feedback ao redor de agentes de código. O texto distingue controles computacionais de revisões inferenciais e oferece um modelo técnico para estruturar a supervisão; não demonstra, por si, uma redução quantificada de erros ou aumento universal de qualidade.",
      },
      {
        heading: "Os estudos não medem tudo",
        text: "As pesquisas de produtividade desta revisão observam tempo, atividade registrada ou dimensões relatadas. Elas não fornecem uma medida única de qualidade de software em produção nem provam que toda assistência gere retrabalho. Essa diferença limita o alcance de qualquer conclusão sobre qualidade.",
      },
    ],
    imageCaption: "Verificar relaciona a proposta ao problema, aos critérios de aceitação e ao sistema em que será integrada.",
    sourceIds: ["bockeler2026harness", "becker2025impact", "chen2026beyond"],
    readingAnchor: "validar",
  },
  especificar: {
    number: "05/07",
    title: "A especificação organiza intenção e avaliação.",
    lead: "Em fluxos com assistentes e agentes, objetivos, restrições e critérios explícitos podem orientar a implementação e a verificação.",
    paragraphs: [
      {
        heading: "Uma referência para planejar e conferir",
        text: "Spec-Driven Development (SDD) coloca a especificação como referência para planejar, implementar e verificar a solução. Piskala (2026) oferece uma proposta conceitual para essa abordagem; ela ajuda a explicar a centralidade da especificação, mas não é um experimento de produtividade.",
      },
      {
        heading: "Mais que escrever um prompt",
        text: "O Spec Kit, a análise de Böckeler sobre Kiro, spec-kit e Tessl e o Technology Radar ilustram como a prática pode organizar requisitos, contexto e etapas de trabalho antes da implementação. São fontes técnicas e contextuais, com funções diferentes da evidência acadêmica sobre produtividade.",
      },
      {
        heading: "Especificar também envolve aprender",
        text: "Fowler (2026) oferece um contraponto a fluxos excessivamente lineares: a implementação pode revelar informações que mudam a compreensão do problema. No TCC, SDD é tratado como abordagem emergente e revisável, não como processo universal, garantia de qualidade ou substituto do julgamento técnico.",
      },
    ],
    imageCaption: "A especificação torna a intenção verificável e pode ser revisada quando a implementação revela novas informações.",
    sourceIds: ["piskala2026sdd", "delimarsky2025speckit", "bockeler2025sddtools", "thoughtworks2025sdd", "fowler2026fragments"],
    readingAnchor: "especificar",
  },
  evoluir: {
    number: "06/07",
    title: "A profissão concentra decisão e continuidade.",
    lead: "A geração pode mudar a distribuição do esforço, enquanto compreensão, integração, manutenção e responsabilidade técnica continuam necessárias.",
    paragraphs: [
      {
        heading: "O trabalho continua depois da geração",
        text: "A síntese interpretativa do TCC acompanha uma proposta desde a compreensão do contexto até revisão, integração e manutenção. Essas atividades podem se repetir em ciclos; não formam um protocolo experimental nem uma sequência obrigatória para toda equipe.",
      },
      {
        heading: "Decidir e responder pelo sistema",
        text: "O desenvolvedor precisa avaliar a adequação da solução, explicar decisões, reconhecer falhas e retomar o trabalho quando a ferramenta não atende à necessidade. A hipótese do TCC é de transformação do papel profissional, com mais atenção a especificação, supervisão e decisão — não de desaparecimento automático da profissão.",
      },
      {
        heading: "Mercado como contexto complementar",
        text: "A coluna do UOL Tilt reúne expectativas sobre equipes, salários e perfil profissional no Brasil. Por ser uma fonte jornalística, contextualiza o debate, mas não estabelece causalmente o efeito da IA sobre emprego, remuneração ou tamanho das equipes.",
      },
    ],
    imageCaption: "A prática profissional acompanha e sustenta o software depois da primeira proposta de código.",
    sourceIds: ["chen2026beyond", "bockeler2026harness", "gomescortiz2026tilt"],
    readingAnchor: "evoluir",
  },
  perspectivas: {
    number: "07/07",
    title: "A revisão fecha; novas perguntas permanecem.",
    lead: "Os resultados sustentam uma leitura contextual e indicam dimensões que ainda precisam ser avaliadas em trabalhos futuros.",
    paragraphs: [
      {
        heading: "Uma conclusão condicionada",
        text: "A IA generativa acelera algumas tarefas, mas a literatura revisada não mostra ganhos universais. O desenvolvedor segue necessário para especificar, avaliar e sustentar soluções; SDD e Harness Engineering ajudam a discutir essa reorganização, embora suas fontes conceituais não comprovem efeitos empíricos gerais.",
      },
      {
        heading: "O que pode ser investigado",
        text: "Avaliações futuras podem observar tempo total até uma entrega aceita, qualidade, defeitos, custo, manutenção e carga de supervisão em contextos diversos. Cobalt e Flightdeck aparecem como possíveis objetos de pesquisa a partir de anúncios de julho de 2026, não como resultados de estudos independentes.",
      },
      {
        heading: "Atualizações com fonte e limite",
        text: "A área de novidades reúne atualizações avaliadas e publicadas pelo autor. Cada item mantém origem, datas e limitações; uma novidade de mercado pode atualizar o contexto sem alterar automaticamente as conclusões da revisão consolidada.",
      },
    ],
    imageCaption: "Perspectivas futuras ampliam as perguntas sem transformar anúncios em resultados de pesquisa.",
    sourceIds: ["gomescortiz2026tilt", "cobalt2026introducing", "codemote2026flightdeck"],
    readingAnchor: "perspectivas",
  },
};
