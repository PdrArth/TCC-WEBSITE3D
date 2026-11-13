# Jardim vivo e revisão visual — 13/11/2026

Pedido: remover o painel de acessibilidade, corrigir congelamento inicial e durante os ajustes do ambiente, preencher árvores, reparar frutos, tornar aves/tartarugas mais vivas, adicionar caranguejos e ninho, distinguir a leitura das ilhas e substituir a bacia da cachoeira por borda infinita. Identidade, ilhas, climas e estações preservados.

## Implementação

- A cena não importa mais o hook de preferências e não herda movimento reduzido/pausa/texto de armazenamento antigo. Retirados painel, botão de pausa, entrada de texto da abertura e widget opcional VLibras. URLs de texto seguem disponíveis; `/acessibilidade` redireciona à entrada. Sem alteração de configurações do sistema operacional.
- Menus bloqueiam cliques no mundo, mas não o relógio da fauna nem a rotina do morador. Página oculta e leitura continuam suspendendo a cena. Chuva forte/noite mantêm deslocamentos de abrigo e repouso, com respiração, olhar e pequenos movimentos.
- Nove copas existentes recebem massas de folhas sazonais em um lote instanciado. Palmeiras, araucária, banana e prédios preservados. Ninho com galho na jabuticabeira da Pesquisa; aves usam dez novos poleiros. Frutos são reposicionados sobre a casca real e flores/folhas da mesma planta usam a mesma fase do vento.
- Patos maiores, tartaruga terrestre na Pesquisa, tartaruga nadando perto de Perspectivas e dois caranguejos nas margens. Percursos independentes, sem atalhos atravessando terra/pontes. Caranguejos também entram no caderno.
- A borda tem queda contínua de água de chuva, sem bacia, poço ou apoio de pedra. A lâmina dissipa-se na parte inferior. Mantido o ciclo finito de enchimento e escoamento; pedras da margem ficam fora da passagem.
- Botão de leitura destacado e página editorial com título serifado, capítulos e acesso ao texto integral. Retiradas apenas as maquetes repetidas na leitura; texto acadêmico, referências e PDF preservados.

## Verificação

- Suíte Node: 282 testes aprovados. Testes de trajetos, transições sem teletransporte, abrigo, animação de aves em repouso, árvores/frutos em ambos os GLBs e limites de enchimento/queda.
- Tipagem TypeScript aprovada. ESLint focal sem erros; quatro avisos anteriores de dependências de hooks em `scene.tsx`. As exceções de mutabilidade documentam recursos Three.js atualizados pelo loop R3F.
- Navegador Brave: controles preservam onze climas, automático e quatro estações. Durante o painel de clima, relógios de fauna/morador avançam, `data-world-resident-pause=none`; após céu limpo, aves voltam a voar e morador retoma a rotina. Movimento completo desde a abertura.
- Verificação visual: copas e ninho visíveis; lâmina de transbordamento observada com fluxo ~0,71; sem bacia inferior. Leitura responsiva testada em larguras CSS reais de 320 e 433 pixels e desktop, sem rolagem horizontal. Cabeçalho estreito mantém PDF dentro da leitura.
- Testes em navegador não equivalem a medições de bateria/desempenho em aparelho físico. Dados acadêmicos não foram reescritos nem revalidados nesta revisão.

Capturas locais em `outputs/garden-refresh-20261113/` (ignoradas pelo Git).
