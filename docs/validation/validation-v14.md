# Revisão final das ilhas — v14

Validação local em 15/10/2026, no navegador integrado do Codex, em `G:\site-tcc`. Direção aprovada: fluidez primeiro, sete ilhas, estações do Sudeste, painel lateral amplo e entrada direta na trilha existente. O registro visual v13 permanece em `../design/archive/v13/qa.md`; a versão hospedada 13 é a referência de reversão.

## Implementação verificada

O cenário começa leve. A geometria estática é agrupada por material e política de sombras, preservando pivôs da vegetação, água e seleção dos pavilhões. No GLB leve, 335 primitivas originais tornam-se 98 após agrupamento. Resolução e sombras são limitadas; o modo automático só testa maior detalhe depois de 45 segundos e oito janelas estáveis. Uma queda persistente retorna ao leve e impede novas tentativas de aumento naquela sessão. A troca de qualidade conserva a câmera. Leitura e aba oculta suspendem a renderização.

O manifesto v14 compartilha contorno real do lago, ilhas, pontes, altura da água, vegetação e posições das luminárias. Precipitação diferencia água e terreno. Tempestade e granizo filtram também a paleta do entardecer. Há gotas, ondulações distribuídas na água exposta, granizo que quica em terra e desaparece na água, neve e gelo graduais, degelo, folhas no chão e redução moderada da folhagem sazonal. Espécies perenes permanecem. A iluminação noturna reúne luminárias nos pavilhões e caminhos, farol e feixe giratório, com duas luzes dinâmicas reais.

O painel ocupa 60% da largura no desktop, limitado a 840 px, e toda a largura até 1000 px. Imagem horizontal, resumo contínuo, diagrama ou comparação e fontes substituem as antigas abas. Ferramentas conserva oito marcos e suas ressalvas em lista vertical. Um único rodapé liga ao tema no caderno e à próxima ilha. A câmera desloca a ilha selecionada para o espaço livre. Os rótulos da visão geral ficam ocultos enquanto o painel está aberto, evitando rótulos congelados sobre a câmera de detalhe. ESC fecha, restaura a visão e devolve o foco ao controle de origem. O caderno conserva navegação superior e largura, com redução tipográfica próxima de 8%; corpo principal de 18 px no celular e aproximadamente 22 px no desktop.

O MP3 existente permanece idêntico. O primeiro início usa `startAtSeconds: 45.65` e fade de 150 ms; mudanças de clima, painéis e retorno da aba não reiniciam o cue. O ponto foi identificado por análise de energia PCM e testado digitalmente, sem confirmação por audição humana de uma frase musical completa. A comparação do primeiro segundo passa de -103,70 dBFS no início original para -32,02 dBFS no cue. Detalhes e limites em `../audio/audio-v14.md`.

## Desempenho observado

Mesma viewport de 1280 × 720. A v13 pública usava qualidade alta; a v14 usa qualidade automática, que permaneceu leve. A mudança de qualidade é parte deliberada da correção: estes números não comparam fidelidade visual idêntica. O navegador e o computador de teste não representam todos os dispositivos.

| Cenário | Média fps | Mín.–máx. fps | Chamadas de desenho | Maior p95 de quadro observado | Heap JS máximo informado |
| --- | ---: | ---: | ---: | ---: | ---: |
| v13, céu limpo | 29,8 | 28–32 | 674–677 | Não registrado | Não disponível no registro antigo |
| v14, céu limpo | 58,7 | 53–80 | 119 | 36,7 ms | 88 MB |
| v14, chuva | 58,9 | 54–62 | 119–125 | 36,2 ms | 73 MB |
| v14, tempestade | 53,3 | 49–59 | 126–128 | 37,4 ms | 87 MB |
| v14, neve | 55,4 | 49–60 | 121 | 38,9 ms | 87 MB |

Cada cenário v14 tem 60 amostras em duas séries de 30, com aproximadamente um segundo entre amostras. Os intervalos de coleta e interação resultaram em sessões de 75,6 a 122 segundos; não são benchmarks de exatamente 60 segundos contínuos. O p95 é o maior valor entre janelas de telemetria, não o percentil de uma distribuição bruta única. O heap é a leitura disponível do navegador, não memória GPU. As chamadas incluem a cena e suas sombras; não foi isolado tempo GPU por passe de sombras.

