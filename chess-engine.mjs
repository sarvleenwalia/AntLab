import { Chess } from './chess-rules.mjs';
const values={p:1,n:3.2,b:3.3,r:5,q:9,k:0};
export const MATE_PUZZLE='6k1/8/5K1Q/8/8/8/8/8 w - - 0 1';
export function seededRandom(seed){let s=seed>>>0;return()=>{s+=0x6D2B79F5;let t=Math.imul(s^s>>>15,s|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
export function evaluate(game,color){
 if(game.isCheckmate())return game.turn()===color?-1000:1000;
 if(game.isDraw())return 0;
 let score=0;
 game.board().forEach((row,y)=>row.forEach((p,x)=>{if(!p)return;const centre=(3.5-Math.abs(3.5-x))+(3.5-Math.abs(3.5-y));let bonus=p.type==='p'?0.035*(p.color==='w'?6-y:y-1):['n','b'].includes(p.type)?0.04*centre:0;score+=(p.color===color?1:-1)*(values[p.type]+bonus);}));
 return score;
}
const moveWeight=m=>1+(m.captured?values[m.captured]*2:0)+(m.promotion?8:0)+(m.san.includes('+')?1.5:0)+(m.san.includes('#')?1000:0);
function choose(options,weights,rng){let pick=rng()*weights.reduce((a,b)=>a+b,0);for(let i=0;i<options.length;i++){pick-=weights[i];if(pick<=0)return options[i];}return options.at(-1);}
export async function searchPosition(fen,{ants=192,depth=6,seed=20261006,onProgress=()=>{},shouldStop=()=>false}={}){
 if(!Number.isInteger(ants)||ants<1||ants>1000||!Number.isInteger(depth)||depth<1||depth>12)throw Error('Choose a supported search size.');
 const root=new Chess(fen),color=root.turn(),moves=root.moves({verbose:true}),rng=seededRandom(seed),trails=new Map();
 if(!moves.length)return {fen,color,best:null,completed:0,ranking:[],line:[],reason:root.isCheckmate()?'checkmate':'draw'};
 if(root.isGameOver())return {fen,color,best:null,completed:0,ranking:[],line:[],reason:'draw'};
 const stats=moves.map(move=>({san:move.san,move:{from:move.from,to:move.to,...(move.promotion?{promotion:move.promotion}:{})},visits:0,total:0,prior:0,mate:false,losesToMate:false,line:[],bestReward:-Infinity}));
 // Exact immediate mate checks are a small tactical guard, separate from stochastic ants.
 for(const s of stats){root.move(s.move);s.prior=evaluate(root,color);s.mate=root.isCheckmate();if(!s.mate)for(const reply of root.moves()){root.move(reply);const loses=root.isCheckmate();root.undo();if(loses){s.losesToMate=true;break;}}root.undo();}
 const rank=()=>stats.map(s=>({...s,mean:s.visits?s.total/s.visits:0,quality:s.mate?100:s.losesToMate?-100:(s.visits?s.total/s.visits:0)+0.005*s.prior})).sort((a,b)=>b.quality-a.quality||b.visits-a.visits||a.san.localeCompare(b.san));
 let completed=0;
 for(let ant=0;ant<ants;ant++){
  if(shouldStop())break;
  let s;
  if(ant<stats.length)s=stats[ant];
  else s=choose(stats,stats.map(s=>s.mate?200:s.losesToMate?0.01:Math.pow(trails.get('root:'+s.san)||1,1.1)*(1+1/Math.sqrt(s.visits+1))),rng);
  // Each rollout starts from the supplied position; pre-FEN history is unavailable.
  const game=new Chess(fen),line=[s.san],visited=['root:'+s.san];game.move(s.move);
  for(let ply=1;ply<depth&&!game.isGameOver();ply++){
   const legal=game.moves({verbose:true}),prefix=game.fen()+'|';
   const chosen=choose(legal,legal.map(m=>Math.pow(trails.get(prefix+m.san)||1,1.1)*moveWeight(m)),rng);
   visited.push({key:prefix+chosen.san,color:game.turn()});line.push(chosen.san);game.move(chosen);
  }
  const value=evaluate(game,color),reward=value>=999?1:value<=-999?-1:Math.tanh(value/8);
  s.visits++;s.total+=reward;if(reward>s.bestReward){s.bestReward=reward;s.line=line;}
  const rootKey=visited[0];trails.set(rootKey,(trails.get(rootKey)||1)+0.1+0.6*(reward+1)/2);
  for(const edge of visited.slice(1)){const localReward=edge.color===color?reward:-reward;trails.set(edge.key,(trails.get(edge.key)||1)+0.05+0.3*(localReward+1)/2);}
  completed++;
  if(completed%12===0||completed===ants){
   for(const [key,value]of trails)trails.set(key,Math.max(0.1,value*0.9));
   onProgress({completed,total:ants,ranking:rank().slice(0,5)});
   await new Promise(resolve=>setTimeout(resolve,0));
  }
 }
 const ranking=rank(),best=ranking[0];
 return {format:'antlab-chess-search',version:1,fen,color,seed,ants,depth,completed,best:best.move,bestSan:best.san,ranking,line:best.line.length?best.line:[best.san],stopped:completed<ants,method:'pheromone-guided stochastic legal-move rollouts with immediate-mate guard',note:'Search scores are heuristic estimates, not win probabilities. Repetition history before the FEN is not reconstructed.'};
}
