import { searchPosition } from './chess-engine.mjs';
onmessage=async({data})=>{try{const result=await searchPosition(data.fen,{...data.settings,onProgress:progress=>postMessage({type:'progress',progress})});postMessage({type:'result',result});}catch(error){postMessage({type:'error',message:error.message});}};
