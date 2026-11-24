"use client";

import App from "@/components/App";
import LockScreen from "@/components/LockScreen";
import { useEffect } from "react";
import { startPwa } from "@/lib/pwa";
import { useVaultStatus } from "@/lib/security/vault";

/** Nothing of the app renders until the vault is unlocked with the passcode. */
export default function Home() {
  const status = useVaultStatus();
  // Register offline support and catch the install offer right away, on the lock screen too.
  useEffect(() => startPwa(), []);
  return status === "unlocked" ? <App /> : <LockScreen status={status} />;
}
