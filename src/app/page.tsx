"use client";

import App from "@/components/App";
import LockScreen from "@/components/LockScreen";
import { useVaultStatus } from "@/lib/security/vault";

/** Nothing of the app renders until the vault is unlocked with the passcode. */
export default function Home() {
  const status = useVaultStatus();
  return status === "unlocked" ? <App /> : <LockScreen status={status} />;
}
