# Música mais presente e cadência do trovão — v16

O ganho padrão de música passa de 0,28 para **0,52**, equivalente a +5,38 dB para o mesmo sinal. Catálogo síncrono, manifesto público e padrão interno do motor usam o novo valor. O componente da experiência aplica música 0,52, efeitos 0,10 e ambiente 0,06. O ganho continua aplicado uma única vez no bus musical, separado do ambiente e do trovão; o elemento de mídia conectado a esse bus permanece com volume nativo 1.

## Seleção e origem

A composição **não foi substituída**. A busca em fontes oficiais confirmou o [álbum de Liyue, Jade Moon Upon a Sea of Clouds](https://genshin.hoyoverse.com/en/news/detail/6448), cujo anúncio direciona a serviços de música e vídeos incorporados. A consulta ao HTML dessa página e a busca curta por recursos musicais oficiais de Liyue não localizaram um novo arquivo de áudio com entrega e origem documentadas que pudesse ser adotado nesta alteração. Isso não demonstra que tal recurso inexista; delimita o que foi encontrado. Nenhum áudio foi extraído de YouTube, Spotify, Apple Music ou de transmissões, e não foi acrescentado outro recurso musical.

Segue o arquivo do [site oficial](https://genshin.hoyoverse.com/en/home), com rótulo descritivo “Genshin Impact · tema instrumental oficial”, sem atribuir o nome Liyue. O [MP3 de origem](https://genshin.hoyoverse.com/_nuxt/medias/video-bgm.532ef479.mp3) foi reconferido em 15/10/2026: HTTP 200, `audio/mpeg`, 3.013.665 bytes. Os hashes do recurso remoto e do arquivo local conferem: SHA-256 `c901aa711353f467a392db4cb95f66a708779808973eca87018b36ba3ca23cf6`. O original mantém duração 188,352 segundos. `verifiedAt` registra essa nova conferência.

O item 2 do [FAQ oficial](https://www.hoyolab.com/article/143107) foi novamente consultado pela API pública oficial `https://bbs-api-os.hoyolab.com/community/post/wapi/getPostFull?post_id=143107`, campo `data.post.post.structured_content`. Mantém-se a interpretação documentada na v9 para este uso pessoal, acadêmico e sem cobrança, com declaração de direitos, sujeito à retirada pelo titular; não se afirma aprovação individual da HoYoverse nem licença aberta.

O cue de entrada permanece em **45,65 segundos**. Uma nova comparação digital de janelas de 20 segundos no original, por FFmpeg `volumedetect`, encontrou RMS médio de -32,2 dBFS nessa posição; 65 s: -33,4; 85 s: -36,7; 105 s: -39,3; 125 s: -32,1; 145 s: -32,4; 165 s: -33,5. Nenhuma dessas janelas justificou trocar a entrada por uma frase musical melhor com base apenas em energia. O aumento de ganho torna o mesmo trecho mais presente; não comprova melhora de preferência musical. Não há normalização dinâmica nem edição do MP3.

## Trovões frequentes sem fila acumulada

O controlador visual passa a fornecer raios a cada 3,5–7 segundos, com atraso acústico de 0,28–0,78 segundo. A diferença mínima entre chamadas de áudio pode, portanto, chegar a 3 segundos. O bloqueio anterior de oito segundos perderia eventos. O motor agora aceita intervalos a partir de **2,9 segundos**, com pequena margem para esse jitter e aritmética de ponto flutuante.

Cada evento aceito com o recurso pronto agenda o mesmo buffer já decodificado, sem criar amostras, sintetizar ou decodificar no raio. A cauda do sample dura 6,2 segundos, mas o envelope exponencial já está reduzido quando o raio seguinte chega. A coleção tem limite explícito de duas vozes: caso um evento de término demore a chegar, a voz mais antiga é interrompida e liberada antes de adicionar outra. O ganho do bus e do envelope não foi aumentado: com ambiente 0,06, bus de trovão 0,18 e envelope máximo 0,55.

Durante o carregamento fica guardado apenas o evento mais recente, válido por até **750 ms**. Preparação lenta descarta esse evento e não dispara uma sequência de trovões antigos quando termina. Mute, aba oculta, mudança de ambiente, ambiente zero e descarte continuam cancelando a fila e vozes. Cancelar também reinicia o bloqueio temporal, para que um novo episódio não herde a trava do anterior. Autoplay, desbloqueio por gesto, retomada e cancelamento das promessas de música foram preservados.

## Evidência e limites

`node --test test/experience-audio.test.mjs`: **65 testes passaram**, incluindo ganho único da música, hash do recurso original, sequência de raios a cada 3 segundos, teto de vozes, último evento pendente, expiração em 750 ms, cancelamentos e ausência de síntese/decodificação durante disparos. São contratos com objetos Web Audio simulados e verificações dos arquivos reais. A análise FFmpeg mede o PCM do MP3; não representa uma nova medição de saída no navegador nem audição física. O equilíbrio perceptivo e a preferência pela composição ainda dependem da escuta no dispositivo.

`npx eslint lib/experience/audio.ts test/experience-audio.test.mjs` terminou sem apontamentos; `git diff --check` dos arquivos alterados de código, manifesto e testes também passou. Esta frente não realizou build, commit ou deploy.
