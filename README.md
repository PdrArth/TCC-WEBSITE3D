# Do código à supervisão

**Se a IA escreve código, o que cabe a nós?**

Transformei meu TCC em um arquipélago para explorar essa pergunta. Cada uma das sete ilhas apresenta uma parte da pesquisa sobre inteligência artificial generativa e o trabalho de quem desenvolve software: o que se ganha em velocidade, o que ainda precisa ser revisado e como especificar, compreender e validar uma solução passam a ocupar mais espaço na profissão.

**[Explorar o arquipélago →](https://tcc-pdrarth.vercel.app/)** · [Abrir o caderno de leitura](https://tcc-pdrarth.vercel.app/#caderno/pesquisa) · [Ler o TCC em PDF](https://tcc-pdrarth.vercel.app/tcc-pedro-arthur.pdf)

## Um lugar para conhecer a pesquisa

O percurso começa na pergunta do trabalho, passa pela evolução das ferramentas, confronta estudos de produtividade e chega às mudanças na profissão. Ao selecionar uma ilha, um painel reúne a síntese, os exemplos visuais e as fontes daquele tema. O caderno oferece uma leitura contínua, com seleção direta de tema, e o PDF mantém o texto acadêmico completo.

| Ilha | O que você encontra |
| --- | --- |
| **01 · Pesquisa** | Problema, hipótese e percurso da revisão. |
| **02 · Ferramentas** | A passagem das sugestões de código à delegação de tarefas. |
| **03 · Produtividade** | Resultados que mudam conforme a tarefa, a experiência e a métrica. |
| **04 · Validação** | Revisão, testes e o trabalho necessário depois da geração. |
| **05 · Especificação** | Contexto, critérios de aceitação e *Spec-Driven Development*. |
| **06 · Profissão** | Responsabilidade técnica, supervisão e formação. |
| **07 · Perspectivas** | Conclusões e perguntas para futuras investigações. |

Entre uma leitura e outra, o cenário continua vivo: o horário avança, o clima muda, um morador percorre as pontes e os animais ocupam o lago e as ilhas. A experiência pode ser explorada com a câmera ou acessada diretamente pela leitura, sem depender da navegação em 3D.

## A pesquisa por trás do cenário

O TCC de **Pedro Arthur Oliveira Januário** é uma revisão narrativa da literatura com apoio documental. Seu núcleo reúne **11 fontes — cinco acadêmicas e seis técnicas, críticas e jornalísticas**. Outros 13 documentos complementam a contextualização das ferramentas e dos trabalhos futuros.

Os estudos não são apresentados como se medissem a mesma coisa. Tarefas, participantes, métodos e limitações acompanham os resultados. O site apresenta a pesquisa; a cena 3D não constitui um experimento de produtividade.

## Como o projeto é construído

A aplicação usa **Next.js, React e TypeScript**. O mundo interativo é renderizado com **Three.js e React Three Fiber**, a partir de modelos próprios preparados no Blender. Conteúdo e controles permanecem em HTML, com navegação por teclado, adaptação a telas menores e controles de câmera e ambiente.

O site público está na **Vercel**. O serviço editorial existente mantém o banco e a revisão privada; a interface pública recebe somente novidades aprovadas. Essa separação está documentada em [Publicação e serviço editorial](docs/deployment.md).

## Onde está cada parte

```text
src/             Aplicação: páginas, interface, conteúdo e regras
public/          Modelos otimizados, sons, imagens e PDF servidos pelo site
assets/          Arquivos de criação do mundo 3D
infrastructure/  Integrações da hospedagem e do serviço editorial
scripts/         Preparação de recursos e ferramentas de manutenção
test/            Testes de comportamento e contratos
docs/            Arquitetura, pesquisa, créditos e registros do projeto
```

As configurações exigidas pelas ferramentas ficam na raiz. O mapa detalhado do código está em [Arquitetura](docs/architecture.md), e o índice dos documentos está em [Documentação](docs/README.md).

## Autoria e créditos

Projeto de **[Pedro Arthur Oliveira Januário](https://github.com/PdrArth)**, construído a partir de seu TCC sobre IA generativa e desenvolvimento de software.

As origens e condições de uso de modelos, texturas e sons estão reunidas em [Créditos e licenças](docs/credits/README.md). Capturas e registros de validação ficam na documentação, separados do código da aplicação.

Este repositório não concede uma licença geral de reutilização do código, do texto acadêmico ou dos modelos autorais. Recursos de terceiros mantêm suas próprias condições de uso.
