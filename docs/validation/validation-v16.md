# Ajustes de abertura, clima e chuva — v16

Revisão em `G:\site-tcc`, em 15/10/2026, sobre a v15 (`0d64b81a748cfb89aec17578d9e246d6c97d6f2e`). O conteúdo acadêmico, leitura, painéis, PDF, autenticação, D1 e MCP não foram alterados.

## Abertura e rotação dos climas

O GLB leve de 2.767.416 bytes recebe preload na página inicial, antecipando sua transferência ao carregamento do módulo da cena. O manifesto é lido independentemente desse módulo. Foi removida a criação de um contexto WebGL descartável antes do contexto real: falhas do Canvas continuam encaminhadas ao limite de erro e ao acesso alternativo. A imagem de espera e a cena trocam opacidade em 450 ms; movimento reduzido desativa essa transição. A leitura direta, antes de carregar o mundo, não inicia o Canvas; depois de pronto, a leitura pausa a mesma cena e preserva a câmera.

Cada documento reserva um dos dez climas. A ordem é embaralhada uma vez e mantida em um ciclo circular no IndexedDB da origem. Uma transação de leitura e escrita reserva e confirma a posição entre abas simultâneas. Assim, qualquer janela de dez aberturas consecutivas percorre as dez condições sem repetição, mesmo cruzando o fim do ciclo. Entardecer continua sendo horário, não uma décima primeira condição. A reserva é única por documento, inclusive em StrictMode; recarregar ou abrir outra aba reserva a próxima. A configuração manual e as transições ao longo da visita continuam disponíveis.

Sem IndexedDB, a experiência continua funcionando com armazenamento e locks quando disponíveis, mas sem promessa de exclusão entre abas. O diagnóstico informa `transaction`, `locked`, `storage` ou `independent`. Origens, partições e perfis distintos têm ciclos independentes. Nenhuma localização é consultada. A transação só resolve depois de confirmar; falha ou abort não pode se confundir com commit, e uma abertura de banco tardia é fechada.

A primeira rodada real com dez abas usando Web Locks/localStorage retornou somente oito climas únicos (três reservas de posição 8). A causa de plataforma não foi isolada; não se atribui automaticamente a cache ou contexto. Essa versão intermediária foi descartada e substituída por transação IndexedDB. O arquivo `ten-tabs.json` preserva essa falha, sem apresentá-la como teste aprovado.

## Chuva, raios e música

O prefixo pequeno de partículas usado na garoa concentrava trajetórias em um campo quadrado, com z fixo, enquanto o vento deslocava x. Em simulação de 30 s, o centro ficava sem ondulação por até 26,52 s contínuos no caso leve de baixa intensidade. A distribuição agora cobre progressivamente centro e margens do lago. A origem é renovada somente depois da colisão; o impacto consulta `surfaceAt` e conserva ilhas, pontes e contorno real. Os buffers não aumentaram. Cones abertos de seis lados retiram as tampas planas do spray; seu término continua zerando todos os eixos.

As oito posições de raio incluem o lago central e as margens. Primeiro evento em 2–4 s; seguintes em 3,5–7 s, com um decaimento contínuo de clarão e sem repetição rápida de flashes. Movimento reduzido não produz clarões. O áudio aceita a cadência nova, limita duas vozes e descarta eventos pendentes antigos. Não há geração ou decodificação no momento do raio.

Música passa de 28% para 52%; efeitos seguem 10% e ambiente 6%. A composição e o cue de 45,65 s permanecem. Não foi encontrada outra faixa oficial com arquivo e origem de uso documentados nessa pesquisa, portanto não se afirma troca de trilha ou adoção de Liyue. Fontes, testes e análise digital estão em [registro de áudio v16](../audio/audio-v16.md).

## Verificação

Os testes de integração cobrem reservas simultâneas com arbitração, janelas deslizantes entre ciclos, commit/abort do banco, fechamento de abertura tardia, falha de armazenamento, garoa central, superfícies de impacto, fim dos respingos, raios e áudio. A revisão independente identificou uma leitura de ref no JSX; ela foi substituída por state booleano.

166 testes, TypeScript, lint dos arquivos alterados e build oficial passaram. Nenhuma escrita em D1, ativação de agenda ou alteração do texto da pesquisa nesta revisão.

## Conferência final no navegador

A segunda rodada abriu dez abas simultâneas. Todas retornaram `coordination=transaction`, dez posições distintas e os dez climas distintos, inclusive cruzando o ciclo. O registro está em `.sites-runtime/v16-qa/ten-tabs-transaction.json`. As abas foram abertas na leitura direta para verificar a reserva sem executar dez cenas WebGL ao mesmo tempo; todas tiveram zero Canvas e o mesmo título de leitura preservado. Foram fechadas ao terminar. Isso verifica coordenação entre documentos, não desempenho de dez cenas ativas.

O cenário ficou pronto em 3.914 ms na primeira execução local e 2.739 ms na execução seguinte; não é uma comparação controlada de cache frio com a v15. Na rodada final, o GLB iniciou transferência em 199 ms e terminou em 308 ms, antes do início do componente interativo em 408 ms. Manifesto e módulo ficaram disponíveis em aproximadamente 475 ms. A leitura imediata continuou disponível durante o carregamento. Registros: `startup.json` e `startup-transaction.json`.

Garoa: 25 amostras em cerca de 20 s, com pelo menos seis ondulações centrais e cinco nas margens em cada amostra. Os respingos encerraram sem os resíduos quadrados; a captura `drizzle.png` mostra as ondulações também no centro. Tempestade: 55 amostras em 42,9 s, oito novos raios nas oito posições e oito novos trovões agendados. Média das leituras de fps 43,7; mínimo 39. Programas preparados ficaram em 53. Arquivos: `drizzle.json`, `storm.json` e `storm.png`.

Essas amostras foram feitas na dimensão efetiva de 649 × 697 px do navegador integrado. O pedido de override para 1280 × 720 não alterou a dimensão observada, mesmo ocultando a superfície; o override foi removido. Portanto, não se apresenta essa rodada como benchmark de desktop em 1280 px ou de celular emulado. Sem teste em aparelho físico. Persistiu um intervalo máximo de 890,5 ms desde o carregamento inicial; não se afirma eliminação de todas as pausas nem se atribui a origem sem perfil isolado.

Música tocou e avançou com configuração 52%; ambiente permaneceu em 6%. O analisador registrou sinal digital. Isso, as vozes agendadas e os testes de contrato não substituem audição física nem comprovam preferência pela composição. Foram conferidos painel de Validação, link para `#caderno/validar`, pausa do Canvas durante leitura, retorno, outro painel e fechamento por Esc com foco no botão correto. Leitura sem transbordamento horizontal na dimensão observada; console final sem erros. A v15 hospedada fica preservada para reversão.
