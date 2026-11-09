# Jardim, descobertas e acessibilidade — 09/11/2026

## Escopo entregue

O visitante pode escolher entre um jardim 3D e uma lista em HTML das sete ilhas. As ilhas conservam seus modelos e conteúdo; nenhum clima, estação, música ou interação anterior foi removido. O modo foto continua ausente, conforme a decisão anterior do autor.

Patinhos nadam por rotas independentes e tartarugas percorrem margens em terra. A preparação verifica água, ilhas e pontes; chuva, gelo e noite influenciam o descanso. Há três patinhos na qualidade baixa, quatro na alta e duas tartarugas, em oito lotes instanciados, sem novas luzes ou recursos externos.

O menu **Vida e descobertas do jardim** oferece três lugares para sentar, oito para pescar, observação, flores, frutas, aceno e alimentação em três regiões de água livre. Um comando usa o caminho ocupado pelo morador, sem reposicioná-lo através do lago. Chuva, noite, gelo e pausa continuam limitando as ações. Um pedido durante a saída do abrigo termina o percurso seguro antes de alcançar o lugar escolhido, inclusive com movimento reduzido.

O caderno registra doze tipos de encontros no armazenamento local. A exploração textual também permite conhecer as espécies. A visita guiada reutiliza as sínteses aprovadas e percorre as sete ilhas com avanço, retorno e encerramento manuais, sem prazo.

## Auditoria e barreiras corrigidas

1. A entrada noturna usava destaque claro sobre fundo creme, com contraste de aproximadamente 1,48:1. O destaque passou a verde escuro; avisos menores e números dos mapas também receberam cores verificadas. Superfícies opacas mantêm a legibilidade dos controles sobre o cenário variável.
2. Aceno, alimentação e locais do morador dependiam do canvas. As ações agora têm botões e seletores HTML, com mensagens e caminhos equivalentes em `/explorar`. Essa rota não carrega o canvas nem antecipa GLB/Draco.
3. A navegação dependia de movimento e incluía um atalho de uma letra. Há pausa de animações e relógio, respeito ao movimento reduzido do sistema, controle de clarões desligado por padrão, foco visível, contenção e devolução de foco nos painéis e atalho **Alt+M**. Nomes, números e estados escritos acompanham as cores.
4. O PDF acadêmico não possui marcação estrutural completa. `/texto-completo` oferece uma alternativa em HTML com títulos navegáveis, resumo e Abstract identificado em inglês, tabela com cabeçalhos e dois grupos, notas de ida/volta, referências e descrições dos quatro diagramas. O PDF original permanece idêntico.

Durante o QA foram corrigidos também o fundo da barra fixa no contraste escuro, legendas que cobriam texto, foco retornando a controles ocultos e a tabela que ampliava a página inteira no celular. A tabela tem uma região focalizável com rolagem própria; o restante da página reflui.

## Recursos de acesso

- **Visão e cores:** contraste claro/escuro, paletas original/azul e âmbar/neutra, aumento de texto, espaçamento e suporte a cores forçadas. A paleta muda mapas e marcadores, preservando a identidade dos modelos das ilhas.
- **Cegueira e teclado:** títulos, listas, rótulos, botões, avisos de ações, ordem estável das ilhas e leitura integral independente do 3D. O relógio não fica em uma região de anúncio contínuo. Mensagens para leitores de tela podem ser desativadas.
- **Surdez e áudio:** o som inicia somente pelo controle de som. Há volumes separados, identificação da faixa e legendas de eventos como trovão e pesca; nenhuma instrução depende exclusivamente de áudio.
- **Movimento e luz:** preferência do sistema, movimento reduzido, pausa e clarões opcionais. Ações explicitamente solicitadas continuam possíveis no modo reduzido. A pausa bloqueia ações animadas até ser retomada.
- **Libras:** botão opcional nas páginas de texto carrega o widget oficial v7 do VLibras. Nenhum script do serviço é solicitado antes desse botão. O script atual inicializa o widget automaticamente; não é usada a inicialização antiga em duplicidade.

