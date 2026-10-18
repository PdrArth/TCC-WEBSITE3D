# Jardim: conforto e vida nas ilhas — revisão de 18/10/2026

Revisão de 17/10/2026: [validação do jardim](../validation/garden-20261017.md). Mantém as sete ilhas e acrescenta flores, borboletas, controles de ambiente, ondas por vento, peixes independentes, pesca em oito pontos, assentos originais, sono noturno e cachoeira contínua por chuva. A revisão do veredito corrige os seixos da margem e as transições das aves e amplia os controles da câmera. As cinco músicas escolhidas estão integradas à playlist local. Todos os climas e estações seguem disponíveis e o movimento é sempre completo. A cachoeira termina numa bacia de pedras ligada à margem e escoa em períodos de duração limitada.

# Histórico: abertura e vida nas ilhas v18

Relatório atual: [validação v18](../validation/validation-v18.md). Céu inicial em tela inteira, preparação opcional adiada, ponte7→1 e rotina de morador. Ajustes manuais exclusivos do autor; pesquisa preservada. A v17 fica disponível para reversão.

# Histórico: abertura v17

Relatório atual: [validação v17](../validation/validation-v17.md). Ajustes limitados à abertura, preparo e início da música. A v16 permanece preservada para reversão.

# Histórico: ajustes v16

Relatório atual: [validação v16](../validation/validation-v16.md). A revisão preserva pesquisa e painéis e trata abertura, ciclo de climas entre abas, chuva central e raios. A v15 permanece disponível para reversão.

# Histórico: acabamento v15

O relatório atual está em [validação v15](../validation/validation-v15.md). A [validação v14](../validation/validation-v14.md) e o histórico da v13 abaixo ficam preservados. A v15 mantém o painel lateral aprovado e corrige água, nuvens, trovões e preparação gráfica. A v14 hospedada permanece disponível para reversão.

# Histórico: cards da pesquisa — opção 2

Data: 12/10/2026. Projeto: `G:\site-tcc`. Escopo: os sete resumos de ilha e sua navegação; referência escolhida pelo usuário: segunda imagem exibida na última rodada de propostas.

## Evidências e normalização

- Verdade visual: `archive/v13/cards-v13-option-2.png`, 1513 × 1040 pixels.
- Implementação: `.sites-runtime/cards-v13-qa/desktop-final.png`, 1513 × 1040 pixels, viewport CSS 1513 × 1040, DPR aproximadamente 1. Sem moldura de dispositivo ou redimensionamento para comparar.
- Estado comum: ilha 02, Ferramentas; aba 2 selecionada; primeiro marco, GitHub Copilot; painel no início da rolagem.
- Comparação integral: referência e captura final foram abertas juntas no mesmo input de comparação. As cinco superfícies obrigatórias foram examinadas nessa dupla. Não foi necessário recorte de detalhe: títulos, abas, link oficial, nota e rodapé são legíveis na resolução integral; estilos calculados e medidas DOM também foram conferidos.
- Responsividade: capturas `mobile-bottom.png` (390 × 844), `desktop-1280-bottom.png` (1280 × 720) e `landscape.png` (844 × 390). São emulações no navegador integrado, sem teste em dispositivo físico. Telas baixas usam rolagem vertical própria e mantêm a navegação visível.

## Histórico de comparação e correções

1. **P2 — tipografia herdada.** A captura `desktop-first.png` e os estilos calculados mostraram ano, data e descrição com 22 px, apesar das regras novas. A especificidade foi corrigida: na captura final, descrição 26 px e ano 32 px; na versão móvel, descrição 22 px.
2. **P2 — controles inferiores parcialmente cobertos.** A primeira composição somava margens e uma legenda fora da imagem. A sequência podia cair atrás do rodapé fixo. Foram ajustados espaçamentos, proporções das colunas e posição da legenda. A síntese do primeiro marco acompanha o texto aprovado no mock; o registro original completo permanece no caderno. Na captura final, a navegação dos marcos termina em y=866,5 e o rodapé começa em y=919,7. No celular, termina em y=663,7 e o rodapé começa em y=709,7.
3. **P2 — foco no último marco.** Enter no botão que leva de Kiro para Antigravity removia o controle focado. A seleção agora move o foco para o ano correspondente ao entrar nas extremidades. Verificação no navegador: nome Antigravity e foco “Marcos de 2025” depois da ativação por Enter.
4. **P2 — altura móvel legada.** Um `min-height:88px!important` antigo aumentava o botão de próxima ilha. A regra v13 o substitui. O rodapé mantém ações legíveis, sem transbordamento horizontal, em 390 × 844 e 844 × 390.
5. **P2 — deslocamento da imagem.** Ao mudar a ilustração para posicionamento relativo, um `top:88px` antigo deslocou-a para baixo. Foi explicitamente removido. A captura final coloca imagem, resumo e navegação no espaço do conteúdo. Durante desenvolvimento, houve erro transitório de hot reload ao trocar o componente por `memo`; a sintaxe foi corrigida e a validação final começou com recarregamento completo. Não foram registrados erros novos de console nessa execução limpa.

