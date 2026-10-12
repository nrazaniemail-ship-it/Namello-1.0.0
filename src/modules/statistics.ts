export type Trade={pnl?:number;status?:string;date?:string;time?:string};
export function winRate(trades:Trade[]){const c=trades.filter(t=>t.status==="closed");return c.length?c.filter(t=>(t.pnl||0)>0).length/c.length*100:0;}
export function expectancy(trades:Trade[]){const c=trades.filter(t=>t.status==="closed");return c.length?c.reduce((s,t)=>s+(Number(t.pnl)||0),0)/c.length:null;}
export function profitFactor(trades:Trade[]){const c=trades.filter(t=>t.status==="closed"),w=c.filter(t=>(t.pnl||0)>0).reduce((s,t)=>s+Number(t.pnl),0),l=Math.abs(c.filter(t=>(t.pnl||0)<0).reduce((s,t)=>s+Number(t.pnl),0));return l?w/l:(w?Infinity:0);}
