/**
 * Works out which browser the app is open in, so the install instructions match what's on screen.
 * Pure (takes the user agent) so it can be unit tested.
 */
export type InstallPlatform =
  | "ios-safari" // iPhone/iPad Safari: Share → Add to Home Screen
  | "ios-other" // Chrome/Edge/Firefox on iPhone: Share → Add to Home Screen (iOS 16.4+)
  | "android-chrome" // Chrome, Edge, Brave… on Android: ⋮ → Install app
  | "android-samsung" // Samsung Internet: ☰ → Add page to → Home screen
  | "android-firefox"
  | "in-app" // link opened inside WhatsApp, Facebook, Instagram, Gmail, LINE…: can't install from there
  | "desktop";

export function detectPlatform(ua: string, maxTouchPoints = 0): InstallPlatform {
  const iPadAsMac = /Macintosh/.test(ua) && maxTouchPoints > 1;
  const ios = /iPhone|iPad|iPod/.test(ua) || iPadAsMac;
  if (/FBAN|FBAV|FB_IAB|Instagram|Line\/|WhatsApp|MicroMessenger|GSA\/|; wv\)|TikTok|Snapchat/.test(ua)) return "in-app";
  if (ios) return /CriOS|FxiOS|EdgiOS|OPiOS|Brave/.test(ua) ? "ios-other" : "ios-safari";
  if (/Android/.test(ua)) {
    if (/SamsungBrowser/.test(ua)) return "android-samsung";
    if (/Firefox/.test(ua)) return "android-firefox";
    return "android-chrome";
  }
  return "desktop";
}

export interface InstallSteps {
  title: string;
  steps: string[];
  note?: string;
}

export function installSteps(p: InstallPlatform): InstallSteps {
  const keep = "Always open LittleSteps from the Home Screen icon. Your diary lives inside the installed app.";
  switch (p) {
    case "ios-safari":
      return {
        title: "Add to your iPhone Home Screen",
        steps: ["Tap the Share button (the square with an arrow) at the bottom of Safari, or top right on iPad.", "Scroll down and tap “Add to Home Screen”.", "Tap “Add”. The LittleSteps icon appears on your Home Screen."],
        note: `${keep} Safari can clear data of websites you haven't opened for a while, but not of Home Screen apps.`,
      };
    case "ios-other":
      return {
        title: "Add to your iPhone Home Screen",
        steps: ["Tap the Share button in the address bar (or the ⋯ menu, then Share).", "Tap “Add to Home Screen”. If it isn't there, open this page in Safari and use Safari's Share button.", "Tap “Add”."],
        note: keep,
      };
    case "android-chrome":
      return {
        title: "Install on your Android phone",
        steps: ["Tap the ⋮ menu at the top right of Chrome.", "Tap “Install app” (or “Add to Home screen”, then “Install”).", "Confirm. LittleSteps appears with your other apps."],
        note: keep,
      };
    case "android-samsung":
      return {
        title: "Install with Samsung Internet",
        steps: ["Tap the ☰ menu at the bottom right.", "Tap “Add page to”, then “Home screen”.", "Tap “Add”."],
        note: keep,
      };
    case "android-firefox":
      return {
        title: "Install with Firefox",
        steps: ["Tap the ⋮ menu.", "Tap “Install” or “Add to Home screen”.", "Confirm."],
        note: `${keep} Chrome gives the best result on Android.`,
      };
    case "in-app":
      return {
        title: "Open it in your browser first",
        steps: [
          "This page is open inside another app (like WhatsApp, Gmail or Facebook), which can't install it.",
          "Tap that app's ⋯ or ⋮ menu and choose “Open in browser”, “Open in Safari” or “Open in Chrome”.",
          "Then tap Install app again.",
        ],
        note: "Install from the same browser you'll keep using. A diary started in one browser isn't visible in another.",
      };
    case "desktop":
      return {
        title: "Install on this computer",
        steps: ["In Chrome or Edge, click the install icon at the right of the address bar.", "Or open the ⋮ / ⋯ menu and choose “Install LittleSteps” (Chrome: Cast, save and share → Install page as app; Edge: Apps → Install this site as an app)."],
        note: "LittleSteps is made for your phone. A diary on this computer is separate from the one on your phone.",
      };
  }
}
