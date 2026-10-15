import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const html = fs.readFileSync("index.html", "utf8");
const i = html.indexOf("function nmTimeHeatmapModel(trades){");
const j = html.indexOf("function NmTimeHeatmapPanel(");
assert.ok(i > 0 && j > i);
const model = new Function(html.slice(i, j) + "; return nmTimeHeatmapModel;")();

test("heatmap model aggregates by weekday and hour", () => {
  const t = (date, time, pnl) => ({ status: "closed", date, time, pnl });
  const m = model([t("2025-01-06", "09:15", 10), t("2025-01-06", "09:40", -4), t("2025-01-07", "14:00", 5), { status: "open", pnl: 99 }]);
  assert.equal(m.n, 3);
  assert.equal(m.cells["1_9"].n, 2);
  assert.equal(m.cells["1_9"].pnl, 6);
  assert.equal(m.hist, null);
});
test("heatmap model tolerates bad data and builds histogram", () => {
  const rows = Array.from({ length: 20 }, (_, k) => ({ status: "closed", date: "bad", time: "", pnl: k - 8 }));
  const m = model(rows);
  assert.equal(m.n, 20);
  assert.ok(m.hist && m.hist.counts.reduce((a, b) => a + b, 0) === 20);
  assert.deepEqual(model([]).n, 0);
});
test("panel is wired into advanced section behind a soft boundary", () => {
  assert.match(html, /RE\(NmSoftBoundary,null,RE\(NmTimeHeatmapPanel,\{trades:filtered\}\)\)/);
});
