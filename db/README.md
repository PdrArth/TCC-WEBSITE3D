# Banco editorial

O esquema D1 e a implementação original de persistência foram preservados nesta pasta. O serviço editorial continua na hospedagem original, que fornece o banco e autentica o autor.

A aplicação Next.js publicada na Vercel consulta apenas `/api/updates` desse serviço, valida a resposta e devolve somente os campos públicos. A revisão e o MCP direcionam o cliente ao serviço original; a Vercel não aceita cabeçalhos de identidade como prova de login.

`sites-updates.ts` e `index.ts` são fontes do ambiente Cloudflare e não entram no build Next.js.
