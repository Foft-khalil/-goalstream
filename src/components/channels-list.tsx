'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useAppStore } from '@/lib/store';
import { t } from '@/lib/i18n';
import ChannelCard from '@/components/channel-card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Loader2, Search, RefreshCw, Tv, Globe, Wifi, WifiOff, CheckCircle2, XCircle } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const COUNTRIES_BASE: Array<{ code: string; labelFr: string; labelEn: string }> = [
  { code: '', labelFr: 'Tous les pays', labelEn: 'All countries' },
  { code: 'fr', labelFr: '🇫🇷 France', labelEn: '🇫🇷 France' },
  { code: 'ma', labelFr: '🇲🇦 Maroc', labelEn: '🇲🇦 Morocco' },
  { code: 'dz', labelFr: '🇩🇿 Algérie', labelEn: '🇩🇿 Algeria' },
  { code: 'sn', labelFr: '🇸🇳 Sénégal', labelEn: '🇸🇳 Senegal' },
  { code: 'tn', labelFr: '🇹🇳 Tunisie', labelEn: '🇹🇳 Tunisia' },
  { code: 'eg', labelFr: '🇪🇬 Égypte', labelEn: '🇪🇬 Egypt' },
  { code: 'uk', labelFr: '🇬🇧 Royaume-Uni', labelEn: '🇬🇧 United Kingdom' },
  { code: 'us', labelFr: '🇺🇸 États-Unis', labelEn: '🇺🇸 United States' },
  { code: 'es', labelFr: '🇪🇸 Espagne', labelEn: '🇪🇸 Spain' },
  { code: 'de', labelFr: '🇩🇪 Allemagne', labelEn: '🇩🇪 Germany' },
  { code: 'it', labelFr: '🇮🇹 Italie', labelEn: '🇮🇹 Italy' },
  { code: 'br', labelFr: '🇧🇷 Brésil', labelEn: '🇧🇷 Brazil' },
  { code: 'ar', labelFr: '🇦🇷 Argentine', labelEn: '🇦🇷 Argentina' },
  { code: 'sa', labelFr: '🇸🇦 Arabie Saoudite', labelEn: '🇸🇦 Saudi Arabia' },
  { code: 'tr', labelFr: '🇹🇷 Turquie', labelEn: '🇹🇷 Turkey' },
  { code: 'ir', labelFr: '🇮🇷 Iran', labelEn: '🇮🇷 Iran' },
];

export default function ChannelsList() {
  const {
    channels,
    channelsLoading,
    fetchChannels,
    channelSearch,
    setChannelSearch,
    channelCountry,
    setChannelCountry,
    onlineOnly,
    setOnlineOnly,
    checkingChannels,
    checkChannelsHealth,
    language,
  } = useAppStore();

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
    // Online-only filter
    if (onlineOnly) {
      result = result.filter((ch) => ch.status === 'online');
    }
    return result;
  }, [channels, channelSearch, onlineOnly]);

  // Stats
  const onlineCount = channels.filter((ch) => ch.status === 'online').length;
  const offlineCount = channels.filter((ch) => ch.status === 'offline').length;
  const uncheckedCount = channels.filter((ch) => ch.status === 'unknown' || !ch.status).length;

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

  // Batch health check - check visible channels
  const handleCheckAll = () => {
    const urlsToCheck = displayChannels
      .filter((ch) => ch.status === 'unknown' || !ch.status)
      .map((ch) => ch.url);

    if (urlsToCheck.length === 0) {
      // Re-check all visible
      checkChannelsHealth(displayChannels.map((ch) => ch.url));
    } else {
      checkChannelsHealth(urlsToCheck);
    }
  };

  return (
    <div className="space-y-4">
      {/* Search & Filters */}
      <div className="space-y-3">
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t(language, 'channels.searchPlaceholder')}
            value={channelSearch}
            onChange={(e) => {
              setChannelSearch(e.target.value);
              setPage(0);
            }}
            className="pl-9 bg-card/80 border-border/50"
          />
        </div>

        {/* Country & Refresh */}
        <div className="flex gap-2">
          <Select value={channelCountry || 'all'} onValueChange={handleCountryChange}>
            <SelectTrigger className="flex-1 bg-card/80 border-border/50 h-9 text-sm">
              <Globe className="h-4 w-4 mr-1.5 shrink-0" />
              <SelectValue placeholder="Pays" />
            </SelectTrigger>
            <SelectContent>
              {COUNTRIES_BASE.map((c) => (
                <SelectItem key={c.code || 'all'} value={c.code || 'all'}>
                  {language === 'fr' ? c.labelFr : c.labelEn}
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

        {/* Online Only Toggle + Health Check Button */}
        <div className="flex items-center justify-between gap-3 bg-card/50 rounded-lg p-2.5 border border-border/30">
          <div className="flex items-center gap-2">
            <Switch
              id="online-only"
              checked={onlineOnly}
              onCheckedChange={setOnlineOnly}
              className="data-[state=checked]:bg-green-600"
            />
            <Label htmlFor="online-only" className="text-xs font-medium cursor-pointer flex items-center gap-1.5">
              <Wifi className="h-3.5 w-3.5 text-green-500" />
              {t(language, 'channels.onlineOnly')}
            </Label>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleCheckAll}
            disabled={checkingChannels}
            className="h-7 text-[11px] gap-1.5 bg-background/50 border-border/50"
          >
            {checkingChannels ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                {t(language, 'channels.checking')}
              </>
            ) : (
              <>
                <CheckCircle2 className="h-3 w-3" />
                {t(language, 'channels.check')}
              </>
            )}
          </Button>
        </div>

        {/* Stats */}
        {(onlineCount > 0 || offlineCount > 0) && (
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground px-1">
            {onlineCount > 0 && (
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                {onlineCount} {t(language, 'channels.online')}
              </span>
            )}
            {offlineCount > 0 && (
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                {offlineCount} {t(language, 'channels.offline')}
              </span>
            )}
            {uncheckedCount > 0 && (
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-gray-500" />
                {uncheckedCount} {t(language, 'channels.untested')}{uncheckedCount > 1 ? 's' : ''}
              </span>
            )}
          </div>
        )}

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
              {t(language, 'common.all')}
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
                +{groups.length - 10} {t(language, 'common.more')}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Channels List */}
      {channelsLoading && channels.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">{t(language, 'common.loading')}...</p>
        </div>
      ) : displayChannels.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Tv className="h-12 w-12 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">{t(language, 'channels.noChannels')}</p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            {onlineOnly ? t(language, 'channels.tryDisableFilter') : t(language, 'channels.adjustFilters')}
          </p>
          {onlineOnly && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOnlineOnly(false)}
              className="mt-3"
            >
              <WifiOff className="h-3.5 w-3.5 mr-1.5" />
              {t(language, 'channels.showAllChannels')}
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between px-1">
            <p className="text-xs text-muted-foreground">
              {filteredChannels.length} {t(language, 'channels.channelsFound')}{filteredChannels.length !== 1 ? 's' : ''}
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
                {t(language, 'channels.loadMore')}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
