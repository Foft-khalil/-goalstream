'use client';

import { useEffect } from 'react';
import { useNotificationStore, type NotificationItem } from '@/lib/notification-store';
import { useAppStore } from '@/lib/store';
import { t } from '@/lib/i18n';
import { useNotifications } from '@/hooks/use-notifications';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Bell, BellOff, Settings, Check, Trash2, Inbox } from 'lucide-react';

interface NotificationCenterProps {
  onOpenSettings: () => void;
}

function getNotificationIcon(item: NotificationItem): string {
  if (item.type === 'goal') return item.sport === 'football' ? '⚽' : '🏀';
  if (item.type === 'score_change') return item.sport === 'football' ? '⚽' : '🏀';
  if (item.type === 'match_start') return '🏟️';
  if (item.type === 'upcoming') return item.sport === 'football' ? '⚽' : '🏀';
  return '🔔';
}

function formatTimestamp(timestamp: number, language: string): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);

  if (minutes < 1) {
    return t(language, 'notifications.justNow');
  }
  if (minutes < 60) {
    return t(language, 'notifications.minutesAgo', minutes);
  }
  if (hours < 24) {
    return t(language, 'notifications.hoursAgo', hours);
  }
  // Fallback to hours even if > 24
  return t(language, 'notifications.hoursAgo', hours);
}

export default function NotificationCenter({ onOpenSettings }: NotificationCenterProps) {
  const { items, unreadCount, markAsRead, markAllAsRead, clearAll, cleanup } = useNotificationStore();
  const { language } = useAppStore();
  const { notificationsEnabled, toggleNotifications } = useNotifications();

  // Run cleanup on mount
  useEffect(() => {
    cleanup();
  }, [cleanup]);

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/30">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">{t(language, 'notifications.title')}</h3>
          {unreadCount > 0 && (
            <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-[10px] font-bold text-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Switch
            checked={notificationsEnabled}
            onCheckedChange={toggleNotifications}
            className="scale-75"
          />
          <span className="text-[10px] text-muted-foreground">
            {notificationsEnabled ? <Bell className="h-3 w-3 text-green-500" /> : <BellOff className="h-3 w-3 text-muted-foreground/50" />}
          </span>
        </div>
      </div>

      {/* Notifications list or empty state */}
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 px-4">
          <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mb-3">
            <Inbox className="h-6 w-6 text-muted-foreground/40" />
          </div>
          <p className="text-sm font-medium text-muted-foreground/60">{t(language, 'notifications.noNotifications')}</p>
          <p className="text-xs text-muted-foreground/40 mt-1 text-center">{t(language, 'notifications.noNotificationsDesc')}</p>
        </div>
      ) : (
        <ScrollArea className="max-h-80">
          <div className="flex flex-col">
            {items.map((item, index) => (
              <div
                key={item.id}
                className={`flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-muted/30 ${
                  !item.read ? 'bg-green-500/5' : ''
                } ${index > 0 ? 'border-t border-border/20' : ''}`}
                onClick={() => markAsRead(item.id)}
              >
                <span className="text-base mt-0.5 shrink-0">{getNotificationIcon(item)}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className={`text-xs leading-tight ${!item.read ? 'font-semibold text-foreground' : 'font-medium text-muted-foreground'}`}>
                      {item.title}
                    </p>
                    {!item.read && (
                      <span className="w-2 h-2 rounded-full bg-green-500 shrink-0 mt-1" />
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground/70 mt-0.5 leading-snug line-clamp-2">
                    {item.body}
                  </p>
                  <p className="text-[10px] text-muted-foreground/40 mt-1">
                    {formatTimestamp(item.timestamp, language)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}

      {/* Footer actions */}
      {items.length > 0 && (
        <>
          <Separator className="opacity-30" />
          <div className="flex items-center justify-between px-3 py-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={markAllAsRead}
              className="h-7 text-[11px] gap-1 text-muted-foreground/60 hover:text-foreground"
            >
              <Check className="h-3 w-3" />
              {t(language, 'notifications.markAllRead')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAll}
              className="h-7 text-[11px] gap-1 text-muted-foreground/60 hover:text-red-500"
            >
              <Trash2 className="h-3 w-3" />
              {t(language, 'notifications.clearAll')}
            </Button>
          </div>
        </>
      )}

      {/* Settings link */}
      <Separator className="opacity-30" />
      <div className="px-3 py-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onOpenSettings}
          className="w-full h-8 text-[11px] gap-1.5 text-muted-foreground/60 hover:text-foreground justify-start"
        >
          <Settings className="h-3 w-3" />
          {t(language, 'notifications.openSettings')}
        </Button>
      </div>
    </div>
  );
}