O VLibras é tradução automática de um serviço externo, com possibilidade de erros. A integração não comprova precisão linguística nem equivale a interpretação humana. Sua abertura foi verificada no navegador.

## Verificação

- `npm test`: **278 testes aprovados**. Inclui preferências e persistência corrompida, contraste das paletas, registros idempotentes, caminhos sem teletransporte, pedidos com movimento reduzido, fauna, opt-in de áudio e integridade do texto completo.
- `npx tsc --noEmit`: aprovado.
- ESLint dos componentes e páginas adicionados, e do componente principal alterado: aprovado.
- `npm run build`: aprovado; `/`, `/explorar`, `/texto-completo` e `/acessibilidade` gerados com sucesso. Prévia com `next start` verificada, incluindo chegada ao assento escolhido e troca para um ponto de pesca.
- Navegador: entrada silenciosa, navegação com Tab/Shift+Tab/Esc, foco contido e devolvido, sete etapas da visita, caderno após recarga, alimentação e pedido de atividade no modo textual, modos de contraste e leitura ampliada, tabela por teclado e VLibras sob demanda.
- Telas emuladas: **320×640, 360×800, 390×844, 412×915, 844×390 e 1280×720**. Controles principais do cabeçalho medidos em 44×44 CSS px ou maiores. Textos ampliados e espaçamento foram exercitados em 320 px.
- Pausa: horário permaneceu em 09:03 durante a navegação completa da visita. As ações animadas ficaram indisponíveis até a retomada.
- Preservação: sete ilhas, onze climas mais automático, quatro estações, playlist e PDF. SHA-256 do PDF: `59d208f910c5cec1bb951025a9d643e11e33f82e8dea86ec7c6e2105b96fe257`.

Capturas desta sessão ficam em `outputs/garden-accessibility-20261109/` no checkout, incluindo entrada, jardim, preferências, texto ampliado e tabela. Essa pasta de evidências locais não é publicada automaticamente.

## Texto completo e manutenção

`scripts/accessibility/export-tcc-html.py` lê o checkout acadêmico, usa Pandoc/citeproc e gera o fragmento estático sanitizado em `src/lib/tcc-complete.json`. A compilação web consome esse JSON e não requer Python ou Pandoc. Para regenerar:

```sh
python scripts/accessibility/export-tcc-html.py --source CAMINHO_DO_CHECKOUT_ACADEMICO --pandoc CAMINHO_DO_EXECUTAVEL_PANDOC
node --test test/fulltext-document.test.mjs
```

As descrições revisadas em `scripts/accessibility/figure-descriptions.json` estão vinculadas ao hash do PDF. Alterar o manuscrito exige revisar essas descrições e a conversão; divergências de hash interrompem a exportação. Capa e identificação foram consolidadas semanticamente, paginação virou navegação e as chamadas autor-data foram normalizadas pelo citeproc. As 24 referências compiladas, URLs e datas foram preservadas. O HTML usa descrições estruturadas em lugar dos diagramas impressos.

## Limites da evidência

Este trabalho implementa recursos e corrige barreiras identificadas; não é uma certificação de conformidade integral com WCAG. Não houve ensaio com NVDA, VoiceOver ou TalkBack em aparelho físico, validação com pessoas com deficiência, interpretação humana em Libras ou medição de bateria/GPU do S24 Ultra. Esses ensaios continuam necessários para avaliar necessidades específicas. A área autenticada do autor fica em outro serviço e está fora desta revisão da interface pública.

Referências de orientação: [WCAG 2.2](https://www.w3.org/TR/WCAG22/), [padrão de diálogo modal da WAI-ARIA](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/), [VLibras no Governo Digital](https://www.gov.br/governodigital/pt-br/acessibilidade-e-usuario/vlibras) e [integração atual do widget](https://vlibras.gov.br/doc/widget/installation/webpageintegration.html).
