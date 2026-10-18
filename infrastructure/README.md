# Infraestrutura

Esta pasta reúne integrações que não fazem parte do código de interface. O site público é compilado pelo Next.js e publicado na Vercel; o serviço editorial permanece na hospedagem original.

| Caminho | Conteúdo |
| --- | --- |
| `editorial/db/` | Esquema D1 e operações do serviço editorial. |
| `editorial/migrations/` | Migrações SQL e metadados do Drizzle. |
| `editorial/examples/` | Exemplo de integração D1, separado das rotas públicas. |
| `editorial/drizzle.config.ts` | Configuração de geração de migrações, com caminhos relativos à raiz do projeto. |
| `sites/vite.config.ts` | Configuração Vinext/Cloudflare da hospedagem anterior. |
| `sites/build/` | Plugins e workers de integração com Sites. |
| `sites/vendor/` | Recursos de terceiros preservados com suas licenças. |

Os comandos auxiliares desse ambiente estão em [`scripts/sites/`](../scripts/sites/). Credenciais e arquivos privados de hospedagem não são versionados. Mover essas fontes não migra o banco nem altera os dados publicados.

Consulte [Publicação e serviço editorial](../docs/deployment.md) para entender quais rotas são atendidas por cada ambiente.
