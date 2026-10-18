# Ferramentas do projeto

| Pasta | Finalidade |
| --- | --- |
| `world/` | Modelagem, preparação, otimização e validação dos recursos 3D. |
| `audio/` | Preparação dos recursos sonoros autorais. |
| `qa/` | Ferramentas auxiliares de inspeção da experiência. |
| `sites/` | Instalação, build e conexão de prévia da hospedagem anterior. |

Os comandos de build e testes são declarados no `package.json` da raiz. `build` usa Next.js; os comandos com sufixo `:sites` são exclusivos da integração Vinext/Cloudflare. Arquivos temporários e resultados locais não são publicados como parte do código.
