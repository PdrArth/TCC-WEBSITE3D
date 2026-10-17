# Validação v7 — sete ilhas

Data: 11 de outubro de 2026. Projeto: `G:\site-tcc`.

## Mudanças verificadas

- Sete destinos em ordem: pesquisa, ferramentas, produtividade, validação, especificação, profissão e perspectivas. Cada destino abre resumo, imagem da ilha, fontes e aprofundamento. Anterior/próxima mantêm o foco no título e reiniciam a rolagem do painel.
- As copas conservam volume e distribuição de folhas nos dois modelos. High: 7.202.772 bytes; low: 3.142.656 bytes. Os dois têm cores por vértice em todas as 270 primitivas. Fontes Blender, scripts e relatórios estão em `assets/world` e `scripts/world`.
- Sol, chuva, tempestade e entardecer têm iluminação e atmosfera próprias. As transições de céu, vegetação e chuva continuam até terminar, inclusive em renderização sob demanda. As estações seguem uma interpretação artística do interior do Sudeste, sem neve genérica no inverno.
- Há 18 aves no nível detalhado e 12 no leve, com seis trajetos variados. Recolhem-se durante chuva e tempestade. Árvores reagem ao vento. Raios atingem pontos fora das ilhas de conteúdo.
- Som ambiente e efeitos usam ganhos paralelos. A entrada oferece escolha explícita de movimento e ativa ambiente por gesto. A trilha oficial de Liyue permanece externa, conforme escolha do autor. O botão de teste mede sinal e avisa quando o volume está zerado.
- No celular, marcadores numerados deixam o cenário visível; o mapa apresenta nomes, imagens e descrições. Resumos e leitura completa não dependem de WebGL.

## Evidência local

Verificações executadas: 62 testes automatizados, TypeScript sem emissão, ESLint e `git diff --check`. A compilação oficial é executada pelo fluxo de empacotamento Sites, depois dessas verificações.

Navegadores: Codex In-app Browser e Brave, ambos Chromium. Inspeção desktop em 1280×800 e tamanho normal do Brave; celular em viewport emulada de 390×844. Não houve teste em telefone físico.

- Entrada → sete ilhas → resumo → próximo/anterior → Esc → mapa: conferido no navegador. Foco no título e rolagem zero em cada resumo; sete imagens respondem HTTP 200. Leitura completa preserva as sete âncoras anteriores e não apresentou transbordamento horizontal a 390 px.
- Chuva/tempestade: opacidade estabilizou em 0,660, aves visíveis em zero. Dois raios registrados no Brave, segundo alvo `18.8,0,-17.3`; a câmera e os painéis continuaram operáveis.
- Outono com sol: cor da vegetação `65724b`, parâmetro sazonal de folhas 0,830. Inverno: `757951`, parâmetro 0,590. Esses parâmetros controlam paleta e escala das copas, não significam porcentagem exata de folhas eliminadas. Primavera restaura a paleta verde.
- Áudio real no IAB: teste com oito amostras, RMS máximo 0,140959 e pico 0,422091. Brave: RMS máximo 0,132584 e pico 0,363415. Contexto `running`, sinal detectado no analisador anterior à saída. Volume zero mostrou instrução para aumentar o volume; silenciar zerou os indicadores de saída. Isso comprova PCM no grafo de áudio, não audição física pelos alto-falantes.
- Há regressões automatizadas para troca de aba, interrupções, cancelamento e retomada de áudio, mudanças de destino/câmera, movimento reduzido, tempestades sem flashes em movimento reduzido e limites dos modelos.
- O ambiente de automação apresentou períodos de callbacks a 1 Hz mesmo reportando página visível/focada. A qualidade automática agora ignora cadências maiores que 250 ms; esses períodos não provam baixo desempenho da GPU. Não se afirma 30 fps sustentados em dispositivos físicos. A seleção manual de qualidade leve continua disponível, inclusive para equipamento realmente abaixo de 4 fps.

Capturas locais em `.sites-runtime/v7-qa`: comparação v6, visão desktop das sete ilhas, tempestade, resumo, mapa e leitura no celular. Arquivos de QA são ignorados no pacote público.

## Preservação

- PDF original mantido: SHA-256 `59d208f910c5cec1bb951025a9d643e11e33f82e8dea86ec7c6e2105b96fe257`, HTTP 200, 710.284 bytes.
- Biblioteca: 11 fontes centrais e 13 complementares. A conferência editorial e suas ressalvas estão em `docs/reading-v7.md`.
- `GET /api/updates`: HTTP 200 com lista pública vazia no banco local. `GET /api/editorial` sem autenticação: HTTP 401. Backend, autenticação, D1, revisão e MCP não foram alterados. Nenhum dado foi gravado em produção nos testes; nenhum agendamento foi ativado.
- Folha de aprovação, texto acadêmico e arquivos da pasta do TCC não fazem parte desta alteração.
- Reversão: versão pública anterior `appgprj_6ac10ccda500819197e7ea32de53dae7~appgver_6d17a9f473e08191a9136999ab5c5aae`; fonte base `1e5c7862b1555adec6b3530388807252c8b28a9d`. Manifesto, GLBs e imagens v6 foram preservados.

Falhas de WebGL/modelo têm alternativa estática e leitura HTML por contrato existente e inspeção do código; não houve injeção dessas falhas pelo navegador nesta rodada. Publicação/descarte de notícias não foram repetidos, pois esse fluxo não foi modificado.
