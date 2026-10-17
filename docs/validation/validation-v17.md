# Abertura e início da música — v17

Revisão pequena em 15/10/2026 sobre a v16 (`81493b7ccfbd7dda58419f23e9689c58c6a77fe3`). Pesquisa, painéis, navegação entre ilhas, ciclo de climas, garoa, raios, estações, iluminação, PDF, autenticação e banco foram preservados. A abertura correta continua na URL raiz; links `#caderno/...` continuam abrindo os temas correspondentes.

## Imagem e composição da abertura

Foi observado na v16 um retângulo cinza atrás da imagem de espera. O render original tinha `film_transparent=False` e mantinha o plano `Poster shadow ground`; o contêiner da entrada também ultrapassava a borda direita (right=1318 em viewport de1280px).

`poster-v17.webp` é um novo render da fonte própria do Blender, sem salvar alterações no `.blend` ou no GLB: 1800×1350,146.886bytes, alpha preservado exatamente do PNG e quatro cantos transparentes. A câmera aproxima a composição inicial do runtime (distância×1,05). Script e verificações em `scripts/world/render_poster_v17.py` e `assets/world/poster-v17-report.json`. SHA256 `ca5faa5c6d3692cc56b266d734e4619a365a3db2cde48626cb56e4c7315ae543`. O poster antigo e os modelos permanecem intactos por hash.

A área da ilha fica contida na janela e a abertura conserva fundo neutro e contraste do texto durante o preparo. O novo `manifest-v17.json` mantém os dados ambientais e modelos da v16; muda somente versão e poster. A entrada não redireciona para a pesquisa. O clique antecipado em Explorar é guardado até a interface montar.

## Música antes da interface

O HTML entrega o elemento de áudio com preload e um script estático pequeno antes da experiência React. A preparação e tentativa de reprodução não esperam React, Three.js ou o cenário. O script tenta autoplay; bloqueado pelo navegador, tenta novamente no gesto real. O volume padrão passa de52% para68%, sem modificar composição ou cue45,65s. O download do modelo recebe prioridade baixa para não anteceder o áudio e os recursos essenciais da interface.

O motor adota o mesmo elemento e posição da música; não cria uma segunda trilha na entrada. Mute, aba, erros de Web Audio, StrictMode, cancelamentos e replay de eventos foram revisados. Detalhes em [registro de áudio v17](../audio/audio-v17.md). Os datasets antecipados do `<html>` são esperados antes da hidratação; somente esse elemento tem `suppressHydrationWarning`, sem suprimir divergências dos filhos.

## Validação

180/180 testes passaram; TypeScript, ESLint dos arquivos alterados, `git diff --check` e build oficial também passaram. Os testes de ciclo de áudio usam DOM/WebAudio simulados; o player HTML nativo inicial não passa pelo analisador, portanto `metered=false` e RMS zero não indicam ausência da música. Evento playing e avanço do tempo verificam reprodução no navegador, sem substituir audição física.

Na prévia compilada em `http://127.0.0.1:5174/`, a raiz mostrou a abertura e o painel Ferramentas, Esc, leitura e retorno funcionaram. O navegador bloqueou autoplay sem gesto; o clique iniciou o elemento existente em45,65s, que avançou para51,50s. Silenciar em63,56s e retomar em63,70s não reiniciou a faixa. O controle mostrou68%. Os tempos até a cena pronta foram2.859,5ms no primeiro carregamento local observado,1.315,4ms no desktop repetido e1.041,5ms no celular emulado; não representam garantia para outros equipamentos ou a rede pública.

Capturas reais em `.sites-runtime/v17-welcome-desktop.png` e `v17-welcome-mobile.png`: viewport efetivo1163×654 e354×767, respectivamente (a interface de testes aplicou escala à dimensão solicitada). Não houve rolagem horizontal; o estágio móvel terminou na borda354,55px. A abertura manteve texto e botões legíveis e a ilha sem retângulo cinza. Não apareceram erros ou avisos de hidratação; apenas o aviso já existente de depreciação `THREE.Clock`. Teste móvel emulado, sem aparelho físico. O carregamento do3D e pausas de GPU/rede não foram eliminados; a música foi separada desse preparo.
