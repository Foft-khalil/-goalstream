'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useAppStore } from '@/lib/store';
import { t } from '@/lib/i18n';
import type { NotificationSettings } from '@/hooks/use-notifications';

interface NotificationSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: NotificationSettings;
  onSettingsChange: (settings: NotificationSettings) => void;
}

export function NotificationSettingsDialog({
  open,
  onOpenChange,
  settings,
  onSettingsChange,
}: NotificationSettingsDialogProps) {
  const { language } = useAppStore();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[380px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="text-lg">🔔</span>
            {t(language, 'notifications.settingsTitle')}
          </DialogTitle>
          <DialogDescription>
            {t(language, 'notifications.settingsDesc')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {/* Match Start Toggle */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 space-y-0.5">
              <Label htmlFor="notify-match-start" className="text-sm font-medium cursor-pointer">
                🏟️ {t(language, 'notifications.matchStart')}
              </Label>
              <p className="text-xs text-muted-foreground">
                {t(language, 'notifications.matchStartDesc')}
              </p>
            </div>
            <Switch
              id="notify-match-start"
              checked={settings.notifyMatchStart}
              onCheckedChange={(checked: boolean) =>
                onSettingsChange({ ...settings, notifyMatchStart: checked })
              }
            />
          </div>

          {/* Goal Toggle */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 space-y-0.5">
              <Label htmlFor="notify-goals" className="text-sm font-medium cursor-pointer">
                ⚽ {t(language, 'notifications.goalsPoints')}
              </Label>
              <p className="text-xs text-muted-foreground">
                {t(language, 'notifications.goalsPointsDesc')}
              </p>
            </div>
            <Switch
              id="notify-goals"
              checked={settings.notifyGoals}
              onCheckedChange={(checked: boolean) =>
                onSettingsChange({ ...settings, notifyGoals: checked })
              }
            />
          </div>

          {/* Favorites Toggle */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 space-y-0.5">
              <Label htmlFor="notify-favorites" className="text-sm font-medium cursor-pointer">
                ❤️ {t(language, 'notifications.favoriteTeams')}
              </Label>
              <p className="text-xs text-muted-foreground">
                {t(language, 'notifications.favoriteTeamsDesc')}
              </p>
            </div>
            <Switch
              id="notify-favorites"
              checked={settings.notifyFavorites}
              onCheckedChange={(checked: boolean) =>
                onSettingsChange({ ...settings, notifyFavorites: checked })
              }
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
