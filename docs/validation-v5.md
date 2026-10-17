# Expedição pela pesquisa — 11 de outubro de 2026

## Entrega

Entrada única por «Entrar na ilha», que inicia a música no gesto do visitante. A playlist local contém Sudo, Boy e Baguira, de Kounine: as mesmas faixas publicadas com licença CC0 no repositório oficial do portfólio de Bruno Simon. Proveniência, commit, hashes e licença estão em asset-credits.md. A faixa inicial varia pela janela de três minutos; o áudio não muda no meio da faixa. Apenas a faixa em uso é transferida. As três somam 18.885.120 bytes. Os navegadores ainda podem impedir áudio anterior ao primeiro gesto.

O movimento agora começa ativo, com controle visível para reduzi-lo e opção de seguir a preferência do dispositivo. Pássaros, chuva e personagem usam o tempo efetivamente transcorrido, inclusive quando o navegador limita a frequência de quadros. Há três ilhotas de cenário, sem acessos fictícios. Sol, entardecer, chuva, tempestade e tornado distante compõem uma sequência automática: tempestade vem após chuva e tornado é raro após tempestade. Raios e trovões têm intervalos; flashes ficam desativados com movimento reduzido. O clima é uma simulação artística, não meteorologia real.

Os quatro pavilhões oferecem atividades ilustrativas: construir uma especificação, percorrer oito marcos documentados, interpretar quatro recortes de estudos e organizar responsabilidades após a geração. As descobertas aparecem no mapa durante a sessão; recarregar a página reinicia esse progresso. Aprofundamento e fontes continuam disponíveis sem exigir concluir atividades. A leitura completa é contínua, com sumário lateral no desktop e fixo horizontal no celular.

## Verificações realizadas

- 40 testes Node passaram: fontes, autorização, navegação, câmera, animação do esqueleto real, clima, assets e oito cenários de áudio. Os cenários de áudio incluem a seleção da playlist, avanço somente ao fim da faixa, mute, falhas, visibilidade e limites do trovão.
- TypeScript, ESLint e git diff --check passaram. O ESLint ignora somente os decodificadores Draco gerados por terceiros, além das exclusões anteriores; esses arquivos não foram alterados.
- No navegador integrado, desktop 1280 × 720: entrada, áudio ligado após o gesto, mute, os quatro percursos e atividades concluídas, mapa 4/4, troca de destino Gerar → Validar, retorno, ESC, foco devolvido, teclado na cronologia e tela cheia entrar/sair.
- Corrigidos e verificados foco e rolagem ao avançar nas atividades Especificar, Gerar e Validar. A seleção por setas da cronologia preserva foco na aba.
- Observados pássaros em posições diferentes, Walk durante deslocamento, chuva e tornado visível. A sequência automática mudou de tornado para chuva sem intervenção. Movimento reduzido abre o conteúdo diretamente.
- Leitura contínua, âncoras antigas, foco no título, busca de fontes e grupo de 13 complementares funcionaram. Em 390 × 844 emulado: painel inferior legível, avanço de atividade, leitura, sumário fixo e mute no cabeçalho, sem excesso horizontal da página. O tamanho foi restaurado após o teste.
- Uma amostra desktop sob tempestade registrou 64 fps, 308 draw calls e 819.820 triângulos. É uma amostra do computador usado, não benchmark nem garantia para dispositivos móveis. Console sem erros no percurso inspecionado.

## Evidências e limites

Capturas locais em `.sites-runtime/v5-qa`: 01-before.png, 02-panel-before.png, 03-reading-before.png, 05-map-complete.png, 06-reading.png, 07-weather-tornado.png, 08-mobile-activity.png, 09-mobile-reading.png e 10-panel-final.png. A captura 04 é intermediária e não representa o acabamento final.

A inspeção do portfólio de referência alcançou sua abertura 3D; o restante foi estudado no código oficial, sem alegar auditoria integral da experiência. Não houve teste em celular físico nem escuta por fones/alto-falantes de uma reprodução completa. Falha de modelo e perda de WebGL não foram forçadas novamente nesta revisão; os caminhos de alternativa e os assets anteriores permanecem.

O build de produção e o empacotamento são executados pelo fluxo oficial do Sites antes do salvamento da versão. A v4 fica disponível para reversão. PDF original, 11 fontes centrais, 13 complementares, dados acadêmicos, autenticação, D1 e MCP permanecem preservados. Nenhum agendamento foi ativado.
