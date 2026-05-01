'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[380px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="text-lg">🔔</span>
            Paramètres de notification
          </DialogTitle>
          <DialogDescription>
            Choisissez les types de notifications que vous souhaitez recevoir.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {/* Match Start Toggle */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 space-y-0.5">
              <Label htmlFor="notify-match-start" className="text-sm font-medium cursor-pointer">
                🏟️ Début de match
              </Label>
              <p className="text-xs text-muted-foreground">
                Recevoir une notification quand un match commence
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
                ⚽ Buts & Points
              </Label>
              <p className="text-xs text-muted-foreground">
                Recevoir une notification quand un but ou des points sont marqués
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
                ❤️ Équipes favorites
              </Label>
              <p className="text-xs text-muted-foreground">
                Rappel quand les matchs de vos équipes favorites approchent
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
