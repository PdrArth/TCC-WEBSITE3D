# Validação da experiência v10

Data: 12/10/2026. Projeto: `G:\site-tcc`. Publicação anterior preservada: versão 11, commit `df6f5dc9ebba5ac12a135eea9595a9a9979a851f`.

## Solicitações atendidas

O giro automático permanecia restrito à introdução. Agora a visão geral também gira a aproximadamente 3,7 graus por segundo; arrastar, usar zoom ou restaurar o enquadramento pausa o giro por cinco segundos. Painéis, aba oculta e movimento reduzido suspendem esse giro. O retorno à ilha não mantém um painel antigo aberto.

O caderno remove os limites de largura acumulados e usa texto maior. Tema, ilustração, diagramas, fontes e navegação compartilham o mesmo alinhamento. Escolher um tema inicia sua leitura pelo título; voltar pelo histórico restaura a posição guardada. Selecionar o tema já ativo também retorna ao início, sem impedir que uma nova posição seja salva.

O card da ilha passou de uma coluna lateral para um painel amplo: título e introdução, imagem da própria ilha, comparação ou diagrama e três abas com os parágrafos originais do resumo. As setas e Home/End navegam pelas abas; atalhos com Ctrl, Alt e Meta permanecem disponíveis ao navegador. A seleção reinicia no primeiro ponto quando a ilha muda. Fontes e aprofundamentos continuam disponíveis.

Céu limpo usa zero grupos de nuvens; entre nuvens usa quatro e nublado usa oito. Fundos diurnos também distinguem esses estados. Garoa e chuva têm gotas com largura mínima projetada, núcleo contrastante e ondulações que completam seu tempo de vida no centro livre do lago. Entardecer permanece como escolha de horário, evitando apresentar esse estado como um clima fixo durante a noite.

As cores dos nomes das ilhas e da navegação de leitura foram corrigidas para não herdar texto claro sobre papel claro no horário noturno. As abas e legendas do card têm contraste verificado de 5,49:1.

## Verificação automática

- 104/104 testes passaram, incluindo 33 testes da cena e do movimento, além dos contratos editoriais, áudio, autorização e navegação.
- TypeScript `--noEmit` e ESLint do projeto passaram.
- A biblioteca preserva 24 fontes únicas: 11 centrais e 13 complementares. Cada um dos sete temas mantém seus três parágrafos editoriais originais.
- PDF, modelos GLB, autenticação, D1, MCP e agendamento não foram alterados nesta revisão.

## Verificação no navegador

Usado o navegador integrado, com prévia local real. Foram conferidos os sete cards, troca de ilha, abas por teclado, abertura do caderno, retorno à ilha, rolagem, seleção repetida do mesmo tema e histórico. A mudança de tema abre no início; o histórico recuperou uma posição anterior de leitura. Foram conferidos giro automático, arraste, zoom, restauração, pausa durante o card e retomada. No movimento reduzido, o ângulo permaneceu constante enquanto a água avançava suavemente.

Em 1280 × 720, artigo, texto e fontes mediram 1177,6 px; o corpo do texto mediu 24 px e a introdução 26 px. Em viewport emulado de 390 × 844, o corpo mediu 19 px, o artigo 334,7 px e o card ocupou 390 px, sem transbordamento horizontal da página. Esse teste é emulação de navegador, não um teste em aparelho físico.

Garoa exibiu 101 gotas na qualidade detalhada e impactos ativos no lago; chuva exibiu 360 gotas, com densidade e comprimento visualmente distintos. As capturas mostram gotas e ondulações. As nuvens e o fundo distinguiram céu limpo e entre nuvens. A leitura permaneceu legível após escolher o horário noturno.

Uma janela local de 18,6 segundos registrou cerca de 71 quadros por segundo em média e rotação da câmera de 0 para 0,9005 rad após a pausa. É uma medida do navegador integrado nesta máquina, sem garantia de desempenho para outros dispositivos. Nenhum erro de console foi observado no trecho verificado.

Capturas comparativas locais: `.sites-runtime/v10-qa/`. A pasta contém imagens da versão anterior, novo card, caderno, climas e emulação de celular. O build e a publicação são executados pelo workflow oficial do Sites, com uma nova versão e possibilidade de reversão à versão 11.

## Limites

Este trabalho corrigiu o comportamento, a leitura e os cards. Não substituiu os modelos da ilha nem adicionou novas faixas musicais. A trilha já existente foi preservada. Testes locais de autorização não representam um novo teste de escrita em D1 de produção; nenhum dado de produção foi gravado.
