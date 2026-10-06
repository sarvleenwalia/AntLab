import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Chess } from './chess-rules.mjs';
import { searchPosition,MATE_PUZZLE } from './chess-engine.mjs';
const initial=new Chess().fen();
const settings={ants:48,depth:4,seed:1234};
const a=await searchPosition(initial,settings),b=await searchPosition(initial,settings);
assert.deepEqual(a,b);assert.equal(a.completed,48);
const game=new Chess(initial);assert.ok(game.moves({verbose:true}).some(m=>m.from===a.best.from&&m.to===a.best.to));
for(const row of a.ranking){const replay=new Chess(initial);for(const move of row.line)assert.ok(replay.move(move));}
assert.equal(new Chess().fen(),initial);
const mate=await searchPosition(MATE_PUZZLE,settings),puzzle=new Chess(MATE_PUZZLE);puzzle.move(mate.best);assert.ok(puzzle.isCheckmate());
const done=await searchPosition(puzzle.fen(),settings);assert.equal(done.best,null);
const stopped=await searchPosition(initial,{...settings,shouldStop:()=>true});assert.equal(stopped.completed,0);assert.ok(stopped.stopped);
const report={status:'PASS',checks:['deterministic repeated search','returned root move is legal','every saved rollout is legal','checkmate-in-one found','terminal position returns no move','cancelled search stops'],date:new Date().toISOString()};
fs.writeFileSync(new URL('./chess-check-results.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));