## Superfícies obrigatórias

**Fontes e tipografia:** serif Newsreader existente para títulos e subtítulo, sans existente para texto e controles. Hierarquia, tamanhos e entrelinhas se aproximam da referência; o texto permanece em HTML. As descrições nunca dependem de hover para serem lidas.

**Espaçamento e layout:** painel amplo, três abas antes do conteúdo, texto à esquerda e ilustração à direita no desktop. O celular empilha a ilustração e o texto. Existe um único rodapé com Voltar às ilhas, Ler este tema no caderno e Próxima ilha; os blocos inferiores antigos foram retirados dos resumos, mantendo o aprofundamento no caderno.

**Cores e tokens:** papel `#fcfaf4`, verde `#315440` e âmbar. Contraste calculado: verde/papel 8,14:1, nota/papel 4,79:1, descrição de aba/papel 4,64:1. O botão escuro mantém texto claro, e o link do caderno permanece verde sobre papel em estado normal.

**Imagem e recursos:** ilustração Gerar produzida por ImageGen a partir da referência escolhida, WebP 720 × 530, 58.524 bytes. Não foi substituída por CSS ou SVG. Os demais temas reutilizam renders próprios existentes. A identificação como ilustração conceitual permanece visível. Origem registrada em `../credits/assets.md`.

**Texto e conteúdo:** preservados os três parágrafos editoriais de cada tema no cadastro e no caderno, as 11 fontes centrais e 13 complementares e os oito marcos documentais. Eventos conservam tipo e ressalvas, incluindo a reescrita do OpenCode, a prévia pública do Antigravity e a distinção entre o agente Codex e o modelo original. A apresentação curta do Copilot omite somente texto repetido pela data e pelo contexto; a versão completa continua no caderno.

## Verificações funcionais

Percorridos os oito marcos e conferidos nome, data, tipo e URL oficial. Testadas as setas, Home/End, abas e conservação do marco ao alternar abas. Testado foco na última transição por Enter. Testado ciclo Tab/Shift+Tab dentro do diálogo, ESC com retorno ao controle de origem e a abertura do caderno no tema selecionado.

Percorridos os sete resumos. Trocar de ilha reinicia o painel no topo, seleciona sua aba inicial e foca o título. A última ilha não oferece uma ilha 08. O caderno preserva conteúdo completo e mostrou estado vazio de novidades publicadas, sem rascunhos no fluxo público local. Nenhuma operação de escrita no D1 foi usada nesta revisão.

TypeScript, ESLint dos componentes alterados e 9 testes editoriais/de navegação passaram. O build de publicação é executado pelo workflow do Sites depois deste gate.

## Diferenças aceitas e limites

P3: o enquadramento botânico é uma imagem individual gerada, com pequenas diferenças em relação ao mock; os controles de ano incluem foco, indicação de estado e ação anterior que o desenho estático não detalhava. A legenda conceitual foi acrescentada por fidelidade ao caráter acadêmico da pesquisa.

Esta validação cobre os cards. O componente foi memoizado, com callback de áudio estável, para evitar trabalho de renderização do conteúdo a cada atualização do relógio/clima. Isso não comprova correção dos travamentos gerais do mundo 3D. Clima, física, fauna, iluminação e playlist não integram esta alteração.

## Checklist final

- Referência resolvida pela ordem exibida: opção 2.
- Fontes, layout, cores, imagens e conteúdo comparados com a captura final.
- Achados P2 corrigidos e novamente capturados; nenhum P0/P1/P2 restante no escopo dos cards.
- Desktop, celular, teclado, cronologia, fontes e acesso ao caderno verificados.

final result: passed
