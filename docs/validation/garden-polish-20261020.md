# Jardim — cumprimento, ondas e variedade da pesca

Revisão de 20/10/2026 sobre `e666021`. Os modelos das sete ilhas, seus conteúdos, os climas, as quatro estações e a playlist permanecem intactos.

## Morador

O cumprimento agora pausa o avanço do trajeto e das passadas, gira o corpo suavemente para a câmera, acompanha sua altura com a cabeça e só então levanta o braço. Ao terminar, retorna à orientação do caminho e segue da mesma posição. Há um cumprimento inicial quando o visitante entra e o morador está disponível. O clique e a aproximação conservam intervalo entre repetições. Sono, interior da casa, assentos, pesca, rega e coleta têm prioridade; chuva ou chegada da noite interrompem o gesto para seguir a rotina de abrigo.

## Água e chuva

Os anéis de toque têm maior largura e contraste, raio de até 1,65 metro e duração de 2,4 segundos, com um segundo anel atrasado. Os vértices acompanham a ondulação e são desenhados depois da água transparente, mantendo teste de profundidade. A verificação de margem, gelo, gesto de arraste, limite de frequência e pool de oito toques foi preservada.

A ondulação do lago ganhou relevo e contraste nas cristas, proporcionais ao vento. A amplitude máxima é 0,142 metro; mesmo somada à subida máxima do reservatório, permanece abaixo da ilha mais baixa. O congelamento continua amortecendo o movimento. A chuva procedural recebeu um multiplicador de ganho de 0,75, sem alterar vento, aves, cachoeira, trovões, efeitos ou volume da música.

## Pesca

As oito posições seguras existentes — sete margens e a ponte — são escolhidas sem reposição. Cada visita considera as opções próximas pelo caminho real, com variação entre elas, para reduzir travessias desnecessárias. Não repete o último ponto, inclusive entre ciclos. A primeira parada continua perto da casa; esperas e resultado das seguintes variam. Há tentativas sem peixe. A escolha e o resultado são conservados quando o morador precisa se abrigar e depois retorna. A semente muda em cada montagem da cena; testes usam sementes fixas para reprodução.

## Validação

248 testes e o build de produção, incluindo TypeScript, passaram. Os testes verificam posição e passadas imóveis durante o cumprimento, orientação antes do aceno, retomada sem salto, entrada, prioridade de tempestade e coleta, dois ciclos de pesca, cobertura dos oito pontos, variação por semente e retomada da pesca após abrigo. Os testes anteriores de chão, pontes, móveis, casa, cama, fauna, clima e estações continuam passando. O limite de duração do ciclo completo foi ampliado de 450 para 600 segundos para acomodar os destinos variados.

No navegador local, o cumprimento inicial foi registrado. Um clique real no morador levou a contagem a dois cumprimentos e confirmou a pausa, a orientação e o aceno, com captura em `outputs/garden-polish-20261020/01-greeting.png`. Toques reais ativaram os dois anéis, registrados em `02-water-ripples.png`. A rotina avançou por outros pontos de pesca e manteve o retorno noturno. Os controles conservam todas as estações e opções de clima. A validação digital não substitui escuta em fones ou medição de desempenho em celular físico.

Logs locais: `.sites-runtime/resident-waves-all-tests.log` e `.sites-runtime/resident-waves-build.log`.
