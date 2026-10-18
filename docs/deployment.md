# Publicação na Vercel

A versão pública está em [tcc-pdrarth.vercel.app](https://tcc-pdrarth.vercel.app/) e usa o build nativo do Next.js, com a configuração versionada em `vercel.json`. O processo não depende de `.openai/hosting.json`, Wrangler ou bindings de Cloudflare. O Node.js fica na linha 24.x para evitar trocas automáticas de versão principal.

## Serviço editorial existente

A pesquisa, as sete ilhas, os modelos e o PDF são servidos pela Vercel. O banco editorial e o login do autor continuam no serviço original em `https://do-codigo-a-supervisao-pedro.pdrarth.chatgpt.site`.

`TCC_BACKEND_ORIGIN` pode definir outro serviço editorial HTTPS. Esse valor é uma origem fixa configurada pelo proprietário, sem credenciais ou caminhos. O padrão preserva a hospedagem atual. O endereço da própria aplicação não deve ser usado, pois criaria um ciclo.

O endpoint público `/api/updates` lê somente as publicações aprovadas, valida o formato e remove campos que não pertencem à resposta pública. Falhas do serviço permanecem falhas; não são convertidas em publicações ou listas fictícias.

As páginas `/revisao` e `/revisao/ilhas`, as APIs privadas e o MCP direcionam o cliente ao serviço original. Não há proxy de cabeçalhos de identidade nem aceitação de login informado pelo visitante. A conexão MCP já existente continua usando o endereço original.

## Áudio

O MP3 de Genshin não é versionado no repositório público. A rota existente do áudio tem um rewrite para o mesmo arquivo na hospedagem original, preservando a música e os controles da experiência. Os demais sons e recursos são arquivos públicos do próprio projeto.

Os scripts `dev:sites` e `build:sites` preservam a opção de prévia do ambiente anterior; eles não são utilizados pelo deploy da Vercel. Os arquivos do backend D1 permanecem em `infrastructure/editorial/` como fonte do serviço original e estão fora da compilação Next.js. A configuração e os plugins de Sites ficam em `infrastructure/sites/`, com os comandos auxiliares em `scripts/sites/`.
