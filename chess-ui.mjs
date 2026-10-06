import { Chess } from './chess-rules.mjs';
import { MATE_PUZZLE } from './chess-engine.mjs';
const $=id=>document.getElementById(id), game=new Chess();
const pieces={wk:'♔',wq:'♕',wr:'♖',wb:'♗',wn:'♘',wp:'♙',bk:'♚',bq:'♛',br:'♜',bb:'♝',bn:'♞',bp:'♟'};
const names={k:'king',q:'queen',r:'rook',b:'bishop',n:'knight',p:'pawn'};
let selected=null,lastMove=null,worker=null,busy=false,search=null,lastSearch=null;
function status(){return game.isCheckmate()?`${game.turn()==='w'?'Black':'White'} wins by checkmate.`:game.isDraw()?'The game is a draw.':`${game.turn()==='w'?'White':'Black'} to move${game.isCheck()?' — in check':''}.`;}
function render(){
 $('chessBoard').replaceChildren();const possible=selected?game.moves({square:selected,verbose:true}).map(m=>m.to):[];
 for(let y=0;y<8;y++)for(let x=0;x<8;x++){
  const square='abcdefgh'[x]+(8-y),piece=game.get(square),b=document.createElement('button');
  b.className='chess-square'+((x+y)%2?' dark':'')+(piece?.color==='w'?' white-piece':'')+(square===selected?' selected':'')+(possible.includes(square)?' possible':'')+([lastMove?.from,lastMove?.to].includes(square)?' last-move':'');
  b.setAttribute('aria-label',`${square}${piece?' '+(piece.color==='w'?'white':'black')+' '+names[piece.type]:' empty'}${possible.includes(square)?', legal destination':''}`);
  b.disabled=busy||game.isGameOver();b.textContent=piece?pieces[piece.color+piece.type]:'';
  if(x===0||y===7){const c=document.createElement('span');c.className='coordinate';c.textContent=x===0&&y===7?'a1':x===0?String(8-y):'abcdefgh'[x];b.append(c);}
  b.onclick=()=>{if(busy)return;if(selected&&possible.includes(square)){play({from:selected,to:square,promotion:$('promotionPiece').value});return;}selected=piece?.color===game.turn()?square:null;render();};
  $('chessBoard').append(b);
 }
 $('turnLabel').textContent=status();$('chessStatus').textContent=status();
 $('thinkButton').disabled=busy||game.isGameOver();$('stopThinking').disabled=!busy;
 $('newGame').disabled=busy;$('loadPuzzle').disabled=busy;$('undoMove').disabled=busy||game.history().length===0;
 for(const id of ['antCount','chessSeed','promotionPiece','autoReply'])$(id).disabled=busy;
 $('playBest').disabled=busy||!search?.best||search.fen!==game.fen()||game.isGameOver();
 $('downloadChess').disabled=busy||!lastSearch;
}
function play(move){try{lastMove=game.move(move);selected=null;search=null;render();if($('autoReply').checked&&game.turn()==='b'&&!game.isGameOver())think(true);}catch(_){$('chessStatus').textContent='That move is not allowed. Choose a marked square.';}}
function showRanking(ranking){$('moveRanking').replaceChildren();ranking.slice(0,5).forEach(r=>{const row=document.createElement('div');row.className='move-row';const name=document.createElement('b');name.textContent=r.san;const bar=document.createElement('div');bar.className='move-bar';const fill=document.createElement('span');fill.style.width=Math.max(3,Math.min(100,(r.mean+1)*50))+'%';bar.append(fill);const count=document.createElement('small');count.textContent=r.visits+' tries';row.append(name,bar,count);$('moveRanking').append(row);});}
function think(autoPlay=false){
 if(busy||game.isGameOver())return;
 const seed=Number($('chessSeed').value);if(!Number.isInteger(seed)||seed<0||seed>4294967295){$('searchStatus').textContent='Use a whole-number repeat code between 0 and 4294967295.';return;}
 busy=true;search=null;selected=null;render();const ants=Number($('antCount').value);$('searchProgress').max=ants;$('searchProgress').value=0;$('searchStatus').textContent='Ants are trying different moves…';$('moveRanking').replaceChildren();
 try{worker=new Worker(new URL('./chess-worker.mjs',import.meta.url),{type:'module'});}catch(error){busy=false;$('searchStatus').textContent='Could not start the search. Open the hosted site or use a local web server.';render();return;}
 worker.onmessage=({data})=>{
  if(data.type==='progress'){$('searchProgress').value=data.progress.completed;$('searchStatus').textContent=`${data.progress.completed} of ${data.progress.total} ant attempts`;showRanking(data.progress.ranking);}
  else if(data.type==='result'){search=data.result;lastSearch=search;busy=false;worker.terminate();worker=null;showRanking(search.ranking);$('searchStatus').textContent=search.best?`The ants ${autoPlay?'played':'suggest'} ${search.bestSan}. ${search.completed} attempts completed.`:'No move is available.';$('searchLine').textContent=search.line.length?'One attempt: '+search.line.join(' → '):'The game has ended.';render();if(autoPlay&&search.best)play(search.best);}
  else if(data.type==='error'){busy=false;worker.terminate();worker=null;$('searchStatus').textContent=data.message;render();}
 };
 worker.onerror=()=>{busy=false;worker?.terminate();worker=null;$('searchStatus').textContent='The search could not load. Please refresh the hosted page.';render();};
 worker.postMessage({fen:game.fen(),settings:{ants,depth:6,seed}});
}
function reset(puzzle=false){game.reset();if(puzzle)game.load(MATE_PUZZLE);selected=null;lastMove=null;search=null;lastSearch=null;$('moveRanking').replaceChildren();$('searchLine').textContent=puzzle?'White can checkmate in one move. Can the ants find it?':'Search a position to see one of their move sequences.';$('searchStatus').textContent='No search yet.';$('searchProgress').value=0;render();}
$('thinkButton').onclick=()=>think();$('stopThinking').onclick=()=>{worker?.terminate();worker=null;busy=false;search=null;$('searchStatus').textContent='Stopped. No move was played.';render();};
$('playBest').onclick=()=>{if(search?.best&&search.fen===game.fen())play(search.best);};
$('newGame').onclick=()=>reset();$('loadPuzzle').onclick=()=>reset(true);
$('undoMove').onclick=()=>{game.undo();if($('autoReply').checked&&game.turn()==='b'&&game.history().length)game.undo();lastMove=null;selected=null;search=null;render();};
$('downloadChess').onclick=()=>{if(!lastSearch)return;const a=document.createElement('a'),url=URL.createObjectURL(new Blob([JSON.stringify(lastSearch,null,2)],{type:'application/json'}));a.href=url;a.download='antlab-chess-search.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
render();
