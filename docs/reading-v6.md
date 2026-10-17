# Leitura e conteúdo da pesquisa

Cada ilha apresenta uma síntese do TCC antes do aprofundamento. A leitura é livre: o argumento, a ilustração e as fontes permanecem disponíveis sem questionários, respostas corretas, pontuação ou registro de conclusão. O caderno mantém as evidências, a cronologia, o método, a biblioteca e o PDF.

## Hierarquia e legibilidade

O corpo usa 20px em telas maiores e 18px no celular, com entrelinha de 1,65 e parágrafos limitados a 60ch. Títulos maiores, introduções breves e espaço entre os argumentos estabelecem a hierarquia. Fontes e detalhes acadêmicos continuam legíveis; a tipografia menor fica reservada a autoria, datas e legendas.

O [GOV.UK Design System](https://design-system.service.gov.uk/styles/type-scale/) usa 19px como tamanho de corpo em sua escala atual. Sua orientação sobre [parágrafos](https://design-system.service.gov.uk/styles/paragraphs/) distingue uma introdução maior do texto principal e recomenda uso restrito do corpo menor. Essas referências apoiam a decisão de ampliar o texto da versão anterior; os valores finais seguem o pedido do autor e a composição deste site.

A [orientação da W3C para apresentação visual](https://www.w3.org/WAI/WCAG22/Understanding/visual-presentation.html) descreve linhas de até 80 caracteres, texto sem justificação e espaço suficiente entre linhas. A escolha de 60ch busca uma coluna mais curta. Essa medida é uma decisão de projeto, não uma exigência exata da WCAG, e não representa certificação de acessibilidade.

## Conteúdo e fontes

As sínteses foram conferidas contra `SOURCES.md` e os capítulos revisados do TCC. Os resultados de Peng, Becker, Stray e Chen preservam seus contextos e métricas. Os percentuais não são combinados. SDD permanece uma proposta conceitual emergente; Harness Engineering permanece um apoio técnico, sem lhes atribuir ganhos de produtividade medidos em outros estudos.

O núcleo continua com onze fontes: cinco acadêmicas e seis técnicas, críticas ou jornalísticas. Os treze documentos complementares apoiam a cronologia e os trabalhos futuros. As 24 referências continuam consultáveis em três grupos. Nenhum arquivo acadêmico foi alterado.

## Imagens e navegação

As ilustrações usam os renders das próprias ilhas em `public/experience/editorial`, associados aos quatro argumentos. As legendas expressam a relação conceitual; os renders não representam dados empíricos. O componente mantém um fallback para o poster local da experiência caso um render não esteja disponível.

Os resumos incluem acesso à seção correspondente do caderno e ao PDF. As âncoras existentes foram preservadas, assim como a biblioteca com busca por título, autoria, ano e contribuição. O aprofundamento usa controles nativos de detalhes, sem exigir que o leitor percorra atividades para desbloquear texto.

## Validação

A revisão de código e o lint local verificam os componentes desta entrega. A inspeção de layout, foco, rolagem, imagem e tamanho efetivo em desktop e celular deve ocorrer na validação integrada da experiência.
