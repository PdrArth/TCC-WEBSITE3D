# Filhotes e cuidado dos ninhos — 13/11/2026

## Comportamento

- Cada ninho tem duas posições fixas de ovos e uma única ninhada por sessão. O limite é de dois patinhos e dois passarinhos adicionais; o crescimento não cria novos animais.
- Os ovos surgem durante a permanência do adulto, são incubados apenas com sua presença e se abrem gradualmente. As metades da casca desaparecem enquanto o filhote aparece.
- O pato permanece no ninho até os dois patinhos estarem prontos para acompanhá-lo. Depois eles percorrem a mesma rota segura entre água e margem, com distância entre os corpos.
- O passarinho adulto cobre ovos e filhotes pequenos mesmo na chuva, com movimentos de respiração e cabeça. Chuva, mudança de horário, cliques e convite para o ombro não o fazem abandonar a ninhada. Os outros pássaros mantêm seus próprios deslocamentos e abrigos.
- Os filhotes de pássaro ficam na copa, ensaiam as asas e só iniciam voos quando amadurecem e o clima permite. O adulto permanece até ambos iniciarem essa fase.
- Tempos cênicos: incubação de 32 segundos, abertura de quatro segundos e crescimento de 180 segundos, contados pelo relógio ativo da simulação. Os passarinhos aguardam ao menos 60 segundos após nascer para o primeiro voo. Não são tempos biológicos reais.
- Os patos acompanham a altura das ondas com parte do corpo submersa; as patas ficam ocultas na água e a caminhada surge gradualmente na margem. Gelo acumulado não coloca os animais caminhando sobre água aberta.

## Preservação e custo

As sete ilhas, os onze climas mais o automático, as quatro estações, a música e as atividades existentes foram preservados. Não há mudança na composição das ilhas. Os filhotes reutilizam as malhas instanciadas dos adultos, sem novos modelos externos ou luzes. As cascas usam duas metades compartilhadas e quantidade fixa.

## Verificação

- 288 testes Node aprovados. Cobrem incubação com adulto, continuidade da eclosão, crescimento e limite de população, chuva e tempestade, cuidado do ninho apesar de interação, primeiro voo condicionado ao clima, pés ocultos na água, flutuação, rotas seguras e transição contínua na margem.
- TypeScript e ESLint dos arquivos alterados aprovados.
- Prévia local respondeu HTTP 200. No navegador, o cenário carregou e o painel conservou todos os climas e estações. Foi observada incubação na chuva com o adulto presente; as posições dos outros patos continuaram mudando.
- Limite da conferência visual: a ferramenta de automação encerrou o acesso ao tentar ativar a janela nativa, pois não conseguiu confirmar seu endereço. O ciclo completo de eclosão e crescimento foi validado na simulação automatizada, mas não acompanhado visualmente até o final nesta rodada.
- Build de produção do Next.js aprovado, incluindo checagem de tipos e geração das páginas.

Entrega pelo fluxo existente `main` → GitHub → Vercel, mantendo o domínio público. O estado da implantação é conferido para o commit enviado; a limitação da conferência visual acima continua válida.
