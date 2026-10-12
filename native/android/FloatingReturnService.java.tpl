package __PACKAGE__;

import android.app.Service;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Outline;
import android.graphics.PixelFormat;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewConfiguration;
import android.view.ViewOutlineProvider;
import android.view.WindowManager;
import android.widget.ImageView;

/**
 * Namello - floating "return to Namello" button that stays on top of other apps (MT5, TradingView ...).
 *
 *  - needs the "Display over other apps" permission (SYSTEM_ALERT_WINDOW), requested from Settings;
 *  - a plain (non-foreground) service: NO notification is shown. The visible overlay window keeps the
 *    process at a high priority; if Android still closes it, the button comes back when Namello is opened;
 *  - hidden while Namello itself is on screen, shown as soon as the user leaves it;
 *  - can be dragged anywhere; it snaps to the nearest screen edge and remembers its position;
 *  - one tap brings Namello back to the front;
 *  - the button shows the SAME icon as the launcher: the fixed icon theme or, in weekly mode, today's
 *    image (IconThemeHelper). MainActivity calls refreshIcon() when it changes. No ring around the logo.
 * Started / stopped from the page through window.NamelloAndroid.enableFloatingReturn() / disableFloatingReturn().
 */
public class FloatingReturnService extends Service {

    private static final String PREFS = "namello_native";
    private static final String KEY_X = "floating_x";
    private static final String KEY_Y = "floating_y";

    private static volatile FloatingReturnService instance;
    private static volatile boolean appForeground = false;

    private final Handler main = new Handler(Looper.getMainLooper());
    private WindowManager windowManager;
    private ImageView button;
    private WindowManager.LayoutParams params;
    private int sizePx;

    /** Called by MainActivity: hide the button while Namello is visible, show it otherwise. */
    public static void setAppForeground(boolean foreground) {
        appForeground = foreground;
        final FloatingReturnService service = instance;
        if (service != null) {
            service.main.post(new Runnable() {
                @Override
                public void run() {
                    service.applyVisibility();
                }
            });
        }
    }

    /** Called by MainActivity after the launcher icon theme changed. */
    public static void refreshIcon() {
        final FloatingReturnService service = instance;
        if (service != null) {
            service.main.post(new Runnable() {
                @Override
                public void run() {
                    if (service.button != null) service.loadIcon(service.button);
                }
            });
        }
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        instance = this;
        if (button == null) {
            createButton();
        }
        applyVisibility();
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        instance = null;
        removeButton();
        super.onDestroy();
    }

