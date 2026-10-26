import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Bell } from "lucide-react";

export default function NotificationBell() {
  const [userId, setUserId] = useState(null);
  const [notifications, setNotifications] = useState([]);

  const load = useCallback(async (uid) => {
    const items = await base44.entities.Notification.filter({ user_id: uid }, "-created_date", 20);
    setNotifications(items);
  }, []);

  useEffect(() => {
    base44.auth.me().then((me) => {
      setUserId(me.id);
      load(me.id);
    }).catch(() => {});
  }, [load]);

  useEffect(() => {
    if (!userId) return;
    const unsubscribe = base44.entities.Notification.subscribe((event) => {
      if (event.type === "create" && event.data?.user_id === userId) {
        setNotifications((prev) => [event.data, ...prev].slice(0, 20));
      }
    });
    return unsubscribe;
  }, [userId]);

  const unread = notifications.filter((n) => !n.read).length;

  return (
    <Link
      to="/inbox"
      className="relative p-2 text-stone-400 hover:text-stone-100 transition-colors cursor-pointer"
      aria-label={`Inbox${unread > 0 ? ` (${unread} unread)` : ""}`}
    >
      <Bell className="w-5 h-5" strokeWidth={1.75} />
      {unread > 0 && (
        <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Link>
  );
}