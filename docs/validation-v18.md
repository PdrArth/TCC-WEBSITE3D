# Abertura e vida nas ilhas — v18

Revisão de16/10/2026 sobre a v17 (59636dec66fadd151c1c217f069d77808366c965), preservada para reversão. Conteúdo acadêmico, PDF, painéis, áudio, estações, calendário aleatório e backend editorial foram preservados.

## Correção da abertura

O recorte tinha causa confirmada: céu e ilha compartilhavam um Canvas limitado ao retângulo da ilha. Agora um único Canvas cobre todo o viewport inicial. Uma janela de projeção amplia o frustum para a tela inteira e conserva o enquadramento da ilha em sua área anterior, à direita no desktop e abaixo do texto no celular. As nuvens usam a escala do viewport estendido, sem outro Canvas. O poster mantém composição e transparência anteriores; a sobreposição suave conserva a leitura do texto.

Na conferência publicada, a sobreposição de leitura ganhou a mesma quebra de900px do layout empilhado, para não clarear lateralmente a ilha em telas intermediárias. O acabamento foi salvo em uma versão de hospedagem posterior à primeira publicação da v18, sem alteração dos contratos do mundo.

A entrada usa DPR entre0,6 e0,75. A exploração mantém os níveis anteriores. O modelo continua leve e não remonta ao entrar. Há uma oportunidade de pintura entre decodificação e agrupamento das geometrias. A preparação opcional aguarda duas pinturas+1200ms, só avança depois de entrar na exploração e pausa ao ocultar a aba/abrir a leitura. Os itens são compilados sequencialmente, espaçados em pelo menos32ms; todas as variantes foram preservadas.

## Ponte, casa e morador

Uma ponte curva de20,472m fecha Perspectivas(7)→A pesquisa(1), com49 pontos. Os segmentos do mesmo contrato alimentam as superfícies de impacto da chuva/granizo; as amostras não multiplicam as lâmpadas. O manifest registra nós de navegação válidos e o minimapa fecha o circuito. As sete ilhas acadêmicas permanecem as mesmas.

A casa fica na margem leste da ilha da pesquisa. O morador caminha por terra firme, pesca com vara e linha, recolhe fruta junto à jabuticabeira e retorna à casa. A chuva forte e a noite interrompem a rotina com retorno pelo caminho transitável. Janelas acendem ao anoitecer e o telhado acompanha a neve. A simulação pausa durante abertura, leitura, painel, aba oculta e movimento reduzido. Geometrias estáticas são agrupadas; corpo articulado instanciado. Até16 chamadas adicionais, sem luzes ou sombras extras. Recursos próprios procedurais, sem downloads novos ou alteração dos GLBs.

## Ajustes exclusivos do autor

Conforme confirmação do usuário, a pública não apresenta engrenagem, seletor de clima, horário, estação, qualidade ou sliders de áudio. Conserva o controle de som e um painel de créditos. Os ajustes ficam em `/revisao/ilhas`, com `requireChatGPTUser` e `requireOwner` executados no servidor antes do render. A rota pública entrega `showSettings=false` e não aceita parâmetro de URL que habilite ajustes. A tentativa local sem sessão redirecionou para o login; esse endpoint da plataforma não é servido pelo preview local(404 após redirecionar), portanto não comprova login real em nuvem.

## Verificação

190 testes comportamentais, TypeScript, lint dos arquivos alterados e build são os checks finais. Testes incluem projeção nos breakpoints, cancelamento/pausa do preparo, rotina completa do morador, retorno em mau tempo/noite, articulação, pausas, superfícies e consistência do manifest. O teste móvel é emulado, sem aparelho físico. A reprodução musical foi verificada por avanço do HTMLAudioElement desde45,65s, sem audição física.

Capturas reais em `.sites-runtime/v18-before.png`, `v18-opening-final.png`, `v18-mobile.png` e `v18-life.png`. Conferida abertura1280×720 e390×844: Canvas começa em0,0 e cobre o viewport, sem rolagem horizontal. Na pública simulada local, créditos não contêm controles de ajustes. Durante exploração foram observados pesca(11,2s,3,06m percorridos), gestos, abrigo após tempestade e casa/ponte visíveis.

Medições locais de diagnóstico, sem equivalência garantida de cache/clima: v17 observada com compilação primária1661,1ms; v18 inicial1552,8ms e pausa1489,6ms durante preparação. Após segurar preparo opcional até a exploração, reabertura v18: cena pronta1885,8ms, compilação450ms,92fps e p95 de12ms,22 programas e0/272 preparações na abertura. Ainda foi observada pausa inicial380,3ms. Não há alegação de eliminar todas as travadas ou melhorar tempo frio em todo dispositivo. O primeiro download e a compilação da GPU continuam tendo custo.
