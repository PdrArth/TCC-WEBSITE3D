# Áudio da experiência — v7

## Diagnóstico confirmado no v6

- O ambiente passava pelo ganho `.65` e depois pelos efeitos `.14`: ganho combinado `.091`, antes do volume de cada fonte.
- O ruído de chuva era bastante suavizado antes de um filtro passa-altas de 350 Hz, removendo parte relevante de seu próprio espectro.
- O clima claro começava com silêncio; os primeiros pássaros eram agendados depois de 1,2 segundo.
- A ativação não dava confirmação sonora. O indicador confirmava `resume()`, sem medir sinal e sem observar interrupções posteriores do contexto.

Esses problemas explicam áudio discreto e diagnóstico insuficiente. Não demonstram a causa única do relato de ausência total de som. Volume do sistema, dispositivo de saída, bloqueio da aba ou interrupção externa precisam de observação direta quando houver sinal no grafo e ausência de audição.

## Contrato e integração

Chamar `enable({ music: false })` diretamente no gesto de entrada ou no botão, antes de qualquer `await`. O padrão sem argumentos também ativa somente ambiente e efeitos. A música oficial de Liyue fica em outra aba; nenhuma faixa oficial é copiada ou embutida. O caminho legado de música licenciada só existe com `{ music: true }` explícito e não é utilizado pela ilha.

Volume inicial recomendado: `setVolumes(0, .55, .36)`. Os ganhos de efeitos e ambiente são paralelos, conectados ao mesmo analisador e depois a `AudioContext.destination`. O terceiro argumento é opcional; com dois argumentos, o ambiente acompanha `effects * .65`. `setVolumes(0, 0)` silencia os dois barramentos.

A ativação toca uma confirmação de aproximadamente meio segundo, mesmo se os arquivos de efeitos ainda estiverem carregando. O clima claro e o crepúsculo têm vento contínuo e pássaros intermitentes; chuva tem ruído com detalhe agudo; tempestade acrescenta vento grave e trovão com intervalo mínimo de oito segundos. As fontes possuem rampas de ataque e volumes limitados.

`await audio.playTest()` ou `await audio.testSound()` retoma/ativa o contexto em um gesto, toca a confirmação e mede oito amostras do analisador ao longo de aproximadamente 520 ms. Para o resultado do botão, usar `result.lastTest.signalDetected`, `rms` e `peak`: o campo de sinal instantâneo pode estar em uma cauda silenciosa depois do teste. Volume zero retorna um erro acionável.

`audio.diagnostics()` retorna estado do contexto, consentimento (`desired`), execução (`enabled`), visibilidade, clima, ganhos, vozes ativas, RMS e pico atuais, último teste e os 16 eventos mais recentes. Sinal detectado significa PCM medido no nó imediatamente anterior à saída; não comprova audição pelos alto-falantes.

## Ciclo de vida

Ocultar a aba pausa as fontes e o contexto, preservando o consentimento. Retornar tenta retomar; falhas são informadas, preservando a possibilidade de uma nova ativação. Uma interrupção visível do navegador muda o estado para `interrupted`, fornece erro à interface e restaura a execução se o contexto voltar a `running`.

`mute()` cancela inicialização, recuperação e medição pendentes. Promessas antigas não podem revogar um novo consentimento nem restabelecer som depois de silenciar. `dispose()` desconecta fontes, barramentos e analisador, remove o observador de estado, aborta downloads e fecha o contexto. Inicialização parada por quatro segundos retorna erro visível, exceto quando a aba está oculta, situação tratada como pausa.

## Validação

`node --test test/experience-audio.test.mjs`: regressões de ativação, ausência de música por padrão, ganhos, troca de aba, interrupções, cancelamento, timeout, limpeza, silêncio de amostras decodificadas e cálculo do medidor. Os mocks não comprovam audibilidade. O teste numérico do ruído usa suas amostras reais geradas, ainda antes da filtragem pelo navegador.

A integração local, verificada pelo agente principal com o analisador real do navegador em 2026-10-11, registrou contexto `running`, RMS `0.02094042186795878`, pico aproximado `0.0661343` e sinal detectado durante a reprodução. Isso confirma saída PCM no grafo local; mute, retomada e publicação devem ser verificados também pelo agente principal.

Referências da API: [estados e interrupções de BaseAudioContext](https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/state), [medição PCM do AnalyserNode](https://developer.mozilla.org/en-US/docs/Web/API/AnalyserNode/getFloatTimeDomainData).
