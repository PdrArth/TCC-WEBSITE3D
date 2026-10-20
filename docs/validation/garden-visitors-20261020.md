# Jardim — alimentação, modo foto e vagalumes

Revisão de 20/10/2026 sobre `827d5ac`. Modelos, conteúdos e identidade das sete ilhas, todos os climas, as quatro estações e a playlist foram preservados.

## Alimentar os peixes

Tocar em água aberta lança uma porção de comida, junto dos anéis já existentes. São doze pequenos grãos, com vida de nove segundos e intervalo mínimo de três segundos entre porções. Terra, gelo e margens sem espaço suficiente não recebem comida. O pool não cresce com os toques.

Até seis peixes no modo leve e oito no modo detalhado se aproximam quando há um segmento de água livre entre sua posição e a comida. Nadam em órbitas com tamanhos, sentidos e velocidades diferentes. Ao terminar, voltam pelo segmento validado de entrada; o relógio individual da rota retoma exatamente do ponto de saída. Trocar o local ou congelar a água faz a aproximação terminar sem teleporte. Os demais peixes mantêm suas rotas.

## Modo foto

O botão de câmera aparece após entrar nas ilhas. O modo esconde cabeçalho, etiquetas, mapa e controles comuns, interrompe o giro automático e mantém arraste e zoom por gesto. A barra permite salvar PNG ou sair; Esc também sai e devolve o foco ao botão de câmera. Atalhos das telas ocultas ficam inativos.

A captura renderiza um quadro e o compõe com o céu atual, pois o fundo normal da aplicação é CSS. A imagem não leva menus e não tem fundo transparente. Não habilita a retenção permanente do buffer WebGL. URLs temporárias são liberadas após o download ou descarte. A exportação usa a resolução atual da cena.

## Vagalumes

Vinte e quatro partículas no modo leve ou quarenta e duas no detalhado aparecem gradualmente nas noites calmas de verão. As posições seguem os canteiros existentes, com movimentos e pulsos independentes. O tamanho do halo permanece legível na visão afastada, e a profundidade continua ativa para respeitar a arquitetura. Não há luzes adicionais. Fora do verão, durante o dia e com precipitação, desaparecem suavemente. O modo de movimento reduzido conserva posições estáticas; o estado inativo evita atualizações dos buffers.

## Evidências

252 testes passaram, incluindo segurança dos trajetos, aproximação, alimentação, retorno, troca de porção, gelo, duração limitada e presença sazonal dos vagalumes. O build de produção e a verificação TypeScript passaram. Os testes anteriores de ilhas, fauna, clima, estações, personagem e áudio continuam aprovados.

No navegador, um toque real gerou doze grãos e três peixes em aproximação. A entrada e saída do modo foto foram conferidas, inclusive a restauração de foco por Esc. Downloads reais foram abertos e inspecionados: PNG em 1280 × 720 no desktop e 390 × 844 no viewport móvel. O viewport de 390 × 844 não apresentou rolagem horizontal, e todos os controles de clima e estação continuaram acessíveis.

O verão com céu limpo à noite registrou 24 vagalumes e intensidade 1,000; após trocar para tempestade, a contagem chegou a zero e a intensidade a 0,000. Nenhum erro de renderização foi registrado na verificação. A revisão móvel usa emulação de viewport, não um aparelho físico.

Capturas e PNGs locais em `outputs/garden-visitors-20261020/`. Logs em `.sites-runtime/garden-visitors-all-tests.log` e `.sites-runtime/garden-visitors-build.log`.
