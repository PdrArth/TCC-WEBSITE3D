# Vida no arquipélago — experiência 20

Revisão de 16–17/10/2026 sobre a experiência 19 (hospedagem 20, commit `5f356585c5dfe87127c7a2e0afbfa73e17d2d751`). A versão anterior permanece salva como `appgprj_6ac10ccda500819197e7ea32de53dae7~appgver_fcefb6ed0984819192884dcd922ffb54`.

## Alterações

Uma ilhota decorativa de 6,2 m de diâmetro recebe casa térrea, telhado de cerâmica, porta articulada, janela transparente e varanda com banco. A passarela abre no corrimão da ponte 7–1. A moradia tem identidade própria: os sete temas, rotas do visitante e câmeras continuam iguais. A casa antiga foi retirada da ilha A pesquisa.

O morador usa cabeça arredondada, rosto frontal, cabelo acompanhando a cabeça e joelhos articulados. A rede física cobre todas as ilhas e pontes, sem atalhos sobre a água. O circuito inclui pesca na ponte e margem, jardinagem, coleta de frutas e observação. Em tempo aberto, completa-se em aproximadamente 177 segundos no simulador, antes da noite natural. A precipitação interrompe a atividade: ele volta pela rota válida mais curta, entra pela porta e permanece visível pela janela. A garoa permite a varanda depois da entrada; oito segundos secos liberam a retomada. À noite, alterna varanda e interior.

São 8/12 aves e 12/20 peixes nos modos leve/detalhado. As aves têm três variações e poleiros fora da folhagem, com abrigo na varanda. Os peixes têm quatro cores, tamanhos distintos e trajetos preparados que cobrem lago, margens e entorno da ilhota, evitando terreno e os 40 pilares registrados. O gelo reduz sua exposição. Não foram adicionadas luzes dinâmicas.

Telhado, ilhota e passarela participam da mesma consulta de superfície usada pela precipitação. A revisão independente encontrou gotas recicladas sob o telhado após um quadro de dois segundos; o respawn agora considera a superfície da nova origem. Também foram alinhadas as posições dos obstáculos com os pilares efetivamente renderizados.

## Preparação e custo

O GLB preparado da experiência 19 permanece inalterado. Rotas dos peixes, grafo do morador e geometria estática da moradia são preparados antes da publicação. Nove lotes estáticos preservam exatamente 16.305 vértices e 10.892 triângulos; o teste de ida e volta compara buffers, índices e limites. A restauração local levou cerca de 0,7 ms (1,2 ms incluindo parse), contra 22 ms de geração no mesmo conjunto de 25 amostras; o caminho sem Buffer, equivalente ao navegador, levou cerca de 2,2 ms. Isso mede processamento isolado, não download ou abertura total.

O conjunto da vida na ilha passa de no máximo 16 para 20 chamadas de desenho (+4, abaixo do limite de +12). Mantém nove lotes estáticos, seis lotes do personagem e até cinco desenhos de objetos/gestos. Animação e indicadores não usam estado React por quadro. As pausas de aba oculta, leitura, painel e movimento reduzido continuam ativas.

## Verificação

215 testes completos, TypeScript e lint dos arquivos alterados passaram. Os testes incluem circuito pelas sete ilhas, todas as pontes, 108 retornos partindo de diferentes posições em arestas físicas, cancelamento de atividades, oito segundos secos, alternância noturna, poleiros protegidos, trajetos aquáticos, telhado e respawn após quadros longos. A assinatura da geometria preparada no manifesto é verificada separadamente.

No navegador, o circuito completou uma volta; foram observadas caminhada, retorno desde uma ilha distante, entrada pela porta, abrigo interior e permanência na varanda na garoa. Frente, perfil e costas foram inspecionados. Os sete painéis, próxima ilha, Esc, foco, caderno e retorno funcionaram; o morador pausa durante leitura. Emulação 390×844: painel abre e fecha, sem rolagem horizontal. Não houve teste em telefone físico nem nova avaliação auditiva.

Pesquisa, PDF, conteúdo dos painéis, música, navegação do visitante, clima automático, autenticação, revisão privada, MCP e dados publicados não foram reescritos. Nenhum agendamento foi ativado.

## Evidências e limites

Logs, medições DOM e capturas ficam em `.sites-runtime/v20-*`. As primeiras séries de recargas sofreram variação externa e limitação do navegador a 1 fps em segundo plano, inclusive na versão anterior; não são evidência de custo de renderização da nova casa. A medição foi repetida com o navegador reiniciado, no mesmo viewport 1280×720. A série inicial dessa repetição apresentou mediana de 1.247 ms na base e 1.303,3 ms na nova versão (+4,5%); houve uma primeira preparação de 5,3 s na nova série. Aberturas sem cache e equipamentos diferentes não são equivalentes a essa amostra.

Durante exploração em primeiro plano foi observado 106 fps, com 140 chamadas de desenho e p95 de 11,6 ms. A amostra seguinte em segundo plano foi limitada pelo host a 1 fps; não se afirma desempenho sustentado em qualquer dispositivo. A conferência final da versão com geometria preparada e sua medição constam no complemento abaixo.

## Complemento final

Build final, TypeScript, lint e 215 testes passaram. Cinco reaberturas da versão final em 1280×720 registraram 1.295,1 / 889,2 / 1.032,4 / 1.204,6 / 1.342,9 ms: mediana de 1.204,6 ms, contra 1.247 ms na série da base no mesmo navegador reiniciado. A diferença foi de aproximadamente −3,4%, dentro da margem de +10%; os climas da série não foram todos iguais. Em todas as cinco amostras, `data-world-life-geometry=prepared` confirmou o uso das peças preparadas.

Capturas da casa/varanda, abrigo e visão das costas estão em `docs/evidence-v20/`. São inspeções locais da mesma geometria, cujo preparo posterior é byte-exact. O cenário em produção é publicado no endereço existente depois dessa conferência; o snapshot da hospedagem 20 permanece como reversão. Não se afirma uma medição física contínua de 30 fps em celulares nem eliminação de toda travada em qualquer equipamento.
