"use client";
import {useId,useState} from 'react';
import {pavilionIds,islandNames,islandDescriptions,type PavilionId,type WorldManifest} from '@/lib/experience-contract';
import {pavilionSections} from '@/lib/pavilion-content';
import {readingHref} from '@/lib/reading-navigation.mjs';
import {discoveryCatalog,type DiscoveryId,type DiscoveryLedger} from '@/lib/experience/discoveries.mjs';
import type {AccessibilityPreferences} from '@/lib/experience/accessibility.mjs';

export type GardenPanelSection='environment'|'accessibility'|'garden'|'discoveries'|'credits';
export const gardenPanelTitles:Record<GardenPanelSection,string>={environment:'Ambiente do jardim',accessibility:'Acessibilidade',garden:'Vida no jardim',discoveries:'Caderno de descobertas',credits:'Créditos'};
const activityVerbs={sitting:'Sentar',fishing:'Pescar',observing:'Observar a paisagem',watering:'Regar as flores',gathering:'Colher uma fruta'};

export function AccessibilityControls({preferences,onChange,onReset,persistent}:{preferences:AccessibilityPreferences;onChange:(patch:Partial<AccessibilityPreferences>)=>void;onReset:()=>void;persistent:boolean}) {
  const id=useId();
  return <div className="garden-accessibility">
    <p>Escolha como explorar. As preferências valem neste navegador e podem ser alteradas a qualquer momento.</p>
    <fieldset><legend>Visualização e leitura</legend>
      <label className="garden-check"><input type="checkbox" checked={preferences.textView} onChange={event=>onChange({textView:event.currentTarget.checked})}/>Explorar em texto, com lista de ilhas e ações</label>
      <p>A lista oferece as mesmas ilhas, atividades do morador, alimentação e descobertas, sem depender de enxergar o cenário 3D.</p>
      <label className="garden-field" htmlFor={id+'-contrast'}>Contraste<select id={id+'-contrast'} value={preferences.contrast} onChange={event=>onChange({contrast:event.currentTarget.value as AccessibilityPreferences['contrast']})}><option value="system">Seguir o sistema</option><option value="high">Alto contraste claro</option><option value="dark">Alto contraste escuro</option></select></label>
      <label className="garden-field" htmlFor={id+'-palette'}>Cores dos mapas e marcadores<select id={id+'-palette'} value={preferences.palette} onChange={event=>onChange({palette:event.currentTarget.value as AccessibilityPreferences['palette']})}><option value="original">Paleta original</option><option value="blue-amber">Azul e âmbar</option><option value="monochrome">Tons neutros</option></select></label>
      <p>Útil para diferentes formas de daltonismo. Nomes, números e estados escritos identificam as ilhas em todas as paletas.</p>
      <label className="garden-field" htmlFor={id+'-size'}>Tamanho dos textos<select id={id+'-size'} value={preferences.textSize} onChange={event=>onChange({textSize:event.currentTarget.value as AccessibilityPreferences['textSize']})}><option value="normal">Padrão</option><option value="large">Ampliado</option><option value="larger">Mais ampliado</option></select></label>
      <label className="garden-check"><input type="checkbox" checked={preferences.spacing} onChange={event=>onChange({spacing:event.currentTarget.checked})}/>Mais espaço entre linhas e palavras</label>
      <p>O zoom do navegador continua disponível. Para ler o documento inteiro em HTML, use a <a href="/texto-completo">versão em texto completo do TCC</a>.</p>
    </fieldset>
    <fieldset><legend>Movimento e luz</legend>
      <label className="garden-field" htmlFor={id+'-motion'}>Animações<select id={id+'-motion'} value={preferences.motion} onChange={event=>onChange({motion:event.currentTarget.value as AccessibilityPreferences['motion']})}><option value="system">Seguir o sistema</option><option value="reduced">Movimento reduzido</option><option value="paused">Pausar animações e relógio</option></select></label>
      <p>O movimento reduzido interrompe o giro automático e as estrelas cadentes. Ações do morador que você pedir continuam disponíveis. A visita guiada avança somente quando você escolher.</p>
      <label className="garden-check"><input type="checkbox" checked={preferences.flashes} onChange={event=>onChange({flashes:event.currentTarget.checked})}/>Permitir clarões de raios</label>
      <p>Os clarões ficam desligados por padrão. O movimento reduzido também os desativa. Tempestade, chuva, vento e estações continuam disponíveis.</p>
    </fieldset>
    <fieldset><legend>Som e mensagens</legend>
      <label className="garden-check"><input type="checkbox" checked={preferences.captions} onChange={event=>onChange({captions:event.currentTarget.checked})}/>Mostrar legendas de sons e eventos</label>
      <label className="garden-check"><input type="checkbox" checked={preferences.announcements} onChange={event=>onChange({announcements:event.currentTarget.checked})}/>Anunciar ações e descobertas para leitores de tela</label>
      <p>O som é opcional e começa apenas quando você o ativa. Não há instrução disponível somente por áudio. O relógio e o movimento do cenário não são anunciados continuamente.</p>
      <p>Para usar tradução automática em Libras, <a href="/texto-completo">abra o texto completo</a> e escolha “Ativar tradução em Libras”. O serviço externo só carrega ao ser solicitado.</p>
    </fieldset>
    <p>Use Tab e Shift+Tab para navegar, Enter ou Espaço para acionar botões e Esc para fechar painéis. Alt+M abre o mapa. O link “Ir para a leitura” fica no início da página.</p>
    <button className="garden-action" onClick={onReset}>Restaurar preferências de acessibilidade</button>
    {!persistent&&<p role="status">O navegador bloqueou o armazenamento. As preferências continuam disponíveis nesta sessão.</p>}
    <p><a href="/acessibilidade">Recursos de acessibilidade e limites conhecidos</a></p>
  </div>;
}

