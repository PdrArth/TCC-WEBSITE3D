import type {ReactNode} from 'react';
import Link from 'next/link';
import './document-shell.css';
export default function DocumentShell({children}:{children:ReactNode}) {
  return <div className="document-experience">
    <a className="document-skip" href="#document-main">Ir para o conteúdo</a>
    <header className="document-toolbar"><nav aria-label="Navegação do documento"><Link href="/" prefetch={false}>Voltar às ilhas</Link><Link href="/#caderno/pesquisa" prefetch={false}>Caderno da pesquisa</Link><a href="/texto-completo">TCC completo</a><a href="/tcc-pedro-arthur.pdf" target="_blank" rel="noreferrer">Abrir PDF</a></nav></header>
    <main id="document-main" tabIndex={-1}>{children}</main>
  </div>;
}
