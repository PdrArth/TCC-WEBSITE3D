# Validação — ilhas da pesquisa (v6)

## Mudanças solicitadas

Os quatro pavilhões passam a ocupar ilhas separadas. A seleção abre imediatamente a síntese do TCC e a câmera faz uma aproximação curta; não há caminhada nem personagem ativo. A barra inferior, os questionários e o contador de descobertas foram removidos. O mapa oferece quatro acessos diretos.

As ilhas mostram resumos com fontes e aprofundamento opcional. A leitura contínua usa corpo de 20px no desktop e 18px no celular, com ilustrações renderizadas da própria cena. A metodologia, os contextos dos estudos, as âncoras antigas e a biblioteca de 11 fontes centrais e 13 documentos complementares são preservados. As decisões editoriais e as referências de legibilidade estão em `reading-v6.md`.

O cenário tem rotas variadas de aves, recolhimento durante a chuva, raios localizados nas tempestades e iluminação de entardecer. O tornado foi removido. As estações seguem trimestres meteorológicos do hemisfério sul, com paleta inspirada em Minas Gerais e no interior do Sudeste. A representação é artística, sem dados meteorológicos ao vivo. A transição entre tempo seco e chuvoso usa como referência contextual a [publicação do INMET sobre a primavera de 2026](https://portal.inmet.gov.br/noticias/primavera-2026-confira-a-previsao-para-a-estacao); as probabilidades da simulação não são medidas climatológicas.

## Música

O autor escolheu Liyue. A trilha oficial selecionada é [Jade Moon Upon a Sea of Clouds — Disc 1](https://www.youtube.com/watch?v=t1O7LpOTBfM), de Yu-Peng Chen e HOYO-MiX, no canal Genshin Impact. O [anúncio oficial](https://genshin.hoyoverse.com/en/news/detail/6448) identifica o álbum. A [orientação da HoYoverse](https://support.hoyoverse.com/hc/en-us/articles/50333834244633-Can-I-use-in-game-music-for-my-fan-made-content) limita o uso de música do jogo a fins pessoais e não comerciais; não foi encontrada autorização explícita para espelhar os arquivos neste site.

A experiência disponibiliza o acesso oficial externo. Seus controles locais ajustam apenas ambiente e efeitos. A entrada não baixa nem reproduz Kounine ou a OST de Genshin em segundo plano. Nenhum arquivo do YouTube foi extraído. A fonte e a forma de reprodução são identificadas na interface.

## Preservação

Arquivos acadêmicos não são editados. O PDF publicado permanece com SHA-256 `59d208f910c5cec1bb951025a9d643e11e33f82e8dea86ec7c6e2105b96fe257`. Autenticação, D1, revisão privada e MCP permanecem nos contratos existentes. Nenhum agendamento é ativado. A v5 publicada é a referência de reversão: `appgprj_6ac10ccda500819197e7ea32de53dae7~appgver_e78648aee4ac81918d3f692549e14e49`.

## Verificação integrada

- 46 testes Node passaram, incluindo fontes, autorização, áudio, clima, estações, modelos, transições de câmera, rotas variadas das aves, recolhimento na chuva e geometria dos raios. O conjunto preserva também verificações dos assets legados de navegação, que não são usados pela seleção direta atual.
- TypeScript, ESLint e `git diff --check` passaram. Uma revisão independente de código não encontrou novo defeito objetivo em foco, cancelamento, retomada do canvas, descarte de recursos ou mudança de estação.
- Desktop no navegador integrado: entrada, quatro resumos, mapa, foco no título, Escape, retorno ao controle de origem e seleção rápida Gerar → fechar → Validar. Corrigida a movimentação dos botões durante o retorno: eles mantêm as coordenadas da visão geral até a câmera convergir.
- Acesso por `#produtividade` abre a seção e foca seu título. Ao recarregar diretamente nessa âncora e retornar, o foco chega ao botão da marca na entrada, sem cair no corpo da página.
- Corpo dos resumos medido em 20px no desktop e 18px em 390 × 844 emulado, sem transbordamento horizontal. Leitura completa, ilustração e sumário foram inspecionados visualmente. Não houve teste em aparelho físico.
- Na tempestade, a cena registrou zero aves visíveis e dois eventos de raio em locais distintos. A chuva foi inspecionada visualmente; a captura estática não coincide necessariamente com o instante breve do raio. No inverno, a densidade de folhagem converge para 0,59 e a de flores para 0,08, com mudança visual de paleta. Esses valores são parâmetros artísticos.
- Movimento reduzido respeita a preferência do dispositivo por padrão; é possível alterar nas opções. O teste confirmou renderização sob demanda, abertura direta e ausência de aves em chuva. Os testes automatizados verificam que movimento reduzido e pausa não disparam flashes.
- Uma amostra de desktop em tempestade registrou 92 fps na qualidade leve, 160 chamadas de desenho e 101.040 triângulos. É uma amostra desta máquina, não uma garantia para celulares. Modelos: 4.029.128 bytes no principal e 1.860.932 no leve. O personagem legado não é carregado.
- O modo ambiente foi testado com suspensão, retomada e silenciamento, sem depender de MP3. A interface indicou áudio ativo após o gesto de entrada. Não foi feita avaliação acústica em alto-falantes nem reprodução integral do álbum externo.

Capturas em `.sites-runtime/v6-qa`: comparação anterior, ilhas, resumo, mapa, tempestade, inverno ao entardecer e leitura em desktop/celular. O build de produção é executado pelo fluxo oficial do Sites antes do salvamento e da publicação. A nova versão só é publicada se esse passo terminar com sucesso.

Falha de WebGL, bloqueio de rede e perda de contexto não foram forçados novamente nesta revisão. Os caminhos de alternativa continuam no código; a imagem estática padrão foi atualizada para as quatro ilhas, inclusive nos fallbacks editoriais.
