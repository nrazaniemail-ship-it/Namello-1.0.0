import test from "node:test"; import assert from "node:assert/strict";
test("crypto runtime exists",()=>assert.equal(typeof globalThis.crypto,"object"));
