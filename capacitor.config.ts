import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.namello.app",
  appName: "Namello",
  webDir: "dist",
  android: {
    backgroundColor: "#030922"
  },
  plugins: {
    LocalNotifications: {
      // monochrome icon copied into android/ by scripts/configure-android.mjs
      smallIcon: "ic_stat_namello",
      iconColor: "#D4A64A"
    }
  }
};

export default config;
