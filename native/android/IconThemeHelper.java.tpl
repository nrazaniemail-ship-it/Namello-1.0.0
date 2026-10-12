package __PACKAGE__;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;

import java.util.Calendar;

/**
 * Namello - launcher icon helper (generated from native/android/IconThemeHelper.java.tpl).
 *
 * Two modes, both implemented with <activity-alias> entries written by scripts/configure-android.mjs:
 *   - fixed theme  : LauncherDefault / LauncherMidnight / ... (one alias per theme)
 *   - weekly theme : LauncherDaySun ... LauncherDaySat (one alias per weekday); the alias of
 *                    today is enabled and a daily alarm (shortly after midnight) switches it.
 * The same icon is used by the floating return button (currentDrawableName()).
 */
public final class IconThemeHelper {

    static final String PREFS = "namello_native";
    static final String KEY_THEME = "icon_theme";
    static final String KEY_WEEKLY = "icon_weekly";

    /** Must match NM_ICON_THEMES keys in index.html and the aliases written by configure-android.mjs. */
    static final String[] THEMES = {"default", "midnight", "emerald", "royal", "graphite", "sunset", "ruby"};
    /** Index = Calendar.DAY_OF_WEEK - 1 (Sunday first). Must match NM_ICON_WEEK keys in index.html. */
    static final String[] DAYS = {"sun", "mon", "tue", "wed", "thu", "fri", "sat"};

    private static final int ALARM_REQUEST = 7021;

    private IconThemeHelper() {
    }

    private static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    public static boolean isValidTheme(String key) {
        for (String t : THEMES) if (t.equals(key)) return true;
        return false;
    }

    public static boolean isWeekly(Context context) {
        return prefs(context).getBoolean(KEY_WEEKLY, false);
    }

    public static String fixedTheme(Context context) {
        String t = prefs(context).getString(KEY_THEME, "default");
        return isValidTheme(t) ? t : "default";
    }

    public static void saveFixedTheme(Context context, String key) {
        if (isValidTheme(key)) prefs(context).edit().putString(KEY_THEME, key).apply();
    }

    public static void saveWeekly(Context context, boolean weekly) {
        prefs(context).edit().putBoolean(KEY_WEEKLY, weekly).apply();
    }

    public static String todayKey() {
        return DAYS[Calendar.getInstance().get(Calendar.DAY_OF_WEEK) - 1];
    }

    /** Drawable resource name of the icon that is currently active (fixed theme or today's image). */
    public static String currentDrawableName(Context context) {
        if (isWeekly(context)) return "namello_launcher_day_" + todayKey();
        String theme = fixedTheme(context);
        return "default".equals(theme) ? "namello_launcher" : "namello_launcher_" + theme;
    }

    private static String namespace() {
        String cls = MainActivity.class.getName();
        return cls.substring(0, cls.lastIndexOf('.'));
    }

    private static String cap(String s) {
        return Character.toUpperCase(s.charAt(0)) + s.substring(1);
    }

    /** Enables the alias that matches the current mode and disables all the others. */
    public static void apply(Context context) {
        final String wanted = isWeekly(context)
                ? "LauncherDay" + cap(todayKey())
                : "Launcher" + cap(fixedTheme(context));
        PackageManager pm = context.getPackageManager();
        String ns = namespace();
        // pass 0: enable the wanted alias (never leave the app without a launcher entry); pass 1: disable the rest
        for (int pass = 0; pass < 2; pass++) {
            for (String theme : THEMES) {
                toggle(pm, context, ns + ".Launcher" + cap(theme), ("Launcher" + cap(theme)).equals(wanted), pass,
                        "default".equals(theme));
            }
            for (String day : DAYS) {
                toggle(pm, context, ns + ".LauncherDay" + cap(day), ("LauncherDay" + cap(day)).equals(wanted), pass, false);
            }
        }
    }

    private static void toggle(PackageManager pm, Context context, String className, boolean wanted, int pass,
                               boolean enabledInManifest) {
        if (wanted != (pass == 0)) return;
        try {
            ComponentName component = new ComponentName(context.getPackageName(), className);
            int state = pm.getComponentEnabledSetting(component);
            boolean isEnabled = state == PackageManager.COMPONENT_ENABLED_STATE_ENABLED
                    || (state == PackageManager.COMPONENT_ENABLED_STATE_DEFAULT && enabledInManifest);
            if (isEnabled == wanted) return; // nothing to change -> no launcher refresh / flicker
            pm.setComponentEnabledSetting(
                    component,
                    wanted ? PackageManager.COMPONENT_ENABLED_STATE_ENABLED : PackageManager.COMPONENT_ENABLED_STATE_DISABLED,
                    PackageManager.DONT_KILL_APP);
        } catch (Throwable ignored) {
        }
    }

    /** Schedules (weekly mode) or cancels (fixed mode) the alarm that switches the icon after midnight. */
    public static void scheduleNext(Context context) {
        try {
            AlarmManager alarm = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
            if (alarm == null) return;
            Intent intent = new Intent(context, DailyIconReceiver.class);
            PendingIntent pending = PendingIntent.getBroadcast(
                    context, ALARM_REQUEST, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            if (!isWeekly(context)) {
                alarm.cancel(pending);
                return;
            }
            Calendar next = Calendar.getInstance();
            next.add(Calendar.DAY_OF_YEAR, 1);
            next.set(Calendar.HOUR_OF_DAY, 0);
            next.set(Calendar.MINUTE, 1);
            next.set(Calendar.SECOND, 0);
            next.set(Calendar.MILLISECOND, 0);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                alarm.setAndAllowWhileIdle(AlarmManager.RTC, next.getTimeInMillis(), pending);
            } else {
                alarm.set(AlarmManager.RTC, next.getTimeInMillis(), pending);
            }
        } catch (Throwable ignored) {
        }
    }
}
