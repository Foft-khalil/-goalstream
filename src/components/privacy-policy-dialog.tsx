'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useAppStore } from '@/lib/store';
import { t } from '@/lib/i18n';
import { Shield, Mail, Bell, Database, Info } from 'lucide-react';

interface PrivacyPolicyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PrivacyPolicyDialog({ open, onOpenChange }: PrivacyPolicyDialogProps) {
  const { language } = useAppStore();

  const sections = [
    {
      icon: <Info className="h-4 w-4 text-green-500" />,
      title: t(language, 'privacy.introduction'),
      content: t(language, 'privacy.introductionContent'),
    },
    {
      icon: <Database className="h-4 w-4 text-blue-500" />,
      title: t(language, 'privacy.dataCollection'),
      content: t(language, 'privacy.dataCollectionContent'),
    },
    {
      icon: <Shield className="h-4 w-4 text-amber-500" />,
      title: t(language, 'privacy.automaticData'),
      content: t(language, 'privacy.automaticDataContent'),
    },
    {
      icon: <Bell className="h-4 w-4 text-purple-500" />,
      title: t(language, 'privacy.notifications'),
      content: t(language, 'privacy.notificationsContent'),
    },
    {
      icon: <Mail className="h-4 w-4 text-red-500" />,
      title: t(language, 'privacy.contact'),
      content: t(language, 'privacy.contactContent'),
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-green-500" />
            {t(language, 'privacy.title')}
          </DialogTitle>
          <DialogDescription>
            {t(language, 'privacy.lastUpdated')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {sections.map((section) => (
            <div key={section.title} className="space-y-2">
              <div className="flex items-center gap-2">
                {section.icon}
                <h3 className="text-sm font-bold">{section.title}</h3>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed pl-6">
                {section.content}
              </p>
            </div>
          ))}

          {/* Contact email */}
          <div className="mt-4 p-3 rounded-xl bg-muted/30 border border-border/20">
            <div className="flex items-center gap-2 mb-1.5">
              <Mail className="h-3.5 w-3.5 text-green-500" />
              <span className="text-xs font-semibold">{t(language, 'privacy.contactEmail')}</span>
            </div>
            <a
              href="mailto:fofanakhalil272@gmail.com"
              className="text-xs text-green-500 hover:text-green-400 hover:underline transition-colors"
            >
              fofanakhalil272@gmail.com
            </a>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
