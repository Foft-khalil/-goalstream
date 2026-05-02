'use client';

import { useEffect, useCallback, useMemo } from 'react';
import { useAppStore, ViewType } from '@/lib/store';
import { t } from '@/lib/i18n';
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/components/ui/command';
import { Zap, Dribbble, Tv, BarChart3 } from 'lucide-react';

interface GlobalSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface SearchResult {
  id: string;
  label: string;
  sublabel?: string;
  icon: React.ReactNode;
  category: 'matches' | 'channels' | 'competitions';
  view: ViewType;
  // Optional data for navigation
  competitionName?: string;
}

export default function GlobalSearch({ open, onOpenChange }: GlobalSearchProps) {
  const {
    language,
    footballMatches,
    basketballMatches,
    channels,
    setGlobalSearch,
    setCurrentView,
  } = useAppStore();

  // Build search results based on current store data
  const searchResults = useMemo<SearchResult[]>(() => {
    const results: SearchResult[] = [];

    // Football matches
    for (const match of footballMatches) {
      results.push({
        id: `football-${match.id}`,
        label: `${match.homeTeam} vs ${match.awayTeam}`,
        sublabel: match.competition || undefined,
        icon: <Zap className="h-4 w-4 text-green-500 shrink-0" />,
        category: 'matches',
        view: 'live',
        competitionName: match.competition || undefined,
      });
    }

    // Basketball matches
    for (const match of basketballMatches) {
      results.push({
        id: `basketball-${match.id}`,
        label: `${match.homeTeam} vs ${match.awayTeam}`,
        sublabel: match.competition || undefined,
        icon: <Dribbble className="h-4 w-4 text-orange-500 shrink-0" />,
        category: 'matches',
        view: 'basketball',
        competitionName: match.competition || undefined,
      });
    }

    // Channels
    for (const channel of channels) {
      results.push({
        id: `channel-${channel.tvgId || channel.name}`,
        label: channel.name,
        sublabel: channel.group || channel.country || undefined,
        icon: <Tv className="h-4 w-4 text-blue-500 shrink-0" />,
        category: 'channels',
        view: 'channels',
      });
    }

    // Competitions from match data (deduplicated)
    const seenCompetitions = new Set<string>();
    const allMatches = [
      ...footballMatches.map((m) => ({ comp: m.competition, view: 'live' as ViewType })),
      ...basketballMatches.map((m) => ({ comp: m.competition, view: 'basketball' as ViewType })),
    ];
    for (const { comp, view } of allMatches) {
      if (comp && !seenCompetitions.has(comp.toLowerCase())) {
        seenCompetitions.add(comp.toLowerCase());
        results.push({
          id: `comp-${comp}`,
          label: comp,
          icon: <BarChart3 className="h-4 w-4 text-amber-500 shrink-0" />,
          category: 'competitions',
          view,
          competitionName: comp,
        });
      }
    }

    return results;
  }, [footballMatches, basketballMatches, channels]);

  // Filter results based on search query
  const filterResults = useCallback(
    (query: string): SearchResult[] => {
      if (!query.trim()) return [];
      const q = query.toLowerCase().trim();
      return searchResults.filter((result) => {
        const labelMatch = result.label.toLowerCase().includes(q);
        const sublabelMatch = result.sublabel?.toLowerCase().includes(q) ?? false;
        return labelMatch || sublabelMatch;
      });
    },
    [searchResults]
  );

  // Ctrl+K shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onOpenChange]);

  const handleSelect = (result: SearchResult) => {
    // Navigate to the appropriate view
    setCurrentView(result.view);

    // If it's a competition, set the global search so the view can filter/highlight
    if (result.competitionName) {
      setGlobalSearch(result.competitionName);
    } else {
      setGlobalSearch(result.label);
    }

    // Close dialog
    onOpenChange(false);
  };

  const handleValueChange = (value: string) => {
    // This is called when user types; we don't need to update store here
    // The Command component handles filtering internally
  };

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t(language, 'search.title')}
      description={t(language, 'search.placeholder')}
    >
      <CommandInput
        placeholder={t(language, 'search.placeholder')}
      />
      <CommandList className="max-h-[60vh]">
        <CommandEmpty>{t(language, 'search.noResults')}</CommandEmpty>

        {/* We use cmdk's built-in filtering by providing all items and letting it filter */}
        <FilteredGroups
          searchResults={searchResults}
          language={language}
          onSelect={handleSelect}
        />
      </CommandList>
    </CommandDialog>
  );
}

/**
 * Sub-component that groups filtered results by category.
 * Uses cmdk's filtering via CommandItem value prop.
 */
function FilteredGroups({
  searchResults,
  language,
  onSelect,
}: {
  searchResults: SearchResult[];
  language: string;
  onSelect: (result: SearchResult) => void;
}) {
  const matchResults = searchResults.filter((r) => r.category === 'matches');
  const channelResults = searchResults.filter((r) => r.category === 'channels');
  const competitionResults = searchResults.filter((r) => r.category === 'competitions');

  return (
    <>
      {matchResults.length > 0 && (
        <CommandGroup heading={t(language as any, 'search.matches')}>
          {matchResults.slice(0, 20).map((result) => (
            <CommandItem
              key={result.id}
              value={`${result.label} ${result.sublabel || ''}`}
              onSelect={() => onSelect(result)}
              className="cursor-pointer"
            >
              {result.icon}
              <div className="flex flex-col min-w-0 flex-1">
                <span className="truncate text-sm font-medium">{result.label}</span>
                {result.sublabel && (
                  <span className="truncate text-xs text-muted-foreground">{result.sublabel}</span>
                )}
              </div>
            </CommandItem>
          ))}
          {matchResults.length > 20 && (
            <div className="px-2 py-1.5 text-xs text-muted-foreground text-center">
              +{matchResults.length - 20} more
            </div>
          )}
        </CommandGroup>
      )}
      {channelResults.length > 0 && (
        <CommandGroup heading={t(language as any, 'search.channels')}>
          {channelResults.slice(0, 15).map((result) => (
            <CommandItem
              key={result.id}
              value={`${result.label} ${result.sublabel || ''}`}
              onSelect={() => onSelect(result)}
              className="cursor-pointer"
            >
              {result.icon}
              <div className="flex flex-col min-w-0 flex-1">
                <span className="truncate text-sm font-medium">{result.label}</span>
                {result.sublabel && (
                  <span className="truncate text-xs text-muted-foreground">{result.sublabel}</span>
                )}
              </div>
            </CommandItem>
          ))}
          {channelResults.length > 15 && (
            <div className="px-2 py-1.5 text-xs text-muted-foreground text-center">
              +{channelResults.length - 15} more
            </div>
          )}
        </CommandGroup>
      )}
      {competitionResults.length > 0 && (
        <CommandGroup heading={t(language as any, 'search.competitions')}>
          {competitionResults.slice(0, 15).map((result) => (
            <CommandItem
              key={result.id}
              value={`${result.label} ${result.sublabel || ''}`}
              onSelect={() => onSelect(result)}
              className="cursor-pointer"
            >
              {result.icon}
              <div className="flex flex-col min-w-0 flex-1">
                <span className="truncate text-sm font-medium">{result.label}</span>
                {result.sublabel && (
                  <span className="truncate text-xs text-muted-foreground">{result.sublabel}</span>
                )}
              </div>
            </CommandItem>
            ))}
          {competitionResults.length > 15 && (
            <div className="px-2 py-1.5 text-xs text-muted-foreground text-center">
              +{competitionResults.length - 15} more
            </div>
          )}
        </CommandGroup>
      )}
    </>
  );
}
