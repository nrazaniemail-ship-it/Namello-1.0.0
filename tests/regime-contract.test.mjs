import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const src=fs.readFileSync(new URL("../index_scripts/16.js",import.meta.url),"utf8");
test("OHLC regime engine contract exists",()=>{
  for(const token of ["nmStrOhlcPath","nmStrOhlcFeatures","nmStrOhlcRegimeFeatures","nmStrOhlcGroups","ohlc_volatility","ohlc_trend_range","ohlc_combined"]){assert.ok(src.includes(token),token);}
});
test("OHLC regime uses relative volatility and efficiency ratio",()=>{
  assert.match(src,/volatility:vol/);
  assert.match(src,/efficiencyRatio:er/);
  assert.match(src,/v33=nmStrQuantile\(vols,.33\)/);
  assert.match(src,/v66=nmStrQuantile\(vols,.66\)/);
});
test("version contract",()=>{const v=JSON.parse(fs.readFileSync(new URL("../version.json",import.meta.url),"utf8"));assert.match(v.version,/^\d+\.\d+\.\d+$/);assert.ok(Number.isInteger(v.versionCode));});
