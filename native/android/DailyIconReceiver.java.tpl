package __PACKAGE__;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * Namello - runs shortly after midnight (daily alarm), after a reboot and when the time / time zone
 * changes. In weekly icon mode it switches the launcher icon to today's image and schedules the next alarm.
 */
public class DailyIconReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        try {
            if (IconThemeHelper.isWeekly(context)) {
                IconThemeHelper.apply(context);
            }
            IconThemeHelper.scheduleNext(context);
        } catch (Throwable ignored) {
        }
    }
}
