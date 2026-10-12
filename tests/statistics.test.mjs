import test from "node:test"; import assert from "node:assert/strict";
function wr(t){const c=t.filter(x=>x.status==="closed");return c.length?c.filter(x=>x.pnl>0).length/c.length*100:0;}
test("win rate",()=>assert.equal(wr([{status:"closed",pnl:2},{status:"closed",pnl:-1}]),50));
