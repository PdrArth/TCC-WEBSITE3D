# Validação da experiência v9 — 12/10/2026

## Entrega

Jardim com sete ilhas preservadas, vegetação própria refeita e imagens renderizadas do modelo final. A entrada tem acesso direto à leitura e giro suave; arrastar permite orbitar, os controles aproximam e restauram a câmera. Água, seis peixes, folhas, flores, nuvens e aves se movem. Os pássaros pousam e se abrigam com precipitação forte ou à noite.

A música de Genshin toca pelo áudio nativo dentro da aplicação. Há uma faixa instrumental original do site oficial, com atribuição e condições registradas em `audio-v9.md`; não é uma seleção de vários álbuns. O navegador integrado bloqueou o primeiro autoplay sem gesto e permitiu reprodução no primeiro clique, ainda na entrada. O tempo da música avançou e o bus exclusivo apresentou sinal positivo. Essa verificação é digital e não testa os alto-falantes físicos do visitante. Silenciar permanece válido ao entrar nas ilhas, e tentativas atrasadas não podem religar o som.

Geolocalização, consulta por cidade e seus endpoints foram removidos. O cenário possui clima aleatório, escolhas manuais, estações e relógio próprio: um dia completo leva cerca de 12 minutos, independentemente da troca de clima. Noite e entardecer mudam luz, céu e contraste. Neve, granizo e chuva congelante são efeitos ilustrativos.

Os resumos usam imagens pequenas, corpo maior, fontes recolhidas e navegação alinhada, sem o retorno duplicado da primeira ilha. O caderno tem navegação superior, tema atual e texto de 22 px no desktop; o CSS prevê 19 px em telas pequenas. As 11 fontes centrais, 13 complementares e o PDF acadêmico foram preservados.

## Conferência no navegador integrado

- Entrada: rotação medida pelo avanço do ângulo; água e posição dos peixes avançam também. O carregamento da cena e do manifesto ocorre em paralelo, com imagem estática e leitura disponíveis enquanto isso acontece.
- Arrastar: alterou giro e inclinação sem abrir card por acidente. Aproximar e restaurar voltou a giro 0, inclinação 0 e zoom 1.
- Sete temas: navegação sequencial chegou a cada ID, carregou as sete thumbnails de 512 px e focou o título de cada resumo. O link de Perspectivas abriu `#caderno/perspectivas` com imagem final de 1200 px. Trocar de tema no caderno atualizou título, endereço e indicador.
- Escape: fechou o resumo e devolveu o foco ao botão da ilha de origem. Retorno do caderno reativou a cena.
- Neve: partículas visíveis, opacidade 0,900 e chuva zerada. Granizo: pedras pequenas, opacidade 0,950 e contador de colisões avançando. Tempestade: posições da chuva e impactos avançaram; ocorreram raios ramificados em alvos reais de pedras na margem. O evento breve de raio não foi capturado em uma imagem isolada.
- Movimento reduzido: ambiente continuou em ritmo calmo de 20 Hz, com água e peixes avançando e câmera parada. Os testes verificam que não há flashes nesse modo.
- Erro real de modelo: a prévia de falha retornou 404 para o GLB; os resumos e o caderno continuaram acessíveis sobre a imagem estática.
- API local: novidades retornaram somente a consulta pública; a área editorial anônima retornou 401. Os endpoints de clima e cidades removidos retornaram 404. Nenhum dado de produção foi escrito por testes.

Capturas comparativas ficam em `.sites-runtime/v9-qa/`: `00-entrada-antes.jpg`, `02-navegacao-antes.jpg`, `06-entrada-v9.jpg`, `07-card-final.jpg`, `08-navegacao-final.jpg`, `09-caderno-final.jpg`, `10-tempestade.jpg`, `12-neve.jpg`, `13-falha-modelo-leitura.jpg`, `14-granizo.jpg`, `15-por-do-sol.jpg` e `16-noite-entrada.jpg`. A abertura será registrada novamente no endereço publicado.

## Verificação técnica e limites

99 testes passaram, além de TypeScript e ESLint. Os verificadores de assets confirmam Draco, hashes, cores por vértice, preservação de sete pavilhões/seis pontes e enquadramentos com projeção Three.js em desktop e portrait. Cenário detalhado: 5.190.640 bytes; leve: 2.767.416; poster: 112.394. Os GLBs têm 95 meshes e 335 primitivas, abaixo das 339 da versão anterior.

No navegador integrado, com viewport real de 1280×720, o cenário final registrou aproximadamente 86 fps com clima calmo e 69 fps com granizo, com cerca de 678–683 draw calls na qualidade detalhada. São amostras locais, não promessa de desempenho em todos os equipamentos. A versão leve e a qualidade automática continuam disponíveis.

A API de emulação aceitou 390×844, mas o documento permaneceu em 1280×720, inclusive após recarregar e em uma aba nova. O override foi removido. Portanto, não foi possível comprovar visualmente o layout de celular nesta rodada; CSS responsivo e projeções portrait foram conferidos, mas não substituem navegador ou aparelho físico. Não houve teste físico de toque, alto-falantes ou hardware móvel. A composição continua ornamental e estilizada, sem afirmar realismo fotográfico ou identificação botânica exata.

## Preservação e reversão

Autenticação, D1, revisão privada e MCP mantêm seus contratos. Nenhum agendamento foi ativado. O PDF mantém SHA-256 `59d208f910c5cec1bb951025a9d643e11e33f82e8dea86ec7c6e2105b96fe257`.

A publicação anterior permanece salva como versão 10, commit `4b713d9f18d6dde3e77499ae6b8341dd6a75edac`. Os assets v8 não foram sobrescritos. O pacote novo é produzido pelo workflow oficial do Sites a partir do mesmo commit enviado ao repositório.
