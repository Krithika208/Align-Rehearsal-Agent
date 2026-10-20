"use client";

import { useEffect } from "react";
import { track } from "@/lib/analytics";

// Sends one analytics event when shown (only with analytics consent).
export default function TrackOnMount({ event }: { event: string }) {
  useEffect(() => {
    track(event);
  }, [event]);
  return null;
}
