# Áudio e movimento da v8

## Recursos locais e licenças

As três faixas são arquivos MP3 completos obtidos diretamente da biblioteca oficial de Scott Buckley em 12/10/2026. As páginas de cada obra declaram CC BY 4.0. Nenhum áudio foi extraído de YouTube ou de serviço de streaming. Os arquivos musicais não foram recortados ou normalizados; volume e fades são aplicados em tempo de execução.

| Faixa | Fonte e licença | Download oficial | Duração | Bytes |
| --- | --- | --- | --- | --- |
| Sleep | [Página oficial](https://www.scottbuckley.com.au/library/sleep/) — [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | [MP3](https://www.scottbuckley.com.au/library/wp-content/uploads/2019/08/sb_sleep.mp3) | 184,263 s | 7.374.013 |
| Reverie | [Página oficial](https://www.scottbuckley.com.au/library/reverie/) — CC BY 4.0 | [MP3](https://www.scottbuckley.com.au/library/wp-content/uploads/2020/03/sb_reverie.mp3) | 223,673 s | 8.950.768 |
| Hymn | [Página oficial](https://www.scottbuckley.com.au/library/hymn/) — CC BY 4.0 | [MP3](https://www.scottbuckley.com.au/library/wp-content/uploads/2018/02/sb_hymn.mp3) | 121,291 s | 4.855.797 |

Crédito de cada obra: `'Título' by Scott Buckley - released under CC-BY 4.0. www.scottbuckley.com.au`. A interface apresenta autor, obras e link da licença; o manifesto conserva o crédito individual.

`bird-1.ogg` a `bird-4.ogg` são quatro trechos distintos de uma mesma gravação real: [Bird, Robin Isolated, de JohnsonBrandEditing](https://freesound.org/people/JohnsonBrandEditing/sounds/434024/), sob [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/). A fonte descreve gravação de campo com Olympus, editada e com redução de ruído. Foi utilizada a [prévia pública HQ do próprio Freesound](https://cdn.freesound.org/previews/434/434024_3229685-hq.mp3), não o WAV original. Os trechos começam em 0, 5, 10 e 15 segundos, têm 3 segundos cada, foram convertidos para Ogg Vorbis mono a 44,1 kHz e receberam fades de 60 ms/200 ms. São variações da gravação, sem pretensão de representar espécies brasileiras. Os quatro arquivos somam 81.253 bytes. Atribuição voluntária e indicação das modificações constam do manifesto.

Os efeitos `selection.ogg` e `arrival.ogg` preexistentes continuam no catálogo. Quando um efeito ainda não carregou ou é silencioso, há um som de interface sintetizado. Os pássaros usam exclusivamente a gravação licenciada; uma falha no arquivo não é substituída por apitos sintetizados. Chuva, vento e trovão são ruídos gerados localmente.

## Contratos de execução

`AUDIO_CATALOG`, exportado por `lib/experience/audio.ts`, está compilado antes do gesto. `credits()` devolve esse catálogo sem buscar recursos. O JSON público tem o mesmo conteúdo. Antes de `enable()` não há contexto, player, download ou reprodução. O botão de explorar chama `enable({music: true})` no gesto; a API conserva `enable()` sem música para usos explícitos de ambiente.

A primeira faixa é sorteada por visita, independentemente da hora. Cada ciclo embaralha as três obras e evita repetir a última na fronteira entre ciclos. `timeupdate` prepara a próxima mídia nos 60 segundos finais, sem chamar `play()` ou conectá-la ao grafo audível. Esse player é reaproveitado na troca. Os players se sobrepõem por dois segundos, com fades por ganho; `ended` cobre a ausência de um evento de progresso no final. Depois, o player anterior é pausado, liberado e desconectado. A entrada da primeira faixa também tem fade de dois segundos. A música dispõe de até 30 segundos para iniciar; o contexto de áudio mantém seu limite de quatro segundos. Um erro real de mídia ou o esgotamento desse prazo gera erro próprio da música e preserva os sons ambientais. A pré-carga é uma indicação ao navegador, não uma garantia de buffering contínuo em qualquer conexão.

Grafo real do navegador:

```text
HTMLAudioElement(volume=1) → MediaElementSource → ganho do fade → ganho da música → analisador da música ┐
efeitos → ganho dos efeitos ────────────────────────────────────────────────────────────────────────┤
ambiente → ganho do ambiente ───────────────────────────────────────────────────────────────────────┤
                                                                                      analisador geral → saída
```

`setVolumes(music, effects, ambience)` controla três buses paralelos, sem multiplicar o ganho do ambiente pelo ganho dos efeitos. A interface inicial usa `.28`, `.10`, `.06`. Os medidores apresentam o PCM depois do ganho, incluindo `diagnostics().music` com estado, título, tempo, duração, erro, RMS, pico e sinal. `status: playing` significa que a promessa de reprodução resolveu; `signalDetected` indica amostras acima do limiar no analisador. Isso não confirma o volume físico dos alto-falantes. Test doubles sem `createMediaElementSource` usam volume HTML e reportam `metered: false`.

`mute()`, ocultação e descarte cancelam timers, fontes, crossfade e retomadas obsoletas. A mídia preparada é liberada e seu índice devolvido à sequência; isso não altera o diagnóstico da faixa que está tocando. Uma promessa antiga não pode pausar o mesmo player após uma ativação mais recente. Voltar à aba preserva consentimento e retoma a música atual, sem trocar a faixa. `playTest()` preserva a escolha musical existente.

`setEnvironment(weather, phase?)` controla a ambiência. Não há cantos à noite ou sob chuva, chuva congelante, neve, tempestade ou granizo. Garôa e entardecer reduzem intensidade e frequência dos cantos. De dia os intervalos são de 10–24 segundos; em garôa/entardecer, 18–32 segundos. Aves visuais refugiam-se em pousos do manifesto em condições severas e à noite.

## Cena e câmera

`IslandScene` recebe `zoom`, `onZoom`, `phase`, `windSpeed`, `precipitation` e `snowfall`. Zoom fica entre os limites do manifesto, atualmente 0,8–2,0. Wheel e pinça só são interceptados no canvas; Ctrl/Meta+wheel preserva o navegador, e painéis bloqueiam o controle da cena. O zoom se conserva ao visitar e fechar uma ilha. As etiquetas são reprojetadas durante a transição do overview. A introdução usa afastamento de 1,05; a compensação portrait de 1,10 mantém o jardim dentro da composição móvel.

Aves possuem cabeça, olhos, bico, corpo, cauda e asas com pivô no ombro, em três meshes instanciados. Rotas entre pousos reais alternam repouso, decolagem, batimento, planeio e aterrissagem. Aves em refúgio permanecem visíveis nas copas. Folhas e flores animam seus próprios pivôs, preservando os troncos. Água recebe variação leve de superfície e brilho por shader, sem recurso de simulação pesada. Movimento reduzido e painéis pausam as animações.

A atmosfera aceita todos os estados do contrato: claro, parcialmente nublado, nublado, névoa, garôa, chuva, chuva congelante, neve, tempestade, granizo e `dusk` legado. Fase do dia é independente do fenômeno. Névoa altera distância da neblina; neve e granizo usam buffers reutilizados, com velocidades diferentes; raio e trovão ocorrem em tempestade, incluindo granizo dos códigos WMO 96/99 e não piscam em movimento reduzido. Alvos de raio usam `manifest.weatherScenery.lightningTargets`, com fallback legado.

## Verificação

`node --test test/experience-audio.test.mjs test/scene-motion.test.mjs`: 57 verificações passaram nesta entrega, cobrindo consentimento, cancelamento, retomada, falhas isoladas, shuffle, pré-carga, crossfade, grafo e medidores, câmera, proporção da ave, continuidade das rotas, refúgio e buffers de precipitação. A regressão de uma troca musical com atraso de oito segundos falhou no código anterior e passou após a correção. São verificações de contratos e aritmética com fakes; o responsável pela integração verifica PCM real e aparência no navegador.

`ffprobe` confirmou duração e tamanho dos sete novos arquivos. TypeScript e ESLint dos arquivos alterados passaram antes da documentação final.

SHA-256 dos MP3s:

```text
Sleep   575bd0de1a5299f65d8a96b64192464d33c2b583d51d8638e488cbe32134d956
Reverie ca1e7194d7d6f49127c77ff2f4011d07182525c826bb7ded3d3944e69ca678d2
Hymn    65a0b4ee666c26d72cb6faeaaf2215f9516924a9bdbf01008cd642cbad4ba125
```

