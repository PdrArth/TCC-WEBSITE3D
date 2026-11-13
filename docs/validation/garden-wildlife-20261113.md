# Animais, ninhos e vento — 13/11/2026

## Pedido e resultado

Patos continuando ativos na chuva, patos/tartarugas/caranguejos transitando entre água e margem, tartarugas menores, folhagem animada entre estações, vento mais evidente nas árvores e ninhos com ovos.

- A antiga regra coletiva de abrigo por vento forte foi removida do movimento do lago. Chuva e tempestade mantêm os animais em movimento; gelo e noite reduzem o ritmo. Cada animal faz suas próprias pausas curtas ao chegar à terra.
- Rotas contínuas ligam trechos de água e terra, verificando canteiros, troncos, pontes e margem. Os caranguejos caminham de lado e entram no raso. Tartarugas usam escala 0,72/0,76, ante 1,08/1,18.
- Alturas em terra seguem o leque de triângulos do solo original, com validação contra as duas malhas GLB; entrada e saída da água interpolam a altura. Patos ganharam pés articulados.
- Um ninho de palha fica na margem interna da ilha Pesquisa. O ninho das aves continua na jabuticabeira dessa ilha. Ovos surgem apenas durante a presença de um adulto, com revelação gradual, intervalo entre posturas e limite de três por ninho.
- Galho, ninho e poleiros compartilham a transformação da árvore. Aves em repouso acompanham o poleiro em movimento e fazem novas visitas ao ninho.
- Rajadas ampliam o balanço das copas; a folhagem adicional interpola cor e densidade por espécie entre as quatro estações. Geometria e quantidade de folhas continuam limitadas, com desenho por instâncias.
- A adaptação de qualidade pode esconder o quarto pato sem recriar rotas, posturas ou ovos.

## Escopo preservado

Sete ilhas e seus modelos, onze climas mais automático, quatro estações, música, ações do personagem, pesca, alimentação de peixes, leitura e descobertas. A interface de acessibilidade removida no pedido anterior não foi reintroduzida.

## Verificação

- Suíte Node: 285 testes aprovados, incluindo continuidade no desembarque, atividade sob chuva/tempestade, tempo independente de FPS, ninhos finitos e aterrissagem sobre o solo real nas duas qualidades.
- TypeScript sem erros. ESLint dos arquivos alterados sem erros; quatro avisos anteriores de dependências em `scene.tsx`.
- Navegador local: abertura limpa; patos andando/nadando sob tempestade, posições mudando entre amostras; ninho se movimentando com a árvore; ovos observados nos dois ninhos; controles de clima e estação preservados. Mudanças de ambiente não interrompem o relógio dos animais.
- O navegador pode limitar quadros quando fica em segundo plano. A verificação não mede aquecimento ou bateria de celular físico.

- Build de produção do Next.js concluído com geração das páginas e checagem de tipos.

Entrega pelo fluxo existente `main` → GitHub → Vercel, mantendo o domínio público e a configuração de hospedagem.
