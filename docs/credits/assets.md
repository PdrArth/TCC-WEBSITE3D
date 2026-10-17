# Créditos e histórico dos recursos

## Card Ferramentas — opção visual 2, versão 13

`public/experience/editorial/cards-v13/gerar.webp`: ilustração conceitual gerada pela ferramenta ImageGen a partir da segunda proposta escolhida por Pedro em 12/10/2026. A referência inteira fica em `../design/archive/v13/cards-v13-option-2.png`. A imagem foi convertida para WebP de 720 × 530 px, qualidade 87, com 58.524 bytes. Não foi recortada nem redesenhada na conversão. Não é fotografia, captura do ambiente 3D ou evidência dos estudos, e não recebe licença externa de banco de imagens ou atribuição CC0.

Os outros seis cards reutilizam as imagens renderizadas dos modelos próprios da experiência v9. As ilustrações são identificadas como conceituais na interface; o conteúdo e as referências continuam em HTML.

## Áudio ativo na experiência v8

A entrada “Explorar as ilhas” inicia uma faixa local sorteada entre [Sleep](https://www.scottbuckley.com.au/library/sleep/), [Reverie](https://www.scottbuckley.com.au/library/reverie/) e [Hymn](https://www.scottbuckley.com.au/library/hymn/), de Scott Buckley. As páginas oficiais confirmam CC BY 4.0 com crédito. Os arquivos MP3 são originais completos; volume, entrada suave e crossfade são aplicados pelo player. Atribuição: cada título, “by Scott Buckley - released under CC-BY 4.0. www.scottbuckley.com.au”, registrada no catálogo e disponível na interface. A playlist é embaralhada por visita e não depende da hora.

Os quatro OGG de aves são trechos da prévia pública de [Bird, Robin Isolated — JohnsonBrandEditing](https://freesound.org/people/JohnsonBrandEditing/sounds/434024/), CC0, com corte e fades. Não representam especificamente aves brasileiras. Os efeitos Kenney permanecem CC0. A experiência v8 não solicita as trilhas anteriores nem gravações extraídas do YouTube.

[registro de áudio v8](../audio/audio-v8.md) registra arquivos, origem, licença, alterações, duração, hashes e verificação. Música, efeitos e ambiente têm volumes independentes, inicialmente 28%, 10% e 6%. A reprodução pausa com a aba oculta; silenciamento e falhas musicais têm estados próprios. Dados do analisador comprovam sinal digital, sem afirmar audibilidade em alto-falantes físicos.

As seções abaixo documentam escolhas de versões anteriores, preservadas para proveniência e reversão. Elas não descrevem o comportamento ativo da v8.

## Áudio ativo na experiência v6

A entrada da experiência inicia somente efeitos e ambiente sintetizados por Web Audio, com `ExperienceAudio.enable({ music: false })`. Esse caminho não cria um player musical nem solicita arquivos MP3. Chuva e tempestade usam ruído sintetizado; pássaros tocam apenas em tempo claro e no entardecer; trovões só podem ocorrer durante tempestades.

O caminho opcional sem argumentos (`ExperienceAudio.enable()`) mantém uma faixa local licenciada para uso futuro: **Solace**, de Scott Buckley. O site da faixa descreve cordas e sintetizador suaves com piano e marimba de vidro, e oferece a licença Creative Commons Attribution 4.0, que requer crédito. A faixa não é música de Genshin Impact e não é apresentada como tal. [Página da faixa e termos de uso](https://www.scottbuckley.com.au/library/solace/).

Crédito exigido: `'Solace' by Scott Buckley - released under CC-BY 4.0. www.scottbuckley.com.au`.

## Música oficial de Liyue — acesso externo

O botão opcional “Ouvir Liyue · trilha oficial” abre o vídeo **“Jade Moon Upon a Sea of Clouds - Disc 1: Glazed Moon Over the Tides”**, publicado no canal oficial Genshin Impact: [YouTube](https://www.youtube.com/watch?v=t1O7LpOTBfM). A HoYoverse anunciou esse álbum de Liyue como parte da trilha sonora oficial. [Anúncio oficial](https://genshin.hoyoverse.com/en/news/detail/6448).

Uma faixa de clima calmo e diurno identificada nessa coleção é **“Cozy Leisure Time (Wangshu Daytime)”**, faixa 11, com duração de 1:29. Ela também tem upload individual no canal oficial de Yu-peng Music: [YouTube](https://www.youtube.com/watch?v=dz4Qlso55MU). Como o canal Genshin Impact disponibiliza o disco completo, a interface prioriza essa compilação oficial e não fixa um recorte temporal aproximado.

A HoYoverse informa que a música do jogo se limita a uso pessoal e não comercial. A FAQ Legal oficial no HoYoLAB acrescenta que direitos não são transferidos nem há licença implícita, restringe música a uso privado e não comercial e reserva o direito de pedir remoção. Nos documentos consultados, não há permissão geral para copiar, extrair ou hospedar arquivos de áudio; essa é a leitura conservadora das políticas publicadas. Por isso, a aplicação não baixa, extrai nem hospeda a música de Genshin: deixa a reprodução a cargo da página oficial do YouTube, em outra aba. [Política de música da HoYoverse, atualizada em 03/10/2025](https://support.hoyoverse.com/hc/en-us/articles/50333834244633-Can-I-use-in-game-music-for-my-fan-made-content); [FAQ Legal oficial do Genshin Impact no HoYoLAB](https://www.hoyolab.com/article/143107) ([versão traduzida](https://www.hoyolab.com/article/142895)); [ajuda do YouTube sobre compartilhamento e incorporação](https://help.youtube.com/support/youtube/bin/answer.py?answer=57741&topic=16647).

## Trilhas anteriores de Bruno Simon — histórico, não usadas no v6

O portfólio oficial de Bruno Simon credita as músicas a Kounine e declara que elas foram publicadas sob CC0 1.0. Esta playlist foi removida do manifesto ativo e não é carregada pelo runtime v6. A confirmação está em [`sources/index.html`, linhas 713-717](https://github.com/brunosimon/folio-2025/blob/41046b57eeed8d156d9c3fd7fa259900baef7816/sources/index.html#L713-L717); a lista e a ordem da playlist estão em [`sources/Game/Audio.js`, linhas 150-164](https://github.com/brunosimon/folio-2025/blob/41046b57eeed8d156d9c3fd7fa259900baef7816/sources/Game/Audio.js#L150-L164). O commit consultado é `41046b57eeed8d156d9c3fd7fa259900baef7816`. A licença declarada é [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/).

Na versão anterior, o site selecionava a faixa pelo bloco de três minutos atual (`floor(Date.now() / 180000) % 3`), na ordem Sudo, Boy e Baguira. Essa escolha não faz parte da experiência v6. Os arquivos legados continuam listados abaixo para preservar proveniência e histórico; o manifesto atual não os referencia.

| Arquivo local | Faixa / autoria | Tamanho e duracao | Git blob SHA-1 | SHA-256 do arquivo local |
|---|---|---:|---|---|
| `public/experience/audio/sudo.mp3` | Sudo — Kounine | 6.173.760 bytes; 154,274 s | `f4e9b9ca7494d27d94a3c28929b6b156bb3c07d1` | `F775E182D0D4F8194AC0F2C303AF1BBF8B9A939A24E0E8550E52912A1AD86DF0` |
| `public/experience/audio/boy.mp3` | Boy — Kounine | 6.509.760 bytes; 162,694 s | `c7348a96f8b4f9921728c81917999dd4369fc0f6` | `D35F28018ACBBA5C0C3BF6DB470A1593F0E96F63D5B6B711B176C9EF93DB4EFA` |
| `public/experience/audio/baguira.mp3` | Baguira — Kounine | 6.201.600 bytes; 154,988 s | `979264845c1058da4fd62bebed2d9164449702db` | `683EBF1BDE153BEE3BF591C2C1ABF6602B1BDD3C9B9E661141DDB44519BA1D48` |

Os três arquivos somam 18.885.120 bytes (18,89 MB; 18,01 MiB). Foram copiados sem alteração dos URLs oficiais fixados ao commit indicado, com bitrate médio de 320 kbps. A atribuição de cada faixa no manifesto identifica Kounine e a licença CC0 1.0, embora a licença não exija crédito.

## Efeitos de interface

- **Pacote:** [Kenney — Interface Sounds](https://kenney.nl/assets/interface-sounds), versao 1.0.
- **Download oficial utilizado:** [kenney_interface-sounds.zip](https://kenney.nl/media/pages/assets/interface-sounds/fa43c1dd4d-1677589452/kenney_interface-sounds.zip).
- **Licença:** [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/). O arquivo `License.txt` do pacote permite uso pessoal, educacional e comercial; atribuição não é obrigatória.
- **SHA-256 do pacote baixado:** `F2193D072726D6758A5F7871B2DCC54DCCE0D5C35C6F0A62F92549B327C81232`.
- **`public/experience/audio/selection.ogg`:** copia sem alteracao de `Audio/select_001.ogg`; SHA-256 `AEC0C31EA934A35936AE0D2AB8FAC8123C93AA5647F935853A58DBAF90278B7A`.
- **`public/experience/audio/arrival.ogg`:** copia sem alteracao de `Audio/confirmation_001.ogg`; SHA-256 `063564703B6094D70718A3E787A55CC9141611E4ECD6B6637F8828F79B4A8C3A`.

## Reprodução e ambiente

Quando o modo musical opcional é usado, a faixa local licenciada inicia apenas no gesto de consentimento. Os efeitos de seleção e chegada carregam em segundo plano; enquanto isso, sinais suaves são sintetizados com Web Audio.

Pássaros são sintetizados em tempo claro e no entardecer. Chuva e vento acompanham os estados de chuva e tempestade. O trovão é um ruído grave sintetizado com envelope suave, sem arquivo ou gravação adicional; chamadas são limitadas a uma por intervalo superior a oito segundos e só tocam com o áudio ativo, a aba visível e tempestade. Todo o ambiente começa depois do consentimento e para ao silenciar, ocultar a aba ou desmontar a experiência.

## Proveniência do arquivo local Solace

`public/experience/audio/sb-solace.mp3` é a faixa licenciada usada pelo caminho musical opcional `ExperienceAudio.enable()`. A entrada atual da experiência passa `music: false` e não a carrega.

- **Faixa e autoria:** Solace — Scott Buckley.
- **Origem:** [arquivo publicado por Scott Buckley](https://www.scottbuckley.com.au/library/wp-content/uploads/2020/05/sb_solace.mp3).
- **Licença:** [Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/).
- **Atribuicao exigida:** `'Solace' by Scott Buckley - released under CC-BY 4.0. www.scottbuckley.com.au`.
- **Alteração:** conversão do MP3 de origem para MP3 estéreo a 160 kbps com FFmpeg/libmp3lame. Duração preservada: 356,356 s; taxa de amostragem: 44,1 kHz.
- **SHA-256 da origem baixada:** `BB54696D9B49E60D8E9EDC25D80C19A975D25B3C8D8CA32AFE4D963372E1D1BF`.
- **SHA-256 do arquivo publicado:** `3429CF4AA74744BC018170914E91B7575C097E6C2AA7872898142858ECE78F37`.
