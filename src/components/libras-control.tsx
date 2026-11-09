"use client";
import {useState} from 'react';
let loading:Promise<void>|undefined;
function loadLibras() {
  if(!loading)loading=new Promise<void>((resolve,reject)=>{
    const script=document.createElement('script');script.src='https://vlibras.gov.br/app/vlibras-plugin.js';script.async=true;
    script.onload=()=>resolve();script.onerror=()=>{script.remove();loading=undefined;reject(new Error('O serviço de Libras não respondeu.'));};
    document.body.appendChild(script);
  });
  return loading;
}
/** The external translation service is requested only by this explicit control. */
export default function LibrasControl() {
  const [status,setStatus]=useState<'off'|'loading'|'ready'|'error'>('off'),[message,setMessage]=useState('');
  const enable=()=>{
    setStatus('loading');setMessage('Carregando o tradutor automático em Libras…');
    void loadLibras().then(()=>{setStatus('ready');setMessage('VLibras carregado. Use o botão flutuante de Libras.');}).catch(()=>{setStatus('error');setMessage('O serviço externo não carregou. O texto continua disponível; você pode tentar novamente.');});
  };
  return <div className="document-libras"><button onClick={enable} disabled={status==='loading'||status==='ready'}>{status==='loading'?'Carregando Libras…':status==='ready'?'Libras ativada':status==='error'?'Tentar carregar Libras':'Ativar tradução em Libras'}</button><p>Ao ativar, carrega o serviço externo VLibras. A tradução é automática e pode conter erros.</p><p role="status">{message}</p></div>;
}
