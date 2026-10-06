const fs = require('fs'), vm = require('vm'), assert = require('assert/strict');
const root = process.argv[2] || require('path').resolve(__dirname);
const nodes = new Map(), storage = new Map();
const context = new Proxy({}, {get:()=>()=>{}});
function element(id='') { return {id,value:id==='mazeSize'?'12':id==='evolutionGenerations'?'5':id==='evolutionSeed'?'20261006':'',disabled:false,style:{},children:[],classList:{add(){},remove(){}},getContext:()=>context,addEventListener(){},before(){},append(...v){this.children.push(...v)},replaceChildren(){this.children=[]},scrollIntoView(){},click(){},isConnected:true, getBoundingClientRect:()=>({left:0,top:0,width:900,height:900})}; }
const document = {getElementById:id=>{if(!nodes.has(id))nodes.set(id,element(id));return nodes.get(id)},createElement:()=>element(),querySelector:()=>element(),querySelectorAll:()=>Array.from(nodes.values())};
const sandbox={document,console,performance,Blob,URL,Date,Math,Int32Array,Uint8Array,setTimeout:fn=>{fn();return 0},requestAnimationFrame(){},localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)}};
sandbox.window=sandbox;
let source=fs.readFileSync(root+'/app.js','utf8');
source=source.replace(/  createMaze\(\);\s*\}\)\(\);\s*$/, '  globalThis.lab={inspectGraph,mutateMaze,seededRandom,evaluateMaze,copyCells,getCells:()=>copyCells(cells)}; createMaze();\n})();');
vm.createContext(sandbox); vm.runInContext(source,sandbox);
const lab=sandbox.lab, initial=lab.getCells();
const edges=a=>a.reduce((sum,c,i)=>sum+(!c.E&&i%12<11?1:0)+(!c.S&&i<132?1:0),0);
let maze=initial, rng=lab.seededRandom(70);
for(let i=0;i<100;i++){maze=lab.mutateMaze(maze,rng);assert.equal(lab.inspectGraph(maze).reachable,144);assert.equal(edges(maze),edges(initial));}
assert.equal(JSON.stringify(lab.evaluateMaze(maze,[12,34,56])),JSON.stringify(lab.evaluateMaze(maze,[12,34,56])));
(async()=>{
 await nodes.get('evolutionStart').onclick();
 assert.match(nodes.get('evolutionStatus').textContent,/Finished/);
 const record=JSON.parse(storage.get('antlab-failures-v2'))[0];
 assert.equal(record.history.length,6); assert.equal(record.randomSearch.candidatesEvaluated,15);
 for(const r of [record.champion,record.randomSearch.champion]){assert.equal(lab.inspectGraph(r).reachable,144);assert.equal(edges(r),edges(initial));}
 for(let i=1;i<record.history.length;i++){assert.ok(record.history[i].fitness>=record.history[i-1].fitness);assert.ok(record.history[i].randomFitness>=record.history[i-1].randomFitness);}
 const target=record.finalTest.runs.find(r=>!r.success)||record.finalTest.runs[0];
 const repeated=lab.evaluateMaze(record.champion,[target.seed]).runs[0]; assert.equal(JSON.stringify(repeated),JSON.stringify(target));
 nodes.get('failureHall').children[0].children[1].onclick();assert.match(nodes.get('statusText').textContent,/Run code/);
 const out={status:'PASS',checks:['100 connected edge-preserving mutations','deterministic solver seeds','five-generation end-to-end flow','equal 15-candidate comparison budgets','monotonic selection fitness','saved-seed replay'],pilot:{size:12,generations:5,originalFailures:record.baselineTest.failures,evolvedFailures:record.finalTest.failures,randomFailures:record.randomSearch.freshSeedTest.failures},date:new Date().toISOString()};
 fs.mkdirSync(root+'/evidence',{recursive:true});fs.writeFileSync(root+'/evidence/automated-pilot.json',JSON.stringify(record,null,2));fs.writeFileSync(root+'/evidence/check-results.json',JSON.stringify(out,null,2));console.log(JSON.stringify(out,null,2));
})().catch(e=>{console.error(e);process.exitCode=1});



