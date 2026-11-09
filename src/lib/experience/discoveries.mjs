export const DISCOVERY_KEY = 'tcc-garden-discoveries-v1';
export const discoveryCatalog = [
  {id:'birds',name:'Aves do jardim',group:'Fauna',description:'Pequenas aves voam, pousam e procuram abrigo nas ilhas.'},
  {id:'fish',name:'Peixes do lago',group:'Fauna',description:'Peixes percorrem a água em trajetos independentes.'},
  {id:'butterflies',name:'Borboletas',group:'Fauna',description:'Borboletas visitam os canteiros em períodos de tempo aberto.'},
  {id:'ducks',name:'Patinhos',group:'Fauna',description:'Patinhos nadam pelo lago e descansam perto das margens.'},
  {id:'turtles',name:'Tartarugas',group:'Fauna',description:'Tartarugas caminham devagar e descansam perto da água.'},
  {id:'fireflies',name:'Vagalumes de verão',group:'Fauna',description:'Pontos de luz aparecem em noites tranquilas de verão.'},
  {id:'rainbow',name:'Arco-íris depois da chuva',group:'Fenômenos',description:'Um arco colorido surge quando o céu abre durante o dia, depois da chuva.'},
  {id:'meteor',name:'Estrela cadente',group:'Fenômenos',description:'Uma passagem breve de luz cruza algumas noites de céu limpo.'},
  {id:'waterfall',name:'Cachoeira do lago',group:'Fenômenos',description:'A queda escoa a água acumulada quando o lago enche.'},
  {id:'feeding',name:'Alimentar os peixes',group:'Encontros',description:'Uma porção de comida atrai os peixes que conseguem se aproximar pela água.'},
  {id:'greeting',name:'O aceno do morador',group:'Encontros',description:'O morador para, olha para o visitante e acena quando está disponível.'},
  {id:'fishing',name:'Uma pescaria',group:'Encontros',description:'O morador observa a boia, recolhe a linha e pode mostrar um peixe.'},
];
const ids=new Set(discoveryCatalog.map(item=>item.id));
export function parseDiscoveries(value) {
  let input;
  try{input=typeof value==='string'?JSON.parse(value):value;}catch{return {};}
  if(!input||input.version!==1||!input.entries||typeof input.entries!=='object'||Array.isArray(input.entries))return {};
  const result={};
  for(const[id,date]of Object.entries(input.entries))if(ids.has(id)&&typeof date==='string'&&date.length<=32&&Number.isFinite(Date.parse(date)))result[id]=date;
  return result;
}
export function recordDiscovery(entries,id,date=new Date().toISOString()) {
  if(!ids.has(id)||entries[id]||!Number.isFinite(Date.parse(date)))return entries;
  return {...entries,[id]:date};
}
