'use client';

import { useAppStore } from '@/lib/store';
import { availableLanguages } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Globe, Check } from 'lucide-react';

export default function LanguageSelector() {
  const { language, setLanguage } = useAppStore();
  const currentLang = availableLanguages.find((l) => l.code === language) || availableLanguages[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 relative rounded-lg text-muted-foreground/70 hover:text-foreground hover:bg-muted/50"
          title={currentLang.label}
        >
          <Globe className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        {availableLanguages.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => setLanguage(lang.code)}
            className="flex items-center gap-2 cursor-pointer"
          >
            <span className="text-base">{lang.flag}</span>
            <span className="flex-1 text-sm">{lang.label}</span>
            {language === lang.code && (
              <Check className="h-3.5 w-3.5 text-green-500" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
