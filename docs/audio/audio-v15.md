# Trovão preparado em segundo plano — v15

O primeiro raio deixa de produzir centenas de milhares de amostras no JavaScript da página. `thunder()` apenas agenda um `AudioBufferSourceNode` com o arquivo já decodificado; não chama `createBuffer`, não decodifica, não percorre PCM e não depende de FFmpeg. A chamada continua imediata: o atraso acústico após o clarão permanece sob responsabilidade da cena.

## Recurso próprio e reprodução determinística

- Arquivo: `public/experience/audio/thunder-v15.wav`, 297.644 bytes, 6,2 segundos, mono, PCM inteiro de 16 bits, 24.000 Hz.
- SHA-256: `2950b2e40c4eaf8600eb81bcd2f7e115c2981d63024cc250bfb73f85b6086ace`.
- Autoria: síntese procedural original produzida para o projeto site-tcc. Não é gravação de campo, sample de terceiros ou áudio retirado de uma trilha.
- Gerador: `node scripts/audio/generate-thunder.mjs`. `--check` compara o resultado em memória com o arquivo entregue e informa o hash sem reescrevê-lo. Usa somente recursos nativos do Node.

O gerador conserva as equações da v14: ataque de ruído branco, corpo de ruído filtrado e ondulações de intensidade em uma cauda decrescente. Uma semente fixa substitui `Math.random`. A síntese ocorre offline em 48 kHz, recebe filtro antialias de 63 coeficientes e é reduzida a 24 kHz. O nível RMS de referência é 0,2, com limite de pico em 0,95 e bordas suaves. Filtros Web Audio de 28 Hz e passa-baixas decrescente continuam aplicados na reprodução.

## Preparação e cancelamento

A ativação do áudio inicia um único `fetch` e `decodeAudioData` em segundo plano. A preparação não bloqueia `enable()`, a música ou o ambiente. Um erro HTTP, de rede ou de decodificação, ou o prazo de 15 segundos, marca o recurso como indisponível. Novos raios e novos gestos não iniciam tentativas contínuas; uma nova sessão pode tentar novamente. Se o contexto de áudio for substituído durante uma preparação, sua conclusão antiga não pode sobrescrever a preparação do contexto novo.

Enquanto o arquivo prepara, um raio pode ficar pendente. O evento só toca se o contexto, o clima, o consentimento e a visibilidade continuarem válidos. Eventos com mais de oito segundos são descartados para evitar trovões atrasados que já perderam relação com a cena; a fila é limitada a dois eventos. Mute, aba oculta, mudança de ambiente e volume de ambiente zero cancelam eventos pendentes e vozes ativas. Retomar a aba ou o som não ressuscita um raio cancelado.

Com o recurso pronto, o intervalo de mais de oito segundos aceita todos os disparos da cena separados por 9 a 16 segundos, sem um carregamento ou decodificação por raio. Cada voz libera seus nós ao terminar. O buffer decodificado pode ser reutilizado depois de mute ou troca de contexto.

## Ganho e preservação da música

O trovão usa um bus paralelo, conectado ao analisador geral, com ganho `min(0.6, ambience * 3)`. No padrão de ambiente 0,06, o bus recebe 0,18 e o envelope próprio do efeito chega a 0,55. Chuva, vento e aves continuam no bus de ambiente de 0,06. Música e efeitos de interface mantêm seus buses: realçar o trovão não eleva esses outros sons. Volume de ambiente zero também zera e interrompe o trovão.

A faixa musical original permanece intacta, com volume padrão 0,28, cue de entrada 45,65 s, fade de 150 ms e crossfade de dois segundos no loop. O rótulo segue descritivo, sem afirmar que a composição se chama “Liyue”.

## Diagnóstico e limites da validação

`diagnostics().thunder` informa `status`, `preparationMs`, `error`, `pending`, `active`, `gain` e a contagem acumulada `played`. Os eventos recentes incluem `thunder-preparing`, `thunder-ready`, `thunder-pending`, `thunder-played`, `thunder-cancelled`, `thunder-expired` e `thunder-preparation-error`. `played` indica que uma voz foi agendada; não é prova de som no alto-falante. O analisador geral continua disponível para verificar sinal digital.

Os testes cobrem a estrutura e o hash do WAV, a reprodução exata pelo gerador, o ataque e a cauda do PCM, ausência de síntese/decodificação no raio, isolamento de ganho, sequência de disparos, filas, timeout, falhas e cancelamentos, além das proteções anteriores da música. São testes de recurso e contratos com objetos Web Audio simulados. Ainda é necessário ouvir no dispositivo para avaliar timbre, preferência e equilíbrio perceptivo com a trilha; não se afirma validação de audição física nesta frente.
