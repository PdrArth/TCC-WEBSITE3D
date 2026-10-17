# Carregamento e morador visível — experiência 19

Escopo de 16/10/2026: acelerar a abertura e tornar casa/atividades do morador legíveis. Base preservada: commit `03344bec3f069af7514f29a1f06828cb873309f1`, hospedagem 19, experiência 18. Conteúdo acadêmico, PDF, painéis, navegação, trilha, climas, estações e autorização editorial não foram reescritos.

## Causas verificadas e alterações

O personagem anterior pausava durante toda a abertura e era ocultado ao se abrigar. Agora começa a caminhar já na introdução, mede 1,76 m, usa roupa de maior contraste e passa pela margem frontal da ilha A pesquisa. Pesca com vara/linha/boia, caminha até a árvore, recolhe fruta e retorna. Durante mau tempo/noite permanece visível na varanda, movimentando braços junto ao cesto. Pausas de leitura, painel, aba oculta e movimento reduzido permanecem. A casa mede 2,30 × 1,50 m, com telhado mais baixo, varanda e fachada voltada à vista principal; o conjunto continua limitado a 16 chamadas de desenho.

O GLB leve era decodificado em 335 primitivas e agrupado durante a abertura. `scripts/world/prepare-runtime-world.mjs` faz esse trabalho antes da publicação, conserva 98 primitivas/52 batches e pré-calcula as sementes de movimento das folhas. Foram retirados somente 8.117 triângulos de área exatamente zero. Texturas e materiais originais foram preservados. Precisão, seleção das ilhas, áreas, orientações de faces válidas e sementes são verificados por round-trip independente.

O arquivo aumenta de 2.767.416 para 3.163.264 bytes (+14,3%), abaixo do orçamento de 4 MB. É uma troca explícita de tamanho por menos processamento no cliente, não uma alegação de download menor. O runtime reconhece o arquivo preparado e evita novo agrupamento (0,1 ms observado). A versão detalhada continua com o caminho anterior.

Modelo, manifesto e decodificador são antecipados; o módulo da cena começa a carregar antes da hidratação. O código de leitura é solicitado ao abrir um tema/caderno, com recuperação de erro local e alternativa PDF. A ordem dos estilos permanece a mesma. O Canvas compila os programas da cena completa antes de iniciar a animação e faz o primeiro desenho antes de revelar o cenário; a imagem de abertura segue disponível durante a preparação.

## Medições locais

Três reaberturas com cache, mesmo navegador e viewport 1280×720, sem equivalência garantida de clima. Instrumentação em atributos DOM, sem envio de dados do visitante.

| Medida | Base: garoa / neblina / nublado | Nova: chuva / chuva congelante / neve |
| --- | --- | --- |
| Cena pronta, ms | 1712,4 / 1804,5 / 1902,2 | 1526,1 / 1363,7 / 1287,2 |
| Decodificação/preparo do modelo, ms | 562 / 760 / 775 | 270 / 240 / 331 |
| Compilação primária, ms | 498,4 / 484,8 / 528,7 | 196,9 / 212,2 / 144,1 |

Mediana da cena pronta: 1,80 s → 1,36 s (aproximadamente 24% menor nesta amostra). A primeira visita local ao novo build levou 4,18 s, com 1,32 s até a resposta HTML e ferramentas de build/verificação concorrentes; não equivale às reaberturas com cache. O snapshot público anterior levou 11,40 s, dos quais 8,95 s precederam o boot React; não é possível atribuir esse atraso inteiro ao modelo 3D.

Ainda existe custo de preparação/primeiro desenho de 337–382 ms nas amostras novas, antes da revelação do cenário. Não se afirma eliminação de toda pausa em qualquer equipamento ou rede. A exploração local da neve apresentou 82 fps / p95 14,9 ms em um snapshot; não é benchmark de dispositivo móvel físico.

## Verificação

197 testes comportamentais, TypeScript, lint dos arquivos alterados e build passaram. Testes cobrem o artefato preparado, solo/rota da casa, gestos, abrigo visível e contrato do manifesto. Navegador: sete painéis, sequência, caderno, fechamento/Esc e retorno de foco; animação retomada após leitura; zero erros de console observados. Emulação 390×844: Canvas cobre o viewport, sem rolagem horizontal, painel e retorno funcionam. Não houve teste em celular físico nem nova avaliação auditiva.

Evidências locais em `.sites-runtime/v19-startup-before.json`, `v19-startup-after.json`, `v19-mobile.png`, `v19-resident-preview.png`, logs de build/testes/lint e capturas finais. Versão anterior permanece disponível para reversão.
