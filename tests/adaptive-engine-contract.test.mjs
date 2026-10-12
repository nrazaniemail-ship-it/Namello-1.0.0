import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const js=fs.readFileSync('index_scripts/16.js','utf8');
test('1.0.20 adaptive engine helpers exist',()=>{for(const n of ['nmStrRegimeTransition','nmStrRegimeRisk','nmStrRegimeForecast','nmStrAdaptiveDecay','nmStrAdaptiveStrategy','nmStrDecisionEngine'])assert.match(js,new RegExp(`function ${n}\\(`));});
test('1.0.20 engine exposes adaptive layers',()=>{for(const k of ['transition','risk','forecast','adaptiveDecay','psychology']) assert.match(js,new RegExp(`out\\.regime\\.${k}`)); assert.ok(js.includes('out.strategy.adaptive'));assert.ok(js.includes('out.decision'));});
test('version contract',()=>{const v=JSON.parse(fs.readFileSync('version.json','utf8'));assert.match(v.version,/^\d+\.\d+\.\d+$/);assert.ok(Number.isInteger(v.versionCode));assert.ok(js.includes(`NM_VERSION_NAME = "${v.version}"`));assert.ok(js.includes(`NM_VERSION_CODE = ${v.versionCode}`));});
