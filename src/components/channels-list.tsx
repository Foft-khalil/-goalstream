'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useAppStore } from '@/lib/store';
import ChannelCard from '@/components/channel-card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search, RefreshCw, Tv, Globe, Filter } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const COUNTRIES = [
  { code: '', label: 'All Countries' },
  { code: 'fr', label: '🇫🇷 France' },
  { code: 'ma', label: '🇲🇦 Morocco' },
  { code: 'dz', label: '🇩🇿 Algeria' },
  { code: 'sn', label: '🇸🇳 Senegal' },
  { code: 'tn', label: '🇹🇳 Tunisia' },
  { code: 'eg', label: '🇪🇬 Egypt' },
  { code: 'uk', label: '🇬🇧 United Kingdom' },
  { code: 'us', label: '🇺🇸 United States' },
  { code: 'es', label: '🇪🇸 Spain' },
  { code: 'de', label: '🇩🇪 Germany' },
  { code: 'it', label: '🇮🇹 Italy' },
  { code: 'br', label: '🇧🇷 Brazil' },
  { code: 'ar', label: '🇦🇷 Argentina' },
  { code: 'sa', label: '🇸🇦 Saudi Arabia' },
  { code: 'tr', label: '🇹🇷 Turkey' },
  { code: 'ir', label: '🇮🇷 Iran' },
];

export default function ChannelsList() {
  const { channels, channelsLoading, fetchChannels, channelSearch, setChannelSearch, channelCountry, setChannelCountry } = useAppStore();
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 30;

  useEffect(() => {
    fetchChannels(channelSearch, channelCountry);
  }, [channelCountry]); // Re-fetch when country changes

  // Client-side search filtering
  const filteredChannels = useMemo(() => {
    let result = channels;
    if (channelSearch) {
      const search = channelSearch.toLowerCase();
      result = result.filter(
        (ch) =>
          ch.name.toLowerCase().includes(search) ||
          ch.group.toLowerCase().includes(search)
      );
    }
    return result;
  }, [channels, channelSearch]);

  // Get unique groups for filtering
  const groups = useMemo(() => {
    const groupSet = new Set(channels.map((ch) => ch.group).filter(Boolean));
    return Array.from(groupSet).sort();
  }, [channels]);

  const [selectedGroup, setSelectedGroup] = useState<string>('');

  const displayChannels = useMemo(() => {
    let result = filteredChannels;
    if (selectedGroup) {
      result = result.filter((ch) => ch.group === selectedGroup);
    }
    return result.slice(0, (page + 1) * PAGE_SIZE);
  }, [filteredChannels, selectedGroup, page]);

  const hasMore = displayChannels.length < (selectedGroup ? filteredChannels.filter((ch) => ch.group === selectedGroup).length : filteredChannels.length);

  const handleRefresh = () => {
    setPage(0);
    fetchChannels(channelSearch, channelCountry);
  };

  const handleCountryChange = (value: string) => {
    setChannelCountry(value === 'all' ? '' : value);
    setPage(0);
  };

  return (
    <div className="space-y-4">
      {/* Search & Filters */}
      <div className="space-y-3">
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search channels..."
            value={channelSearch}
            onChange={(e) => {
              setChannelSearch(e.target.value);
              setPage(0);
            }}
            className="pl-9 bg-card/80 border-border/50"
          />
        </div>

        {/* Country & Group Filters */}
        <div className="flex gap-2">
          <Select value={channelCountry || 'all'} onValueChange={handleCountryChange}>
            <SelectTrigger className="flex-1 bg-card/80 border-border/50 h-9 text-sm">
              <Globe className="h-4 w-4 mr-1.5 shrink-0" />
              <SelectValue placeholder="Country" />
            </SelectTrigger>
            <SelectContent>
              {COUNTRIES.map((c) => (
                <SelectItem key={c.code || 'all'} value={c.code || 'all'}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="icon"
            onClick={handleRefresh}
            disabled={channelsLoading}
            className="shrink-0 bg-card/80 border-border/50 h-9 w-9"
          >
            <RefreshCw className={`h-4 w-4 ${channelsLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {/* Group Tags */}
        {groups.length > 0 && (
          <div className="flex gap-1.5 flex-wrap">
            <Badge
              variant={selectedGroup === '' ? 'default' : 'secondary'}
              className="cursor-pointer text-[10px]"
              onClick={() => {
                setSelectedGroup('');
                setPage(0);
              }}
            >
              All
            </Badge>
            {groups.slice(0, 10).map((group) => (
              <Badge
                key={group}
                variant={selectedGroup === group ? 'default' : 'secondary'}
                className="cursor-pointer text-[10px] truncate max-w-[120px]"
                onClick={() => {
                  setSelectedGroup(selectedGroup === group ? '' : group);
                  setPage(0);
                }}
              >
                {group}
              </Badge>
            ))}
            {groups.length > 10 && (
              <span className="text-[10px] text-muted-foreground self-center">
                +{groups.length - 10} more
              </span>
            )}
          </div>
        )}
      </div>

      {/* Channels List */}
      {channelsLoading && channels.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">Loading channels...</p>
        </div>
      ) : displayChannels.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Tv className="h-12 w-12 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">No channels found</p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            Try adjusting your search or filters
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between px-1">
            <p className="text-xs text-muted-foreground">
              {filteredChannels.length} channel{filteredChannels.length !== 1 ? 's' : ''} found
            </p>
          </div>
          <div className="grid gap-2">
            {displayChannels.map((channel, idx) => (
              <ChannelCard key={`${channel.tvgId}-${idx}`} channel={channel} />
            ))}
          </div>

          {/* Load More */}
          {hasMore && (
            <div className="flex justify-center pt-2">
              <Button
                variant="outline"
                onClick={() => setPage(page + 1)}
                className="bg-card/80 border-border/50"
              >
                Load More Channels
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
