import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const html = fs.readFileSync("index.html", "utf8");

test("template snapshot stores and restores journal custom forms and other layers", () => {
  const m = /const NM_TEMPLATE_STORAGE_KEYS = \[([\s\S]*?)\];/.exec(html);
  assert.ok(m);
  const keys = [...m[1].matchAll(/"(namello_[a-z0-9_]+)"/g)].map(x => x[1]);
  for (const k of ["namello_custom_trade_fields_v1", "namello_custom_trade_field_profiles_v1", "namello_custom_trade_field_entry_mode_v1", "namello_custom_trade_field_result_mode_v1", "namello_journal_forms_state_v1", "namello_guide_levels_main_v1", "namello_guide_levels_entry_v1", "namello_discipline_options_v1", "namello_calendar_settings_v1", "namello_widget_settings_v1", "namello_text_notification_settings_v1", "namello_motivational_settings_v1"])
    assert.ok(keys.includes(k), k);
  for (const k of ["namello_security_v1", "namello_anthropic_key_v1", "namello_users_v1", "namello_templates_v1", "namello_backend_session_v1"])
    assert.ok(!keys.includes(k), "must not leak " + k);
  assert.match(html, /snap\.storageKeys = await nmTemplateReadStorage\(\)/);
  assert.match(html, /if \(snap\.storageKeys\) \{/);
  assert.match(html, /key: "disciplineOptions"/);
});
