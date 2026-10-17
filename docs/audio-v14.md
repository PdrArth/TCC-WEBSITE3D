# Áudio da entrada e trovão — v14

A faixa continua sendo o arquivo instrumental proveniente do site oficial de Genshin Impact, descrito na v9. O rótulo permanece “Genshin Impact · tema instrumental oficial”: o arquivo não identifica o título da composição, e não há atribuição a “Liyue”. A v14 não baixa outra música, não usa YouTube e não corta nem substitui o MP3.

## Cue de entrada

`startAtSeconds: 45.65` consta no catálogo síncrono e no manifesto público. É uma posição de reprodução no original de 188,352 segundos, e não uma cópia editada. O SHA-256 conferido nesta alteração é `c901aa711353f467a392db4cb95f66a708779808973eca87018b36ba3ca23cf6`; o arquivo conserva 3.013.665 bytes.

O cue foi escolhido por análise do PCM local com o FFmpeg: após a queda de energia entre 44 e 45,6 segundos, há um novo ataque a partir de aproximadamente 45,7 segundos e um aumento mais forte por volta de 46,1 segundos. Em janelas mono de 100 ms, o RMS é aproximadamente -51,9 dBFS em 45,6 s, -36,5 dBFS em 45,7 s e -28,5 dBFS em 46,1 s. Entrar em 45,65 s e concluir o fade de 150 ms em 45,8 s evita cortar esse ataque mais forte. Este é um critério técnico para entrar depois da passagem inicial; a análise de energia, sozinha, não identifica o título nem confirma perceptualmente uma frase melódica integral. Essa preferência musical ainda pede audição pelo autor.

A janela de um segundo iniciada no cue mede -32,02 dBFS RMS e pico de 0,100326; os primeiros 150 ms já medem -38,24 dBFS RMS. Portanto o cue não introduz um segundo de silêncio. Para comparação, o primeiro segundo do arquivo mede -103,70 dBFS RMS, praticamente silêncio. Essas janelas foram decodificadas a 48 kHz e analisadas em memória, sem criar um arquivo de música derivado.

O construtor pré-carrega um único elemento com `preload="auto"`. Quando chegam os metadados, posiciona o cue silenciosamente. Não cria `AudioContext`, não conecta saída nem chama `play()` durante esse preparo. `enable()` continua realizando os pedidos sensíveis à ativação no gesto de entrada. O elemento preparado é reutilizado, evitando um segundo carregamento ao entrar.

O cue só é destinado à primeira reprodução bem-sucedida da sessão. Se o navegador bloquear a primeira tentativa, um novo gesto ainda pode retomá-lo. Depois disso, mudanças de clima, abertura de conteúdos, retorno da aba e reativação após silenciar preservam o tempo do player. O loop seguinte começa no início do arquivo e mantém o crossfade de dois segundos. O fade curto de entrada e retomada não altera o crossfade do loop. Promessas antigas de reprodução continuam sem poder restabelecer som após mute ou descarte.

## Trovão

`thunder()` mantém execução imediata; o controlador visual pode atrasar essa chamada para representar a distância entre clarão e som. O limite permanece em mais de oito segundos entre disparos, apenas em tempestade e granizo.

O ruído de vento deixou de ser reutilizado como trovão. O efeito agora tem um buffer sintético próprio de 6,2 segundos: ataque curto de banda mais ampla, corpo grave com variações de intensidade e cauda decrescente. Um filtro remove frequências abaixo de 28 Hz, enquanto o passa-baixas fecha de 1.800 para 135 Hz. O ganho próprio chega a 0,55 e segue para o bus de ambiente; ele não passa pelo volume de efeitos de interface nem altera a música. O padrão de ambiente de 6% mantém esse ganho separado e reduzido em relação à trilha de 28%.

## Verificação

Os testes de áudio cobrem preparo sem som/contexto, metadados atrasados, seek único, tentativa bloqueada, fade de 150 ms, preservação de posição, mute e promessas atrasadas, crossfade, isolamento do ganho e amostras finitas e limitadas do trovão. Eles verificam contratos e aritmética com objetos simulados. A medição digital no navegador e a audição física são verificações adicionais; os testes não afirmam qualidade perceptiva ou volume dos alto-falantes.
