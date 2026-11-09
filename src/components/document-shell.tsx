"use client";
import {useEffect,useRef,type ReactNode} from 'react';
import Link from 'next/link';
import {useAccessibility} from './island-experience/use-accessibility';
import {AccessibilityControls} from './island-experience/garden-panels';
import LibrasControl from './libras-control';
import './document-shell.css';
export default function DocumentShell({children}:{children:ReactNode}) {
  const access=useAccessibility(),dialog=useRef<HTMLDialogElement>(null),trigger=useRef<HTMLButtonElement>(null);
  useEffect(()=>{const node=dialog.current;const closed=()=>trigger.current?.focus({preventScroll:true});node?.addEventListener('close',closed);return()=>node?.removeEventListener('close',closed);},[]);
  return <div className="document-experience" data-a11y-theme={access.theme} data-a11y-text={access.textSize} data-a11y-spacing={access.spacing}>
    <a className="document-skip" href="#document-main">Ir para o conteúdo</a>
    <header className="document-toolbar"><nav aria-label="Navegação do documento"><Link href="/" prefetch={false}>Voltar às ilhas</Link><a href="/explorar">Explorar em texto</a><a href="/texto-completo">TCC completo em HTML</a><a href="/acessibilidade">Acessibilidade do site</a></nav><button ref={trigger} onClick={()=>dialog.current?.showModal()}>Preferências de acessibilidade</button><LibrasControl/></header>
    <main id="document-main" tabIndex={-1}>{children}</main>
    <dialog ref={dialog} aria-labelledby="document-access-title"><div className="document-dialog-bar"><h2 id="document-access-title">Preferências de acessibilidade</h2><button onClick={()=>dialog.current?.close()} aria-label="Fechar preferências de acessibilidade">Fechar</button></div><AccessibilityControls preferences={access.preferences} onChange={access.update} onReset={access.reset} persistent={access.persistent}/></dialog>
  </div>;
}
