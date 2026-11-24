import { describe, expect, it } from "vitest";
import { detectPlatform, installSteps } from "../../src/lib/install-help";

const UA = {
  iphoneSafari: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1",
  iphoneChrome: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0.6778.73 Mobile/15E148 Safari/604.1",
  ipadDesktopMode: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15",
  androidChrome: "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36",
  samsung: "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36",
  androidWebView: "Mozilla/5.0 (Linux; Android 14; Pixel 7; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/131.0.0.0 Mobile Safari/537.36",
  instagramIos: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 350.0.0",
  facebookAndroid: "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/480.0.0]",
  macChrome: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  windowsEdge: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0",
};

describe("install instructions", () => {
  it("recognises the browser the app is open in", () => {
    expect(detectPlatform(UA.iphoneSafari)).toBe("ios-safari");
    expect(detectPlatform(UA.iphoneChrome)).toBe("ios-other");
    expect(detectPlatform(UA.ipadDesktopMode, 5)).toBe("ios-safari");
    expect(detectPlatform(UA.ipadDesktopMode, 0)).toBe("desktop"); // a real Mac
    expect(detectPlatform(UA.androidChrome)).toBe("android-chrome");
    expect(detectPlatform(UA.samsung)).toBe("android-samsung");
    expect(detectPlatform(UA.androidWebView)).toBe("in-app");
    expect(detectPlatform(UA.instagramIos)).toBe("in-app");
    expect(detectPlatform(UA.facebookAndroid)).toBe("in-app");
    expect(detectPlatform(UA.macChrome)).toBe("desktop");
    expect(detectPlatform(UA.windowsEdge)).toBe("desktop");
  });

  it("gives every platform concrete steps", () => {
    expect(installSteps("ios-safari").steps.join(" ")).toMatch(/Add to Home Screen/);
    expect(installSteps("android-chrome").steps.join(" ")).toMatch(/Install app/);
    expect(installSteps("in-app").steps.join(" ")).toMatch(/Open in browser/);
    for (const p of ["ios-safari", "ios-other", "android-chrome", "android-samsung", "android-firefox", "in-app", "desktop"] as const) {
      expect(installSteps(p).steps.length).toBeGreaterThanOrEqual(2);
    }
  });
});
