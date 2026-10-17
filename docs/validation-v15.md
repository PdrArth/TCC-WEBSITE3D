# Acabamento das ilhas — v15

Revisão em `G:\site-tcc`, em 15/10/2026. Base: versão hospedada 14, commit `b6edc5009f514f93bec9e56d1c107c3e8ef01ff3`. Escopo aprovado: respingos, distinção dos céus, trovões mais presentes e fluidez. Pesquisa, sete painéis, navegação, PDF e música foram preservados.

## Correções

O erro dos quadrados foi identificado no ciclo das instâncias dos respingos: depois de 0,3 s, a altura chegava a zero, mas os outros eixos continuavam aumentando. Isso achatava as bases dos cones sobre o lago. Agora os três eixos são zerados ao encerrar o respingo; o anel circular continua seu próprio desvanecimento de 1,35 s. Não são criados objetos por impacto.

As nuvens suaves ficam dentro da faixa superior da câmera, acima dos pavilhões, com contraste e sombreamento próprios. Céu limpo não tem agrupamentos; entre nuvens usa quatro e nublado usa oito, com maior cobertura. O material de fundo não recebe a neblina global que antes reduzia sua visibilidade. Órbita e zoom continuam disponíveis.

O trovão tem recurso próprio gerado antecipadamente: WAV mono PCM16/24 kHz, 6,2 s e 297.644 bytes. `AudioManifest.thunder` é opcional. O carregamento/decodificação começa ao ativar áudio, em segundo plano, e o raio reutiliza o buffer. Não há mais geração de PCM no momento do evento. Seu bus recebe `min(0.6, ambience * 3)`; no padrão, 0,18, enquanto chuva/aves permanecem em 0,06. Música segue em 0,28 e cue 45,65 s. Mute, ambiente zero, aba oculta e saída do clima invalidam trovões pendentes. Arquivo, autoria, hash, timeout e diagnóstico estão em `docs/audio-v15.md`.

O primeiro raio conserva 3–6 s; os seguintes usam 9–16 s, com atraso sonoro de 0,28–0,78 s. Movimento reduzido não produz clarões. O modo automático mantém o modelo leve e não promove geometria durante a exploração; Detalhada é uma escolha manual.

## Preparação e diagnóstico de fluidez

O mundo principal é compilado primeiro. Depois, uma fila cancelável prepara materiais por objeto e por configuração de iluminação, em oportunidades ociosas. As cenas auxiliares contêm apenas luzes clonadas e referências ao fog/environment; objetos originais nunca são reparentados. As variantes diurna/noturna são preparadas sem manter as luzes noturnas contribuindo no custo do render diurno. O sol conserva sombras. A fila é cancelada nas trocas de mundo/qualidade e na desmontagem.

A tentativa intermediária de manter todas as luzes sempre no grafo, ainda com intensidade zero, apresentou cerca de 33 fps na tempestade. Ela foi substituída pela preparação das duas variantes. Isso é evidência de uma alternativa inadequada neste equipamento, não uma medição isolada de tempo GPU por luz.

O diagnóstico registra intervalos entre quadros acima de 50 ms, máximo e oito eventos recentes com clima, fase, câmera e proximidade de raio. Ele conserva intervalos acima de 250 ms, que não entravam no p95 antigo. Pausas de leitura/visibilidade e mudanças do modo de renderização desarmam a amostra inicial da retomada. Esses números não são tempo exclusivo de execução do render nem identificam causalidade por si.

## Evidência no navegador

Navegador integrado, viewport de 1280 × 720, qualidade automática leve. Tempestade final ativa por aproximadamente 171 s, com 111 amostras em três blocos, separados por breves intervalos de inspeção. A média das leituras de fps foi 41,9, mínimo 32 e máximo 54. Não é um benchmark de 120 segundos uniformemente amostrados nem comparação controlada com toda a v14.

Foram registrados 14 raios e 14 vozes de trovão agendadas, com recurso já `ready` e ganho de bus 0,18. A preparação sonora levou aproximadamente 1.402 ms em uma execução local. A contagem de programas permaneceu em 53, inclusive na passagem dia/noite/dia depois da preparação. A fila final completou 240/240 trabalhos.

Persistiram intervalos longos: até 300,8 ms no contexto da tempestade/entardecer. No primeiro raio dessa execução houve 69 ms. Após um recarregamento, durante a preparação inicial em céu limpo, foi registrado um intervalo de 933,7 ms. Não foi isolada a origem desses intervalos; não é correto afirmar que a revisão eliminou todas as travadas, nem atribuí-las automaticamente ao áudio ou shaders. A geração síncrona do trovão e a troca automática de GLB foram removidas como fontes de trabalho pontual conhecidas.

Garoa foi conferida de perto e de longe sem os quadrados; as ondulações permanecem. Céus claro, entre nuvens e nublado foram comparados no mesmo enquadramento, com movimento reduzido para fixar a câmera. Neve e gelo chegaram a 1,000 e, depois de selecionar céu limpo, começaram a cair gradualmente (0,971/0,979 na primeira leitura). A iluminação noturna e o feixe do farol continuam visíveis.

Percorridos os sete painéis por Próxima ilha, ESC e leitura do tema correspondente. Em 390 × 844, o painel ocupou 390 px, o foco entrou no título e não houve transbordamento horizontal. O caderno abriu `#caderno/validar`, preservou o título correto e pausou a cena. É emulação, sem prova de desempenho em aparelho físico. Mute e o estado de reprodução foram conferidos no navegador; os casos de ocultação real da aba e autoplay bloqueado também têm testes de contrato, pois o navegador integrado não reproduz todos os comportamentos de uma aba física.

Capturas/dados locais em `.sites-runtime/v15-qa/`: `before-drizzle.png`, `after-drizzle.png`, `before-partly-cloudy.png`, `after-partly-cloudy.png`, `after-clear.png`, `after-overcast.png`, `night-final.png`, `mobile-panel.png`, `storm-final.png` e `storm-final-performance.json`. A gravação intermediária `storm-fixed-lights-performance.json` registra a alternativa substituída. As capturas são reais do navegador; algumas pertencem à primeira compilação visual, com o mesmo conserto de respingos e antes do ajuste final de contraste/altura das nuvens.

## Verificação e integridade

151 testes passaram. TypeScript, ESLint dos arquivos alterados e build oficial passaram. A revisão independente conferiu a API local do Three, os ciclos de cancelamento e as variantes de iluminação. Não houve alteração editorial ou escrita no D1 nesta revisão. PDF permanece com SHA-256 `59d208f910c5cec1bb951025a9d643e11e33f82e8dea86ec7c6e2105b96fe257`; música original mantém `c901aa711353f467a392db4cb95f66a708779808973eca87018b36ba3ca23cf6`.

O teste de áudio confirma preparação, agendamento, saída digital e cancelamentos; timbre e equilíbrio no alto-falante dependem de audição física. A versão 14 hospedada será mantida para reversão da publicação.

Na conferência digital adicional, a música foi temporariamente zerada e o analisador registrou pico de 0,06292236 e RMS de 0,02101873 durante a tempestade, com contexto em execução e novo trovão agendado. O registro está em `audio-digital-check.json`; não substitui audição física. Os controles foram restaurados para música 28%, ambiente 6%, efeitos 10%, animações completas e clima automático. A troca manual Detalhada → Automática voltou ao cenário leve; o console final da prévia não apresentou erros.
