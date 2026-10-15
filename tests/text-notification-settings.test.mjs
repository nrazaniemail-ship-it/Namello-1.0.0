import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const app = await readFile('index.html', 'utf8');
const bridge = await readFile('native-bridge.js', 'utf8');
const sw = await readFile('public/sw.js', 'utf8');

test('central text-notification settings expose five independent persisted categories', () => {
  assert.ok(app.includes('namello_text_notification_settings_v1'));
  assert.ok(app.includes('function nmTextNotifLoadSettings()'));
  assert.ok(app.includes('function nmTextNotifSaveSettings(next)'));
  assert.ok(app.includes('function NmNotificationTextSettings({ embedded })'));
  for (const category of ['sessions', 'news', 'evaluation', 'psychology', 'motivation']) {
    assert.match(app, new RegExp(`${category}: true`));
    assert.ok(app.includes(`"${category}"`), `missing category ${category}`);
  }
  assert.ok(app.includes('RE(NmNotificationsSettings, {'));
});

test('session and news notifications respect global category toggles and include category metadata/artwork', () => {
  assert.match(app, /function fireNotification\(title, body, category = "sessions"\)/);
  assert.match(app, /if \(!nmTextNotifEnabled\(category\)\) return;/);
  assert.match(app, /data: \{ kind: category, category \}/);
  assert.match(app, /fireNotification\(`شروع \$\{ev\.name\}`, `\$\{ev\.kind\} «\$\{ev\.name\}» شروع شد\.`, "sessions"\)/);
  assert.match(app, /fireNotification\(`خبر: \$\{ev\.title\}`,[\s\S]{0,250}"news"\)/);
  for (const file of ['01-evaluation.png','02-psychology.png','03-sessions-and-events.png','04-news.png','05-motivation.png']) {
    assert.ok(app.includes(file));
    assert.ok(sw.includes(file), `service worker does not cache ${file}`);
  }
});

test('advanced and psychology recommendation cards stay in their sections and are the notification source', () => {
  assert.ok(app.includes('RE(NmDashboardRecommendations,{title:"توصیه",recommendations:advancedRecommendations,accent:"#F59E0B"}'));
  assert.ok(app.includes('RE(NmDashboardRecommendations, { title:"توصیه", recommendations, accent:"#14B8A6" }'));
  assert.equal(app.includes('RE(NmDashboardAIArm,{mode:"advanced",trades:filtered}'), false);
  assert.equal(app.includes('RE(NmDashboardAIArm, { mode:"psych", trades }'), false);
  assert.ok(app.includes('nmSendTextCategoryNotification(category'));
  assert.ok(app.includes('namello_text_notif_sent_'));
});

test('Android background scheduler honors central category settings and resyncs when toggles change', () => {
  assert.ok(bridge.includes("var KEY_TEXT_NOTIFS = 'namello_text_notification_settings_v1'"));
  assert.ok(bridge.includes("window.addEventListener('namello-text-notification-settings'"));
  assert.ok(bridge.includes("textPrefs[category] !== false"));
});
