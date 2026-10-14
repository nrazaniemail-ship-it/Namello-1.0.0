import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const js=fs.readFileSync("index_scripts/16.js","utf8");
const server=fs.readFileSync("backend/server.mjs","utf8");
test("backend LLM proxy is authenticated and env-configured",()=>{assert.ok(server.includes("app.post('/v1/llm/strategic', auth"));assert.ok(server.includes("NAMELLO_LLM_API_KEY"));assert.ok(server.includes("NAMELLO_LLM_API_URL"));});
test("version contract",()=>{const v=JSON.parse(fs.readFileSync("version.json","utf8"));assert.match(v.version,/^\d+\.\d+\.\d+$/);assert.ok(Number.isInteger(v.versionCode));assert.ok(js.includes(`NM_VERSION_NAME = "${v.version}"`));assert.ok(js.includes(`NM_VERSION_CODE = ${v.versionCode}`));});
