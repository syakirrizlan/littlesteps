"use client";

/**
 * Saves a file from the app. On an iPhone Home Screen app a plain download doesn't work well,
 * so the share sheet is used there ("Save to Files"). Elsewhere it's a normal download.
 */
export async function saveFile(name: string, content: string, type: string): Promise<"saved" | "shared" | "cancelled"> {
  const blob = new Blob([content], { type });
  const nav = navigator as Navigator & { standalone?: boolean };
  const file = typeof File !== "undefined" ? new File([blob], name, { type }) : null;
  const iosApp = nav.standalone === true || /iPad|iPhone|iPod/.test(nav.userAgent);
  if (iosApp && file && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: name });
      return "shared";
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return "cancelled";
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return "saved";
}

export function readTextFile(file: File): Promise<string> {
  return file.text();
}
