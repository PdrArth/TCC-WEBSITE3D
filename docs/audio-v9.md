# Áudio da entrada — v9

A versão ativa usa uma faixa instrumental original disponibilizada pelo site oficial de Genshin Impact. Não há iframe oculto, extração do YouTube ou abertura de outra aba. Não foi possível confirmar o título musical pelo arquivo, que não contém tags de identificação; a interface usa o rótulo descritivo “Genshin Impact · tema instrumental oficial”, sem atribuí-la a Liyue. A seleção atual tem uma faixa, repetida com transição; não é uma seleção aleatória de várias músicas nem o álbum completo.

- Página de origem: https://genshin.hoyoverse.com/en/home
- Recurso indicado pelo módulo público da página: https://genshin.hoyoverse.com/_nuxt/medias/video-bgm.532ef479.mp3
- Duração original: 188,352 s. Arquivo: 3.013.665 bytes.
- Condições: https://www.hoyolab.com/article/143107, item 2, conferido em 12/10/2026 no conteúdo da API pública oficial do HoYoLAB. A orientação contempla uso pessoal não comercial com declaração de direitos, sujeito à retirada pelo titular. Esta aplicação é pessoal, acadêmica, sem anúncios ou cobrança; essa é a interpretação adotada para o uso, sem afirmar aprovação individual da HoYoverse.
- Créditos e declaração de independência ficam nas opções. A origem, condições, data e SHA-256 do arquivo estão em `public/experience/audio/audio-manifest.json`.

O site tenta iniciar a música na entrada. Quando o navegador bloqueia o autoplay, o primeiro clique ou Enter/Espaço tenta novamente dentro do gesto. Os controles de som não recebem uma segunda ativação automática. Silenciar permanece válido ao entrar nas ilhas. Uma tentativa manual pendente não é reiniciada por outros cliques. Música, efeitos e ambiente usam buses separados; padrão 28%, 10% e 6%, respectivamente. A aba oculta pausa a saída.

No navegador integrado, a reprodução foi confirmada na entrada por estado `playing`, avanço do tempo e sinal medido no bus da música. Isso verifica a saída digital; não verifica alto-falantes físicos do visitante. O primeiro carregamento sem gesto foi bloqueado nesse navegador, como previsto.
