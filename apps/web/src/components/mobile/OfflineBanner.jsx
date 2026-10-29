import React from "react";
import { WifiOff } from "lucide-react";
import useOnlineStatus from "@/hooks/useOnlineStatus";

// Slim connectivity banner shown above content when the device is offline.
export default function OfflineBanner() {
  const online = useOnlineStatus();
  if (online) return null;
  return (
    <div className="bg-amber-500 text-white text-xs font-medium px-4 py-1.5 flex items-center justify-center gap-2">
      <WifiOff className="w-3.5 h-3.5" />
      You're offline — some content may be stale. Pull down to refresh when you reconnect.
    </div>
  );
}