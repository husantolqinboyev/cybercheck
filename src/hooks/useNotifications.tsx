import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface Notification {
  id: string;
  title: string;
  body: string;
  type: string;
  is_read: boolean;
  created_at: string;
}

export function useNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const { toast } = useToast();

  const fetchNotifications = useCallback(async () => {
    if (!user) return;

    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);

    if (data) {
      setNotifications(data as Notification[]);
      setUnreadCount(data.filter((n: any) => !n.is_read).length);
    }
  }, [user]);

  useEffect(() => {
    fetchNotifications();

    if (!user) return;

    // Subscribe to realtime notifications
    const channel = supabase
      .channel(`notifications-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const newNotification = payload.new as Notification;
          setNotifications((prev) => [newNotification, ...prev]);
          setUnreadCount((prev) => prev + 1);

          // Show toast notification
          toast({
            title: newNotification.title,
            description: newNotification.body,
          });

          // Show browser notification if permitted
          if (Notification.permission === "granted") {
            new Notification(newNotification.title, {
              body: newNotification.body,
              icon: "/favicon.ico",
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchNotifications, toast]);

  const markAsRead = async (id: string) => {
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
  };

  const markAllAsRead = async () => {
    if (!user) return;
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", user.id)
      .eq("is_read", false);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
  };

  const requestPermission = async () => {
    if (!("Notification" in window)) {
      toast({
        title: "Xatolik",
        description: "Bu brauzer bildirishnomalarni qo'llab-quvvatlamaydi",
        variant: "destructive",
      });
      return false;
    }

    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      toast({
        title: "Muvaffaqiyat",
        description: "Bildirishnomalar yoqildi",
      });
      return true;
    } else {
      toast({
        title: "Xatolik",
        description: "Bildirishnomalar rad etildi",
        variant: "destructive",
      });
      return false;
    }
  };

  return {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    requestPermission,
    refetch: fetchNotifications,
  };
}
