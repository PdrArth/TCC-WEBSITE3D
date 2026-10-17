# Revisão da experiência — outubro de 2026

## O que mudou

A abertura apresenta Pedro, a pergunta da pesquisa e o funcionamento da ilha antes da entrada. O botão «Começar com som» inicia a reprodução no próprio gesto; existe entrada silenciosa. A experiência ocupa a janela, com opção de tela cheia, mapa acessível, minimapa de posição, ESC e climas Sol, Chuva e Entardecer. Pássaros, chuva, vegetação e objetos têm reações discretas. A trilha continua sendo Solace, licenciada e atribuída; não foram copiados áudio ou recursos do portfólio de Bruno Simon.

Os pavilhões apresentam uma pergunta, uma síntese e três pontos, com detalhes expansíveis. A leitura direta apresenta um dos sete capítulos por vez, mantém as âncoras antigas, a navegação pelo histórico e a biblioteca completa.

## Correções verificadas

- Retorno à ilha sem depender de rolagem: viewport fixo, foco com preventScroll, recálculo do tamanho e das projeções, retomada da renderização e convergência da câmera pelo tempo transcorrido.
- Cancelamento e troca de destino sem abertura atrasada do painel anterior. Mapa e posição do personagem compartilham o manifesto de caminhos existente.
- Som iniciado sem esperar a transferência/decodificação integral da música; erros tardios, silenciamento durante o carregamento e novas tentativas tratados. A aba oculta pausa música e ambiente.
- ESC também funciona com foco nos controles de volume. Painéis prendem o foco e devolvem-no ao controle de origem.
- Uma aba sem foco não é usada para decidir redução de qualidade ou desativação do mundo: o navegador pode limitar sua renderização a aproximadamente 1 FPS, sem indicar capacidade real da GPU.

## Evidências desta revisão

30 testes Node passaram, incluindo conteúdo, assets, navegação, câmera, clima e oito cenários de áudio. TypeScript e ESLint dos componentes alterados passaram. O build de produção é executado pelo fluxo oficial do Sites antes do salvamento da versão.

No navegador Brave: abertura com som, entrada silenciosa, quatro painéis, percurso com chegada, mudança Gerar → Evoluir durante o movimento, retorno, mapa, ESC, opções, chuva, leitura por capítulos e histórico foram exercitados. O controle de tela cheia alternou entre entrar e sair. O layout não apresentou rolagem externa. A leitura e os painéis mantêm rolagem própria.

Dimensões CSS observadas: desktop 1897 × 844, retrato emulado 433 × 938 e paisagem emulada 902 × 417. O zoom do perfil alterou a correspondência entre a resolução solicitada e a viewport CSS; estes são os tamanhos efetivamente medidos. Em paisagem, o botão inicial ficou inteiramente dentro da viewport. Não houve teste em celular físico, medição representativa de desempenho em GPU móvel ou avaliação auditiva de uma volta completa da trilha.

A referência pública https://bruno-simon.com/ foi consultada. Seu carregador não concluiu no navegador desta sessão; não se afirma ter auditado todos os seus fluxos. As mudanças acima implementam a direção descrita pelo autor e a experiência local efetivamente testada.

Capturas comparativas locais: `.sites-runtime/redesign-qa/01-before-entry.png`, `02-before-panel.png`, `08-mobile-panel.png`, `09-landscape-entry.png`, `10-reading-final.png` e `11-entry-final.png`. São evidências de QA, não conteúdo do site.

## Preservação

Permanecem as 11 fontes centrais e 13 complementares. O PDF, SOURCES.md, dados editoriais originais, modelos GLB, autenticação, rotas privadas, D1 e MCP não foram alterados. Os testes confirmam o hash do PDF e as referências. Nenhum agendamento foi ativado. A versão pública anterior, v3, permanece disponível para reversão no Sites.
