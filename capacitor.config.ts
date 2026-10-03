import type { CapacitorConfig } from "@capacitor/cli";

// The app uses server functions, so the native shell loads the live published site.
const config: CapacitorConfig = {
  appId: "com.goldsmith.calculator",
  appName: "حاسبة الصاغة",
  webDir: "capacitor-www",
  server: {
    url: "https://project--7da41215-bb33-4b82-8f31-85dc7d8f6b63.lovable.app",
    cleartext: false,
  },
  android: { backgroundColor: "#121212" },
  ios: { backgroundColor: "#121212", contentInset: "always" },
};

export default config;