type GardenActions={manifest:WorldManifest|null;residentText:string;eventText?:string;feedingPoints:{label:string;point:[number,number,number]}[];onFeed:(index:number)=>void;onCommand:(id:string)=>void;onWave:()=>void;onTour:()=>void;onObserve:(id:DiscoveryId)=>void;paused:boolean;};
export function GardenPanel({manifest,residentText,eventText,feedingPoints,onFeed,onCommand,onWave,onTour,onObserve,paused}:GardenActions) {
  const id=useId(),activities=manifest?.islandLife?.activityPoints??[],[activity,setActivity]=useState(''),[feeding,setFeeding]=useState(0);
  const selected=activities.some(point=>point.id===activity)?activity:activities.find(point=>point.kind==='sitting')?.id??activities[0]?.id??'';
  return <div className="garden-life-panel">
    {eventText&&<p role="log" aria-live="off" aria-label="Último evento no jardim">{eventText}</p>}
    <section aria-labelledby={id+'-tour'}><h3 id={id+'-tour'}>Visita guiada pela pesquisa</h3><p>Um percurso pelas sete ilhas, da pergunta inicial às conclusões. Você avança no seu ritmo, sem contagem de tempo.</p><button className="garden-action" onClick={onTour}>Começar visita guiada</button></section>
    <section aria-labelledby={id+'-resident'}><h3 id={id+'-resident'}>O morador</h3><p>{residentText}</p><p>Escolha onde ele vai sentar, pescar ou cuidar do jardim. Chuva, descanso e caminhos seguros continuam sendo respeitados.</p>
      <label className="garden-field" htmlFor={id+'-activity'}>Atividade e lugar<select id={id+'-activity'} value={selected} onChange={event=>setActivity(event.currentTarget.value)}>{(Object.keys(activityVerbs) as (keyof typeof activityVerbs)[]).map(kind=><optgroup label={activityVerbs[kind]} key={kind}>{activities.filter(point=>point.kind===kind).map((point,index)=><option key={point.id} value={point.id}>{activityVerbs[point.kind]} — {point.island?islandNames[point.island]:point.bridge?'Ponte próxima à casa':'Varanda e arredores'}{index?` · ${index+1}`:''}</option>)}</optgroup>)}</select></label>
      <div className="garden-action-row"><button className="garden-action" disabled={!selected||paused} onClick={()=>onCommand(selected)}>Pedir esta atividade</button><button className="garden-action garden-action--quiet" disabled={paused} onClick={onWave}>Cumprimentar o morador</button></div>
    </section>
    <section aria-labelledby={id+'-feeding'}><h3 id={id+'-feeding'}>Alimentar os peixes</h3><p>Escolha uma região de água livre. As porções são limitadas, e o gelo impede a alimentação.</p><label className="garden-field" htmlFor={id+'-feed'}>Lugar da alimentação<select id={id+'-feed'} value={feeding} onChange={event=>setFeeding(Number(event.currentTarget.value))}>{feedingPoints.map((point,index)=><option key={index} value={index}>{point.label}</option>)}</select></label><button className="garden-action" disabled={!feedingPoints.length||paused} onClick={()=>onFeed(feeding)}>Alimentar os peixes neste lugar</button></section>
    {paused&&<p>As animações estão pausadas. Retome o movimento nas opções de acessibilidade para iniciar as atividades.</p>}
    <section aria-labelledby={id+'-animals'}><h3 id={id+'-animals'}>Conhecer os habitantes</h3><p>Na exploração em texto, conhecer uma espécie também a registra no caderno.</p><ul className="garden-species-list" role="list">{discoveryCatalog.filter(item=>['birds','fish','butterflies','ducks','turtles'].includes(item.id)).map(item=><li key={item.id}><h4>{item.name}</h4><p>{item.description}</p><button className="garden-action garden-action--quiet" onClick={()=>onObserve(item.id)}>Conhecer {item.name.toLowerCase()}</button></li>)}</ul></section>
  </div>;
}

