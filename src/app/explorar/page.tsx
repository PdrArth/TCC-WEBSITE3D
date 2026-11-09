import type {Metadata} from 'next';
import ResearchWorld from '@/components/research-world';
export const metadata:Metadata={title:'Explorar em texto — Do código à supervisão',description:'Explore todas as ilhas, atividades do morador e descobertas por texto, teclado ou leitor de tela.'};
export default function TextGarden(){return <ResearchWorld initialTextView/>;}
