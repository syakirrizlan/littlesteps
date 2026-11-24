// Runs before the app starts. Edge/Chrome may announce "this app can be installed"
// before React is ready; keep that event so the in-app Install button still appears.
window.addEventListener("beforeinstallprompt", function (event) {
  event.preventDefault();
  window.__littlestepsInstallPrompt = event;
  window.dispatchEvent(new Event("littlesteps-installable"));
});
