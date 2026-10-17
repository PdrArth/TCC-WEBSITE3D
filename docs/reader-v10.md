# Caderno v10

O CSS anterior acumulava limites de 1180px no shell, 980px no caderno e 780px no artigo/diagramas, além de limitar o wrapper do texto a 65ch. Fontes e navegação herdavam essa coluna estreita. Três paddings finais somavam 150px; a regra `a:last-child` também alinhava à direita o único link de retorno da biblioteca.

`components/research-content/reading-v10.css` aplica-se somente a `main.island-reading[data-reader-layout="v10"]`. Importá-lo em `components/island-experience/index.tsx` depois de `island.css`; o CSS de conteúdo existente deve precedê-lo. Acrescentar `data-direction="previous"` ou `"next"` aos links de `ReadingChapterNavigation`. Nenhum wrapper ou alteração editorial adicional é necessário.

O shell usa até 1400px, com margem mínima de 40–64px em desktop e 20px em celular. Caderno, artigo, figuras, fontes e navegação usam a mesma largura; apenas os parágrafos correntes ficam limitados a 80ch. Texto corrente: 24–26px a partir de 1200px, 19–21px abaixo disso; abertura: 26–32px em desktop e 21px no celular. Um único padding final de 32–40px substitui o acúmulo anterior. A navegação usa duas colunas no desktop e uma em telas estreitas, com direção explícita de cada link.

Validação estática: PostCSS parse passou; 53 regras têm o escopo v10, sem `!important` novo. Larguras calculadas: 1342px com texto de 24px em viewport de 1440px, 1400px com 26px em 1920px e 350px com 19px em 390px; são previsões de CSS, ainda sem medição em navegador.

Checagem de integração: medir shell/artigo/fontes/nav em 1440px, 1920px e 390px; conferir `font-size` e `max-width` computados dos parágrafos, ausência de overflow horizontal, final dos temas 1/7/Fontes, retorno único da biblioteca alinhado à esquerda e posição de scroll ao trocar/restaurar tema. A confirmação visual e de scroll depende do QA de navegador do responsável pela integração. Fontes, textos, `SOURCES.md`, PDF e GLBs permanecem intactos.
