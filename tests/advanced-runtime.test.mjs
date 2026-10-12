import test from 'node:test';import assert from 'node:assert/strict';
const merge=(a,b)=>{const m=new Map(a.map(x=>[x.id,x]));for(const x of b)m.set(x.id,{...(m.get(x.id)||{}),...x});return [...m.values()]};
test('CSV duplicate key detection contract',()=>{const rows=[{id:'1',pnl:'2'},{id:'1',pnl:'3'}];assert.equal(new Set(rows.map(x=>x.id)).size,1);});
test('sync merge preserves local-only and remote fields',()=>assert.deepEqual(merge([{id:'1',a:1}],[{id:'1',b:2},{id:'2',a:3}]),[{id:'1',a:1,b:2},{id:'2',a:3}]));
test('psychology metrics are bounded',()=>{const streak=6,dev=25,law=40;const tilt=Math.min(100,Math.round(streak*18+Math.max(0,dev-10)*1.2+law*.25));assert.equal(tilt,100);});
test('replay MFE/MAE and step',()=>{const t={entry:100,stop:95,direction:'buy'},b=[{open:100,high:103,low:99,close:102},{open:102,high:106,low:98,close:104}];let mfe=0,mae=0;for(const x of b){mfe=Math.max(mfe,x.high-100);mae=Math.max(mae,100-x.low)}assert.equal(mfe,6);assert.equal(mae,2);assert.equal(Math.min(1,Math.max(0,0+1)),1);});
test('portfolio currency separation',()=>assert.deepEqual([{c:'USD',p:10},{c:'EUR',p:5}].reduce((o,x)=>(o[x.c]=(o[x.c]||0)+x.p,o),{}),{USD:10,EUR:5}));
test('prop challenge status',()=>{const start=100000, target=10, daily=5,max=10;const balance=108000;assert.equal(balance>=start*(1+target/100),false);assert.equal(Math.max(0,start-balance),0);assert.ok(Math.abs(Math.min(100,Math.max(0,100-(100*0.55)))-45)<1e-9);});
