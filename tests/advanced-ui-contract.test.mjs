import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const js=fs.readFileSync("index_scripts/16.js","utf8");
const html=fs.readFileSync("index.html","utf8");

test("1.0.22 advanced evaluation has six numbered collapsible sections",()=>{
  for(const n of ["۱","۲","۳","۴","۵","۶"]) assert.match(js,new RegExp(`number:"${n}"`));
  assert.match(js,/NmAdvancedSection/);
  assert.match(js,/NM_ADVANCED_SECTION_GUIDES/);
});

test("1.0.22 strategic engine tabs use a two-row four-column grid",()=>{
  assert.match(js,/grid grid-cols-4 gap-1\.5 mt-3 w-full/);
  assert.match(js,/موتور روایت/);
  assert.match(js,/موتور Edge شرطی/);
  assert.match(js,/موتور رفتار و انضباط/);
  assert.match(js,/موتور Attribution سیستم/);
  assert.match(js,/موتور سناریو و هدف/);
  assert.match(js,/موتور تصمیم/);
  assert.match(js,/موتور LLM/);
});

test("1.0.22 standalone index has the same two-row engine layout",()=>{
  assert.match(html,/grid grid-cols-4 gap-1\.5 mt-3 w-full/);
  assert.match(html,/موتور Attribution سیستم/);
});
