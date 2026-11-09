"use client";
import {useCallback,useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {islandNames,type WorldManifest} from '@/lib/experience-contract';
import type {Weather} from '@/lib/experience/weather.mjs';
import type {Season} from '@/lib/experience/seasons.mjs';
import {createGardenRuntime} from '@/lib/experience/garden-runtime';
import {requestResidentActivity,writeResidentPose,residentShelterReason,type ResidentPose} from '@/lib/experience/island-life.mjs';
import {requestGreeting,advanceResidentWithGreeting,addWaterTouch} from '@/lib/experience/garden-interactions.mjs';
import {createFeedSpot,requestFishFood} from '@/lib/experience/fish-feeding.mjs';
import {advanceEnvironment} from '@/lib/experience/environment.mjs';
import {advanceSkyEvents} from '@/lib/experience/sky-events.mjs';
import {fireflyPresence} from '@/lib/experience/garden-life.mjs';
import {DISCOVERY_KEY,discoveryCatalog,parseDiscoveries,recordDiscovery,type DiscoveryLedger,type DiscoveryId} from '@/lib/experience/discoveries.mjs';

type Options={manifest:WorldManifest|null;weather:Weather;season:Season;hour:number;visible:boolean;started:boolean;rendererActive:boolean;paused:boolean;reducedMotion:boolean};
export function useGardenSession(options:Options) {
  const {manifest,visible,started,paused}=options;
  const runtime=useMemo(()=>manifest?.islandLife?createGardenRuntime(manifest):null,[manifest]);
  const [ledger,setLedger]=useState<DiscoveryLedger>({}),ledgerRef=useRef<DiscoveryLedger>({}),[ledgerReady,setLedgerReady]=useState(false);
  const [announcement,setAnnouncement]=useState({text:'',serial:0}),[captions,setCaptions]=useState<string[]>([]),[epoch,setEpoch]=useState(0),[residentText,setResidentText]=useState('O morador está conhecendo o jardim.');
  const discoveryBatch=useRef<DiscoveryId[]>([]),discoveryTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const requestedActivity=useRef<string|null>(null);
  const context=useRef(options);useLayoutEffect(()=>{context.current=options;},[options]);
  const announce=useCallback((text:string)=>{
    setAnnouncement(previous=>({text,serial:previous.serial+1}));
    setCaptions(previous=>previous.at(-1)===text?previous:[...previous.slice(-5),text]);
  },[]);
  useEffect(()=>{let active=true;queueMicrotask(()=>{if(!active)return;try{const saved=parseDiscoveries(localStorage.getItem(DISCOVERY_KEY));ledgerRef.current=saved;setLedger(saved);}catch{/* The session remains usable without storage. */}setLedgerReady(true);});return()=>{active=false;};},[]);
  useEffect(()=>{if(!ledgerReady)return;try{localStorage.setItem(DISCOVERY_KEY,JSON.stringify({version:1,entries:ledger}));}catch{/* No login or server storage is needed. */}},[ledger,ledgerReady]);
  useEffect(()=>()=>{if(discoveryTimer.current)clearTimeout(discoveryTimer.current);},[]);
  const discover=useCallback((id:DiscoveryId)=>{
    const next=recordDiscovery(ledgerRef.current,id);if(next===ledgerRef.current)return;
    ledgerRef.current=next;setLedger(next);discoveryBatch.current.push(id);
    if(discoveryTimer.current)return;
    discoveryTimer.current=setTimeout(()=>{
      const batch=discoveryBatch.current.splice(0);discoveryTimer.current=null;
      const name=discoveryCatalog.find(item=>item.id===batch[0])?.name;
      announce(batch.length>1?`${batch.length} novas descobertas no caderno do jardim.`:`Nova descoberta: ${name}.`);
    },700);
  },[announce]);
  const feedingPoints=useMemo(()=>{
    if(!manifest?.environment)return [];
    const environment=manifest.environment,points:{label:string;point:[number,number,number]}[]=[];
    for(const[x,z]of [[0,-2],[-5,-3],[5,-3],[0,3],[-4,4],[4,4]]){
      const point:[number,number,number]=[x,environment.water.height,z];
      if(requestFishFood(createFeedSpot(),point,0,environment))points.push({label:points.length===0?'Centro do lago':x<0?'Lado esquerdo do lago':'Lado direito do lago',point});
      if(points.length===3)break;
    }
    return points;
  },[manifest]);
  const fed=useCallback(()=>{discover('feeding');announce('Comida na água. Os peixes próximos podem se aproximar.');setEpoch(value=>value+1);},[discover,announce]);
  const feed=useCallback((index:number)=>{
    const entry=feedingPoints[index],settings=context.current;
    if(!runtime||!manifest?.environment||!entry)return false;
    if(!settings.visible||!settings.started){announce('Volte ao jardim para alimentar os peixes.');return false;}
    if(settings.paused){announce('As animações estão pausadas. Retome o movimento para alimentar os peixes.');return false;}
    if(runtime.environment.ice>.35){announce('A superfície está congelada. Aguarde o degelo para alimentar os peixes.');return false;}
    if(!requestFishFood(runtime.feedSpot,entry.point,runtime.environment.elapsed,manifest.environment,runtime.environment.ice)){announce('Aguarde três segundos entre as porções de comida.');return false;}
    addWaterTouch(runtime.touches,entry.point,runtime.environment.elapsed,manifest.environment,runtime.environment.ice);fed();return true;
  },[runtime,manifest,feedingPoints,fed,announce]);
  const command=useCallback((id:string)=>{
    if(!runtime||!manifest?.islandLife)return false;
    const settings=context.current,result=requestResidentActivity(runtime.resident,id,manifest.islandLife,{weather:settings.weather,hour:settings.hour,night:runtime.environment.night,moving:!settings.paused,visible:settings.visible});
    if(!result.accepted){
      const reasons={night:'O morador está descansando. As atividades ao ar livre voltam de dia.',weather:'O morador procura abrigo durante a chuva. Escolha um momento de tempo aberto.',paused:'As animações estão pausadas. Retome o movimento para iniciar a atividade.',sheltered:'O morador ainda está em casa ou aguardando o tempo abrir.',busy:'Ele está terminando a coleta. Tente novamente em instantes.',unknown:'Esse lugar não está disponível.'};
      announce(reasons[result.reason??'unknown']);return false;
    }
    const activity=manifest.islandLife.activityPoints.find(item=>item.id===id)!;
    requestedActivity.current=id;
    const kind={sitting:'sentar',fishing:'pescar',observing:'observar a paisagem',watering:'regar as flores',gathering:'colher uma fruta'}[activity.kind];
    announce(result.waiting?`Pedido recebido. Depois de sair de casa e aguardar o tempo abrir, o morador vai ${kind}${activity.island?` na ilha ${islandNames[activity.island]}`:''}.`:`O morador está a caminho para ${kind}${activity.island?` na ilha ${islandNames[activity.island]}`:''}.`);setEpoch(value=>value+1);return true;
  },[runtime,manifest,announce]);
  const wave=useCallback(()=>{
    if(!runtime)return false;
    const settings=context.current,state=runtime.resident;
    if(settings.paused||!settings.visible||residentShelterReason({weather:settings.weather,hour:settings.hour})||!['walking','observing','returning'].includes(state.phase)||state.shelterReason){announce('O morador está ocupado ou descansando. O aceno fica disponível quando ele estiver livre.');return false;}
    requestGreeting(runtime.greeting);announce('Você cumprimentou o morador. Ele vai parar e acenar.');setEpoch(value=>value+1);return true;
  },[runtime,announce]);
  useEffect(()=>{
    if(!runtime||!manifest?.islandLife||!visible||!started||paused)return;
    const pose={} as ResidentPose;let previous=performance.now(),report=0,lastGreeting=runtime.greeting.count;
    const timer=setInterval(()=>{
      const settings=context.current,now=performance.now(),dt=Math.min(.1,Math.max(0,(now-previous)/1000));previous=now;
      if(!settings.rendererActive&&!settings.paused){
        advanceEnvironment(runtime.environment,dt,settings.weather,settings.season,settings.hour);
        advanceSkyEvents(runtime.sky,dt,{weather:settings.weather,hour:settings.hour,active:true,reducedMotion:settings.reducedMotion});
        advanceResidentWithGreeting(runtime.resident,runtime.greeting,pose,dt,{moving:true,visible:true,weather:settings.weather,hour:settings.hour,reducedMotion:false},manifest.islandLife!,{distance:40,cameraHeading:runtime.resident.heading+.5});
        if(runtime.sky.rainbowOpacity>.1)discover('rainbow');if(runtime.sky.meteorOpacity>.1)discover('meteor');
        if(fireflyPresence(settings.season,settings.weather,runtime.environment.night,runtime.environment.wind)>.1)discover('fireflies');
      }
      if(runtime.greeting.count>lastGreeting){lastGreeting=runtime.greeting.count;discover('greeting');}
      writeResidentPose(pose,runtime.resident,manifest.islandLife);
      if(pose.caughtFish)discover('fishing');if(runtime.environment.outflow>.01)discover('waterfall');
      report+=dt;if(report<.4)return;report=0;
      const activity=manifest.islandLife!.activityPoints.find(item=>item.id===runtime.resident.activityId),place=activity?.island?` na ilha ${islandNames[activity.island]}`:'';
      const phases:Record<string,string>={walking:`Caminhando${place}.`,fishing:`Pescando${place}.`,sitting:`Sentado${place}.`,observing:`Observando a paisagem${place}.`,watering:`Regando as flores${place}.`,gathering:`Colhendo uma fruta${place}.`,returning:'Voltando para casa.',entering:'Entrando em casa.',exiting:'Saindo de casa.',interior:runtime.resident.nightRest?'Deitado na cama, descansando.':'Em casa, aguardando o tempo melhorar.',porch:'Sentado na varanda.', 'walk-home':'Voltando para a varanda.'};
      const text=phases[runtime.resident.phase]??'Passeando pelo jardim.';setResidentText(previousText=>previousText===text?previousText:text);
      if(requestedActivity.current){
        const requested=manifest.islandLife!.activityPoints.find(item=>item.id===requestedActivity.current);
        if(residentShelterReason({weather:settings.weather,hour:settings.hour})){requestedActivity.current=null;announce('A atividade foi interrompida. O morador está voltando para descansar ou se abrigar.');}
        else if(requested&&runtime.resident.activityId===requested.id&&runtime.resident.node===requested.node&&runtime.resident.phase===requested.kind){requestedActivity.current=null;announce(`O morador chegou. ${text}`);}
      }
    },100);
    return()=>clearInterval(timer);
  },[runtime,manifest,visible,started,paused,discover,announce]);
  return {runtime,ledger,discover,announcement,captions,announce,epoch,residentText,feedingPoints,feed,fed,command,wave};
}
