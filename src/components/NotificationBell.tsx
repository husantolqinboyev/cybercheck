import { useState } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNotifications } from "@/hooks/useNotifications";
import { cn } from "@/lib/utils";

export function NotificationBell() {
  const { notifications, unreadCount, markAsRead, markAllAsRead, requestPermission } =
    useNotifications();
  const [isOpen, setIsOpen] = useState(false);

  const handleOpen = async (open: boolean) => {
    setIsOpen(open);
    if (open && Notification.permission === "default") {
      await requestPermission();
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={handleOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground text-xs rounded-full flex items-center justify-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between p-3 border-b">
          <h4 className="font-semibold text-foreground">Bildirishnomalar</h4>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={markAllAsRead}>
              Barchasini o'qilgan deb belgilash
            </Button>
          )}
        </div>
        <ScrollArea className="h-80">
          {notifications.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground">
              Bildirishnomalar yo'q
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={cn(
                    "p-3 cursor-pointer hover:bg-muted transition-colors",
                    !notification.is_read && "bg-primary/5"
                  )}
                  onClick={() => markAsRead(notification.id)}
                >
                  <div className="flex items-start gap-2">
                    {!notification.is_read && (
                      <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-foreground">
                        {notification.title}
                      </p>
                      <p className="text-sm text-muted-foreground truncate">
                        {notification.body}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(notification.created_at).toLocaleString("uz-UZ")}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