A primeira execução local do build registrou cena pronta em 1676 ms e carregamento do modelo em 424 ms; outra execução registrou modelo em 425 ms. O cache não foi apagado para medir um carregamento frio controlado. Uma tentativa manual de alta qualidade apresentou aproximadamente 33 fps e 243 chamadas; a política automática conservadora evita essa promoção prematura.

Dados e capturas em `.sites-runtime/v14-qa/`: `before-performance.json`, `after-performance.json`, `panel-desktop.png`, `panel-mobile.png`, `panel-landscape.png`, `night.png`, `rain.png`, `storm-dusk.png` e `snow.png`. São evidências locais ignoradas pelo Git.

## Interações, acessibilidade e falhas

Percorridos os sete painéis, próxima ilha, caderno, retorno, ESC, foco inicial e ciclo Tab/Shift+Tab. Fechar conserva zoom e rotação. O arraste alterou o ângulo e suspendeu temporariamente a rotação automática. Restaurar enquadramento funciona. Movimento reduzido abre o conteúdo diretamente e impede flashes/animações intensas. O caderno pausa a cena; retorno reativa a experiência.

Emulação móvel: 390 × 844 e 844 × 390, sem transbordamento horizontal, painel completo e rodapé legível. Não houve teste em aparelho físico ou leitor de tela. Estilos calculados do caderno confirmam 18 px de corpo e 19 px de abertura no celular; legendas e metadados têm escala própria. Reduzir a área útil preservou rolagem e controles; não houve sessão física de zoom do navegador a 200%.

Os controles foram percorridos nos dez climas em dia, entardecer e noite (30 combinações). Inspeções visuais adicionais cobriram chuva, tempestade no entardecer, neve, granizo e noite. Neve/gelo acumularam progressivamente; granizo registrou impactos em água e quique em terra; aves se abrigaram em chuva forte/noite. Noite registrou 20 luminárias no modo leve e farol em rotação. Testes de trajetória, superfícies, acúmulo, degelo, paletas e estações complementam a inspeção; ela não equivale a uma simulação meteorológica física.

Falhas locais: GLBs ausentes mantêm imagem e acesso aos sete resumos e ao caderno; atraso de 12 segundos nos modelos permite abrir a leitura ainda em `loading`; perda simulada real do contexto WebGL muda para alternativa estática e mantém os painéis; `/api/updates` indisponível mostra aviso e mantém texto consolidado e PDF. Nenhum desses testes alterou produção ou dados publicados.

O primeiro gesto no navegador iniciou a música no cue e o tempo continuou avançando; silenciamento foi preservado. Promessas bloqueadas, retorno da aba, fade, loop, isolamento de volumes e trovão têm testes de comportamento com objetos simulados. Raios foram observados na tempestade; a audição física de volume, mixagem e sincronismo do trovão depende do equipamento do visitante.

## Integridade e verificações de código

125 testes passaram, incluindo conteúdo editorial, 11 fontes centrais, 13 complementares, cronologia, superfícies, agrupamento, estações, navegação e áudio. TypeScript, ESLint direcionado aos arquivos alterados e build oficial passaram. A execução limpa do build no navegador não apresentou erros de JavaScript ou shader.

PDF preservado: SHA-256 `59d208f910c5cec1bb951025a9d643e11e33f82e8dea86ec7c6e2105b96fe257`. Autenticação, D1, MCP e cadastro editorial não foram modificados; `/api/editorial` sem sessão respondeu 401 e `/api/updates` respondeu 200. Os testes desta revisão não escreveram no banco. O agendamento continua desativado.

## Limites aceitos

Neve, gelo, iluminação indireta, chuva, aves e plantas são representações procedurais estilizadas. O abrigo da neve sob os pavilhões usa máscara aproximada, não colisão completa com cada móvel. O clima continua aleatório, sem geolocalização. O ganho de fluidez medido vale para a prévia compilada e o equipamento testado; latência da hospedagem e dispositivos físicos não foram reproduzidos neste benchmark.

Resultado local: critérios funcionais e automatizados aprovados, com limites de medição e percepção registrados acima. Publicar no endereço existente conservando a versão 13 para reversão.