    private void createButton() {
        try {
            final float density = getResources().getDisplayMetrics().density;
            sizePx = (int) (52 * density);
            final int screenW = getResources().getDisplayMetrics().widthPixels;
            final int screenH = getResources().getDisplayMetrics().heightPixels;
            windowManager = (WindowManager) getSystemService(WINDOW_SERVICE);

            ImageView view = new ImageView(this);
            view.setScaleType(ImageView.ScaleType.CENTER_CROP);
            // plain dark disc only as a fallback; the (opaque) logo covers it completely: no ring, no padding
            GradientDrawable disc = new GradientDrawable();
            disc.setShape(GradientDrawable.OVAL);
            disc.setColor(0xFF0B0E11);
            view.setBackground(disc);
            loadIcon(view);
            view.setClipToOutline(true);
            view.setOutlineProvider(new ViewOutlineProvider() {
                @Override
                public void getOutline(View v, Outline outline) {
                    outline.setOval(0, 0, v.getWidth(), v.getHeight());
                }
            });
            view.setElevation(6 * density);
            view.setContentDescription("بازگشت به Namello");

            int type = (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
                    ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
                    : WindowManager.LayoutParams.TYPE_PHONE;
            params = new WindowManager.LayoutParams(
                    sizePx, sizePx, type,
                    WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE | WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
                    PixelFormat.TRANSLUCENT);
            params.gravity = Gravity.TOP | Gravity.START;
            SharedPreferences prefs = getSharedPreferences(PREFS, MODE_PRIVATE);
            params.x = prefs.getInt(KEY_X, screenW - sizePx);
            params.y = prefs.getInt(KEY_Y, (int) (screenH * 0.4f));

            view.setOnTouchListener(new DragListener());
            windowManager.addView(view, params);
            button = view;
        } catch (Throwable t) {
            // overlay permission revoked or window could not be added
            button = null;
            stopSelf();
        }
    }

    /** Loads the launcher icon of the currently selected icon theme into the button. */
    private void loadIcon(ImageView target) {
        try {
            String name = IconThemeHelper.currentDrawableName(this);
            int id = getResources().getIdentifier(name, "drawable", getPackageName());
            if (id == 0) id = getResources().getIdentifier("namello_launcher", "drawable", getPackageName());
            if (id == 0) {
                target.setImageResource(android.R.drawable.ic_menu_revert);
                return;
            }
            BitmapFactory.Options bounds = new BitmapFactory.Options();
            bounds.inJustDecodeBounds = true;
            BitmapFactory.decodeResource(getResources(), id, bounds);
            int wanted = Math.max(1, sizePx * 2);
            int sample = 1;
            while (bounds.outWidth / (sample * 2) >= wanted) sample *= 2;
            BitmapFactory.Options options = new BitmapFactory.Options();
            options.inSampleSize = sample;
            Bitmap bitmap = BitmapFactory.decodeResource(getResources(), id, options);
            if (bitmap != null) {
                target.setImageBitmap(bitmap);
            } else {
                target.setImageResource(id);
            }
        } catch (Throwable ignored) {
        }
    }

    private void removeButton() {
        try {
            if (windowManager != null && button != null) {
                windowManager.removeView(button);
            }
        } catch (Throwable ignored) {
        }
        button = null;
    }

    private void applyVisibility() {
        if (button != null) {
            button.setVisibility(appForeground ? View.GONE : View.VISIBLE);
        }
    }

    private void openNamello() {
        try {
            Intent open = new Intent(this, MainActivity.class);
            open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK
                    | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT
                    | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            startActivity(open);
        } catch (Throwable ignored) {
        }
    }

    /** Tap = back to Namello, drag = move (snaps to the nearest edge). */
    private class DragListener implements View.OnTouchListener {
        private int startX;
        private int startY;
        private float touchX;
        private float touchY;
        private boolean moved;
        private final int slop = ViewConfiguration.get(FloatingReturnService.this).getScaledTouchSlop();

        @Override
        public boolean onTouch(View view, MotionEvent event) {
            switch (event.getAction()) {
                case MotionEvent.ACTION_DOWN:
                    startX = params.x;
                    startY = params.y;
                    touchX = event.getRawX();
                    touchY = event.getRawY();
                    moved = false;
                    return true;
                case MotionEvent.ACTION_MOVE: {
                    int dx = (int) (event.getRawX() - touchX);
                    int dy = (int) (event.getRawY() - touchY);
                    if (Math.abs(dx) > slop || Math.abs(dy) > slop) {
                        moved = true;
                    }
                    if (moved) {
                        params.x = startX + dx;
                        params.y = startY + dy;
                        try {
                            windowManager.updateViewLayout(view, params);
                        } catch (Throwable ignored) {
                        }
                    }
                    return true;
                }
                case MotionEvent.ACTION_UP:
                    if (!moved) {
                        openNamello();
                    } else {
                        snapToEdge(view);
                    }
                    return true;
                default:
                    return false;
            }
        }

        private void snapToEdge(View view) {
            int screenW = getResources().getDisplayMetrics().widthPixels;
            int screenH = getResources().getDisplayMetrics().heightPixels;
            params.x = (params.x + sizePx / 2 < screenW / 2) ? 0 : screenW - sizePx;
            params.y = Math.max(0, Math.min(params.y, screenH - sizePx));
            try {
                windowManager.updateViewLayout(view, params);
            } catch (Throwable ignored) {
            }
            getSharedPreferences(PREFS, MODE_PRIVATE).edit()
                    .putInt(KEY_X, params.x).putInt(KEY_Y, params.y).apply();
        }
    }
}