export function DiscoveryBook({ledger}:{ledger:DiscoveryLedger}) {
  return <div className="garden-discoveries"><p><strong>{Object.keys(ledger).length} de {discoveryCatalog.length} descobertas registradas.</strong> O registro é automático no cenário e também acompanha a exploração em texto. Fica somente neste navegador, sem conta.</p><ul role="list">{discoveryCatalog.map(item=><li key={item.id} data-discovered={!!ledger[item.id]}><span className="garden-discovery-state">{ledger[item.id]?'Registrada':'Ainda não registrada'}</span><h3>{item.name}</h3><p>{item.description}</p>{ledger[item.id]&&<p className="garden-discovery-date">Primeiro encontro: <time dateTime={ledger[item.id]}>{new Intl.DateTimeFormat('pt-BR',{dateStyle:'medium'}).format(new Date(ledger[item.id]!))}</time></p>}</li>)}</ul></div>;
}

export function AccessibleGarden({description,onChoose,onOptions,visited,...actions}:GardenActions&{description:string;onChoose:(id:PavilionId,trigger?:HTMLElement)=>void;onOptions:(section:GardenPanelSection,trigger:HTMLElement)=>void;visited:PavilionId[]}) {
  return <div className="garden-text-view">
    <h1 tabIndex={-1} id="garden-text-title">As sete ilhas da pesquisa</h1><p>{description}</p><p>Esta versão permite explorar e interagir com o jardim por texto, teclado e leitor de tela.</p>
    <div className="garden-action-row"><button className="garden-action" onClick={event=>onOptions('accessibility',event.currentTarget)}>Preferências de acessibilidade</button><button className="garden-action garden-action--quiet" onClick={event=>onOptions('discoveries',event.currentTarget)}>Abrir caderno de descobertas</button><a className="garden-action garden-action--quiet" href="/texto-completo">Ler o TCC completo em HTML</a></div>
    <nav aria-label="Todas as ilhas da pesquisa"><h2>Escolha uma ilha</h2><ol className="garden-island-list" role="list">{pavilionIds.map((island,index)=><li key={island}><h3>{index+1}. {islandNames[island]}</h3><p>{islandDescriptions[island]}</p><p>{visited.includes(island)?'Ilha visitada':'Ilha por explorar'}</p><div className="garden-action-row"><button className="garden-action" onClick={event=>onChoose(island,event.currentTarget)}>Abrir síntese: {islandNames[island]}</button><a href={readingHref(island)}>Ler este capítulo no caderno</a></div></li>)}</ol></nav>
    <h2>Vida no jardim</h2><GardenPanel {...actions}/>
  </div>;
}

export function GuidedVisit({pavilion,onPrevious,onEnd}:{pavilion:PavilionId;onPrevious:()=>void;onEnd:()=>void}) {
  const index=pavilionIds.indexOf(pavilion);
  return <section className="garden-tour-progress" aria-label="Visita guiada"><p><strong>Visita guiada · Etapa {index+1} de {pavilionIds.length}</strong></p><p>{pavilionSections[pavilion].description}</p><p>{index===pavilionIds.length-1?'Você chegou à última ilha. Encerre a visita quando terminar ou volte à etapa anterior.':'Avance pelo botão “Próxima ilha” quando terminar. Não há limite de tempo.'}</p><div className="garden-action-row">{index>0&&<button className="garden-action garden-action--quiet" onClick={onPrevious}>Etapa anterior</button>}<button className="garden-action garden-action--quiet" onClick={onEnd}>Encerrar visita guiada</button></div></section>;
}
