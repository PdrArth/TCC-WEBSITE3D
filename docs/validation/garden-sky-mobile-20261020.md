# Jardim — eventos raros e ajustes móveis

Revisão de 20/10/2026 sobre `e212cda`. O pedido abrange somente eventos raros e acabamento no celular. A identidade e os modelos das sete ilhas, os onze climas com modo automático, as quatro estações, a playlist e as interações existentes permanecem.

## Eventos no céu

O arco-íris surge quando uma frente de chuva, garoa, tempestade ou granizo dura pelo menos seis segundos e o céu abre durante o dia. A abertura pode vir depois de um período nublado, dentro de cem segundos. O arco tem entrada suave, vida de 45 segundos e intervalo mínimo de três minutos entre inícios. Voltar à chuva ou anoitecer reduz sua presença. Não é disparado ao carregar o jardim ou por uma troca muito rápida de clima.

Estrelas cadentes aparecem somente com céu limpo entre 20h30 e 5h. A primeira espera de 28 a 70 segundos de noite elegível; as seguintes esperam de 90 a 170 segundos após a anterior. Cada passagem dura 1,8 segundo, com direção, origem e distância variadas. O modo de movimento reduzido suprime as passagens. Os relógios pausam com a cena inativa e não acumulam eventos para a retomada.

Os dois efeitos compartilham uma única superfície procedural atrás da profundidade das ilhas, sem novas luzes, imagens ou downloads. A superfície fica oculta entre eventos. No navegador, o arco apareceu após chuva real e abertura manual para céu limpo; a estrela foi capturada durante seu intervalo natural. A troca para noite levou a intensidade do arco a zero. Não houve erro de shader ou renderização.

## Celular

A revisão encontrou o mapa sobrepondo parte dos controles em 320 pixels. Mapa, instrução e navegação agora ocupam áreas separadas, respeitando as margens de segurança do dispositivo. Botões do cabeçalho e de navegação têm área de pelo menos 44 × 44 pixels. Na horizontal, as ilhas usam os mesmos marcadores numerados do modo estreito, conservando os nomes acessíveis completos, para evitar a disputa entre etiquetas longas.

O limite de resolução móvel também reconhece telas curtas na horizontal. Em telas pequenas e dispositivos de ponteiro grosso, o mapa de sombras é reutilizado e atualizado até quinze vezes por segundo; a cena, os gestos e a simulação continuam na cadência normal. Abas inativas e painéis mantêm a política de pausa existente. A restauração para desktop recupera a atualização normal das sombras.

Gestos cancelados pelo sistema, perda da captura e saída de foco liberam os ponteiros e consomem um clique residual. Um terceiro dedo não redefine a escala da pinça; ao retirá-lo, a distância de referência é refeita entre os dois dedos restantes. As verificações de estado cobrem a retomada de um novo gesto após cancelamento.

## Verificação e limites

259 testes passaram, incluindo sete novos casos de elegibilidade, duração, intervalo, pausa, movimento reduzido, cadência entre 30 e 120 Hz, sombras, orientação e cancelamento da navegação. O build de produção passou com TypeScript.

Nos viewports 320 × 640, 360 × 740, 390 × 844 e 412 × 915, as medições encontraram dez controles principais com tamanho mínimo de 44 pixels, dentro da tela, sem rolagem horizontal e sem sobreposição entre mapa, navegação e instrução. A cena ficou pronta e informou a política móvel de sombras. O viewport horizontal de 844 × 390 também foi revisado.

Um arraste real no navegador alterou o ângulo da vista de 0,9947 para 0,3513 radiano, sem gerar comida para os peixes. O clique seguinte no botão de aproximação levou o zoom a 1,15. O painel conservou as quatro estações e todos os climas; o modo foto continuou ausente.

O autor usa um S24 Ultra. Não houve acesso físico a esse aparelho: o navegador local permite conferir layout e interação com ponteiro, mas não mede bateria, temperatura, GPU móvel ou gestos reais de múltiplos dedos. Portanto, não há alegação de autonomia ou desempenho medidos no S24 Ultra nem em aparelhos menores.

Evidências locais em `outputs/rare-sky-mobile-20261020/`; logs em `.sites-runtime/rare-sky-tests.log` e `.sites-runtime/rare-sky-build.log`.
