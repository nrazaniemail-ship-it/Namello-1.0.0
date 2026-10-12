export type AccountSummary={id?:string;name?:string;pnl?:number;count?:number;startingBalance?:number;currency?:string};
export function aggregate(accounts:AccountSummary[]){return accounts.reduce<{pnl:number;count:number}>((s,a)=>({pnl:s.pnl+(Number(a.pnl)||0),count:s.count+(Number(a.count)||0)}),{pnl:0,count:0});}
export function aggregateByCurrency(accounts:AccountSummary[]){const out:Record<string,{pnl:number;count:number}>={};for(const a of accounts){const c=a.currency||'USD';out[c]??={pnl:0,count:0};out[c].pnl+=Number(a.pnl)||0;out[c].count+=Number(a.count)||0;}return out;}
