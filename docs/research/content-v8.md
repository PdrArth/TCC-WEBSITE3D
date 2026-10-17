# Caderno de leitura v8

O caderno apresenta um tema por vez, na mesma ordem das sete ilhas: pesquisa, ferramentas, produtividade, validação, especificação, profissão e perspectivas. A biblioteca e a metodologia ficam em `#caderno/fontes`, fora da contagem dos sete temas. A navegação superior permanece visível abaixo da barra do leitor; o tema ativo é informado ao shell por `onThemeChange`.

Os hashes canônicos são `#caderno/<id>` para cada tema e `#caderno/fontes` para o acervo. `lib/reading-navigation.mjs` centraliza a resolução dos endereços e os links das ilhas. Os destinos antigos continuam aceitos: `#conteudo` → pesquisa; `#evolucao` → ferramentas; `#produtividade` → produtividade; `#trabalho` → validação; `#papel` → especificação; `#novidades` → perspectivas; `#pesquisa` → fontes. Profissão ganhou o destino próprio `#caderno/evoluir`.

Os sete resumos de ilha e seus parágrafos editoriais permanecem em `components/research-content/editorial-data.ts`. O caderno acrescenta a cada tema seus materiais de apoio: cronologia documental; quatro estudos com contexto, método, medida e limites; Harness Engineering; SDD e seu contraponto; responsabilidades de integração e manutenção; conclusão, perguntas futuras e atualizações publicadas. Método e biblioteca mantêm as 24 referências e suas funções, sem promover anúncios de produto a evidência empírica.

Os visuais são diagramas HTML acessíveis ligados à pergunta de cada tema. A produtividade apresenta os dois resultados em contextos distintos, sem escalas que sugiram comparabilidade. A cronologia preserva os oito marcos e suas categorias; os demais diagramas organizam a investigação, as verificações, a especificação, as responsabilidades e as dimensões para trabalhos futuros. A navegação guarda a posição de leitura por tema na sessão, quando o armazenamento do navegador está disponível.

O teste editorial verifica a sequência, os destinos legados, os IDs das fontes citadas, os grupos de 5 fontes acadêmicas, 6 técnicas e 13 complementares, além de manter validação e profissão em capítulos separados. A edição não altera os registros em `lib/sources.json` nem os parágrafos das ilhas.
