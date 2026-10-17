# Início da música no HTML — v17

A primeira tentativa de música sai do efeito React e passa a acontecer quando o navegador recebe o HTML da página. O servidor entrega um único `<audio id="tcc-entry-music" preload="auto" src="/experience/audio/genshin-official-theme.mp3" hidden aria-hidden="true">`, seguido do script estático `EARLY_AUDIO_SCRIPT`, de `lib/experience/early-audio-script.ts`. O script não importa React ou Three.js, não busca manifesto e não cria outro player ou AudioContext. Solicita `play()` imediatamente; posiciona o cue de **45,65 s** quando os metadados permitem o seek. A transferência do MP3, a rede e a política de autoplay do navegador continuam podendo adiar a reprodução.

O padrão musical passa de 0,52 para **0,68** (aproximadamente +2,33 dB), com esse mesmo valor no bootstrap, catálogo, manifesto e controles. A faixa, cue, créditos e origem permanecem os da v16. Chuva, trovão e seus ganhos não foram alterados nesta frente.

## Autoplay, gestos e intenção

O estado inicial fica em `window.__tccEntryAudio`, com o elemento, `desired`, `silenced`, `gesture`, `entryRequested`, `status`, `error`, a promessa `pending`, o proprietário `owner` e os métodos `claim(owner)`, `release(owner)` e `setEnabled(enabled)`. `status` distingue carregando, tocando, bloqueado, pausado, desligado e erro. O primeiro `play()` pode ser recusado por política do navegador: o script informa `blocked` e tenta novamente em um `pointerdown`, Enter ou Espaço reais, sem desbloqueio oculto ou promessa de autoplay universal.

Os listeners genéricos de gesto usam captura, para chegar antes da espera por hidratação. Eles não consomem navegação ou exploração. O botão com `data-entry-audio-toggle` usa seu clique real em captura, até a adoção pelo motor: se bloqueado ou com erro, tenta ativar; se carregando ou tocando, silencia. Esse clique específico é consumido para evitar que o replay de eventos da hidratação aplique uma segunda alternância. Outros elementos `data-audio-control` não ativam som implicitamente.

Um clique antecipado em `.island-enter` registra `entryRequested=true` e `document.documentElement.dataset.entryRequested="true"`, sem alterar nós controlados pelo React. A experiência lê esse pedido ao montar. O bootstrap publica apenas estado e métricas no elemento raiz: `entryAudioStatus`, `entryAudioBootMs` e `entryAudioFirstPlayMs`. Eventos nativos de reprodução, pausa e erro mantêm o estado do elemento atualizado. O primeiro instante de reprodução fica preservado, mesmo após retorno da aba.

## Adoção pelo motor

`ExperienceAudio` chama `claim(this)` e reutiliza o elemento SSR e sua posição. Se já toca, não chama `play()` de novo; se existe uma primeira promessa pendente, espera essa mesma promessa. Não remove o `src`, não chama `load()`, não baixa novamente o MP3 e não reaplica o cue. Bloqueios podem ser repetidos em um gesto novo com o mesmo elemento.

O elemento SSR permanece nativo. `createMediaElementSource` vincula permanentemente um elemento ao contexto que o criou; conectá-lo ao primeiro contexto e fechar esse contexto no cleanup impediria reaproveitá-lo corretamente no StrictMode ou Fast Refresh. O caminho adotado evita essa ligação e aplica 0,68 uma vez no volume nativo. Por isso, enquanto essa faixa toca no player SSR, `music.metered` é **false**: o analisador Web Audio não mede esse player. Estado `playing`, tempo avançando e evento `playing` são evidências de reprodução no navegador, sem se transformarem em medição PCM ou prova de alto-falante físico.

O loop seguinte conserva o preparo e o crossfade de dois segundos. A saída do player SSR recebe uma rampa de volume nativa, cancelável; a próxima reprodução segue o grafo normal já existente. Se houver remount depois dessa transição, o motor conserva a posição atual no elemento SSR reutilizável, sem resetar ao cue. Não existem duas trilhas independentes concorrendo pela entrada.

Mute e aba oculta pausam o elemento. Promessas antigas não podem reativar áudio após cancelamento ou pausar um novo proprietário. Cleanup preserva a intenção do visitante: desmontar um componente não equivale a escolher silenciar. `release()` limpa a promessa antiga, para o próximo motor não herdar um `AbortError` causado pelo cleanup anterior. Os handlers de cada motor são removidos mesmo quando o elemento já pertence ao motor novo. O bootstrap não volta a armar gestos independentes depois da primeira adoção.

Se Web Audio estiver indisponível, rejeitar `resume()` ou ultrapassar seu prazo, uma música nativa que já está tocando continua. A interface pode manter a saída musical ligada; o diagnóstico mantém `status="interrupted"`, erro do contexto/ambiente e `music.status="playing"`. O retorno de aba também retoma o player nativo quando não existe contexto Web Audio. Ao terminar nesse modo, a composição repete no mesmo elemento, sem criar um grafo nem outra cópia. Silenciar continua interrompendo essa saída.

## Verificação

`node --test test/experience-audio.test.mjs`: **79 testes passaram**. Os novos testes executam o script estático numa VM com DOM simulado e cobrem início sem React, metadados, cue, volume único, idempotência, autoplay bloqueado, botão de som, intenção de exploração, abas, promessas atrasadas, adoção sem segundo player/play/seek, StrictMode, reativação, crossfade, cancelamentos e continuidade da música diante de falhas de Web Audio.

Esses testes verificam contratos e sequências de eventos. Não medem o tempo real até o áudio no endereço publicado nem substituem a validação em navegador e a escuta no dispositivo. Esta frente não executou browser, build, commit ou deploy.
