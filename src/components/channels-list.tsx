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
import { Loader2, Search, RefreshCw, Tv, Globe, Wifi, WifiOff, CheckCircle2, XCircle, Zap } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const COUNTRIES_BASE: Array<{ code: string; labelFr: string; labelEn: string; labelAr: string; labelEs: string; labelPt: string }> = [
  { code: '', labelFr: 'Tous les pays', labelEn: 'All countries', labelAr: 'جميع البلدان', labelEs: 'Todos los países', labelPt: 'Todos os países' },
  { code: 'fr', labelFr: '🇫🇷 France', labelEn: '🇫🇷 France', labelAr: '🇫🇷 فرنسا', labelEs: '🇫🇷 Francia', labelPt: '🇫🇷 França' },
  { code: 'ma', labelFr: '🇲🇦 Maroc', labelEn: '🇲🇦 Morocco', labelAr: '🇲🇦 المغرب', labelEs: '🇲🇦 Marruecos', labelPt: '🇲🇦 Marrocos' },
  { code: 'dz', labelFr: '🇩🇿 Algérie', labelEn: '🇩🇿 Algeria', labelAr: '🇩🇿 الجزائر', labelEs: '🇩🇿 Argelia', labelPt: '🇩🇿 Argélia' },
  { code: 'sn', labelFr: '🇸🇳 Sénégal', labelEn: '🇸🇳 Senegal', labelAr: '🇸🇳 السنغال', labelEs: '🇸🇳 Senegal', labelPt: '🇸🇳 Senegal' },
  { code: 'tn', labelFr: '🇹🇳 Tunisie', labelEn: '🇹🇳 Tunisia', labelAr: '🇹🇳 تونس', labelEs: '🇹🇳 Túnez', labelPt: '🇹🇳 Tunísia' },
  { code: 'eg', labelFr: '🇪🇬 Égypte', labelEn: '🇪🇬 Egypt', labelAr: '🇪🇬 مصر', labelEs: '🇪🇬 Egipto', labelPt: '🇪🇬 Egito' },
  { code: 'uk', labelFr: '🇬🇧 Royaume-Uni', labelEn: '🇬🇧 United Kingdom', labelAr: '🇬🇧 المملكة المتحدة', labelEs: '🇬🇧 Reino Unido', labelPt: '🇬🇧 Reino Unido' },
  { code: 'us', labelFr: '🇺🇸 États-Unis', labelEn: '🇺🇸 United States', labelAr: '🇺🇸 الولايات المتحدة', labelEs: '🇺🇸 Estados Unidos', labelPt: '🇺🇸 Estados Unidos' },
  { code: 'es', labelFr: '🇪🇸 Espagne', labelEn: '🇪🇸 Spain', labelAr: '🇪🇸 إسبانيا', labelEs: '🇪🇸 España', labelPt: '🇪🇸 Espanha' },
  { code: 'de', labelFr: '🇩🇪 Allemagne', labelEn: '🇩🇪 Germany', labelAr: '🇩🇪 ألمانيا', labelEs: '🇩🇪 Alemania', labelPt: '🇩🇪 Alemanha' },
  { code: 'it', labelFr: '🇮🇹 Italie', labelEn: '🇮🇹 Italy', labelAr: '🇮🇹 إيطاليا', labelEs: '🇮🇹 Italia', labelPt: '🇮🇹 Itália' },
  { code: 'br', labelFr: '🇧🇷 Brésil', labelEn: '🇧🇷 Brazil', labelAr: '🇧🇷 البرازيل', labelEs: '🇧🇷 Brasil', labelPt: '🇧🇷 Brasil' },
  { code: 'ar', labelFr: '🇦🇷 Argentine', labelEn: '🇦🇷 Argentina', labelAr: '🇦🇷 الأرجنتين', labelEs: '🇦🇷 Argentina', labelPt: '🇦🇷 Argentina' },
  { code: 'sa', labelFr: '🇸🇦 Arabie Saoudite', labelEn: '🇸🇦 Saudi Arabia', labelAr: '🇸🇦 السعودية', labelEs: '🇸🇦 Arabia Saudita', labelPt: '🇸🇦 Arábia Saudita' },
  { code: 'tr', labelFr: '🇹🇷 Turquie', labelEn: '🇹🇷 Turkey', labelAr: '🇹🇷 تركيا', labelEs: '🇹🇷 Turquía', labelPt: '🇹🇷 Turquia' },
  { code: 'ir', labelFr: '🇮🇷 Iran', labelEn: '🇮🇷 Iran', labelAr: '🇮🇷 إيران', labelEs: '🇮🇷 Irán', labelPt: '🇮🇷 Irã' },
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
  }, [channelCountry]);

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

  // Batch health check
  const handleCheckAll = () => {
    const urlsToCheck = displayChannels
      .filter((ch) => ch.status === 'unknown' || !ch.status)
      .map((ch) => ch.url);

    if (urlsToCheck.length === 0) {
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
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40" />
          <Input
            placeholder={t(language, 'channels.searchPlaceholder')}
            value={channelSearch}
            onChange={(e) => {
              setChannelSearch(e.target.value);
              setPage(0);
            }}
            className="pl-9 bg-card dark:bg-white/[0.03] border-border dark:border-white/[0.06] rounded-xl focus:border-emerald-500/30 focus:ring-emerald-500/20 placeholder:text-muted-foreground/30"
          />
        </div>

        {/* Country & Refresh */}
        <div className="flex gap-2">
          <Select value={channelCountry || 'all'} onValueChange={handleCountryChange}>
            <SelectTrigger className="flex-1 bg-card dark:bg-white/[0.03] border-border dark:border-white/[0.06] h-9 text-sm rounded-xl">
              <Globe className="h-4 w-4 mr-1.5 shrink-0 text-muted-foreground/50" />
              <SelectValue placeholder="Pays" />
            </SelectTrigger>
            <SelectContent>
              {COUNTRIES_BASE.map((c) => (
                <SelectItem key={c.code || 'all'} value={c.code || 'all'}>
                  {language === 'ar' ? c.labelAr : language === 'es' ? c.labelEs : language === 'pt' ? c.labelPt : language === 'en' ? c.labelEn : c.labelFr}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="icon"
            onClick={handleRefresh}
            disabled={channelsLoading}
            className="shrink-0 bg-card dark:bg-white/[0.03] border-border dark:border-white/[0.06] h-9 w-9 rounded-xl hover:bg-accent dark:bg-white/[0.06]"
          >
            <RefreshCw className={`h-4 w-4 ${channelsLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {/* Online Only Toggle + Health Check Button */}
        <div className="flex items-center justify-between gap-3 bg-secondary dark:bg-white/[0.02] rounded-2xl p-3 border border-border dark:border-white/[0.05]">
          <div className="flex items-center gap-2.5">
            <Switch
              id="online-only"
              checked={onlineOnly}
              onCheckedChange={setOnlineOnly}
              className="data-[state=checked]:bg-emerald-600"
            />
            <Label htmlFor="online-only" className="text-xs font-medium cursor-pointer flex items-center gap-1.5">
              <Wifi className="h-3.5 w-3.5 text-emerald-400" />
              {t(language, 'channels.onlineOnly')}
            </Label>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleCheckAll}
            disabled={checkingChannels}
            className="h-7 text-[11px] gap-1.5 bg-card dark:bg-white/[0.03] border-border dark:border-white/[0.06] rounded-xl hover:bg-accent dark:bg-white/[0.06]"
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
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground/40 px-1 font-medium">
            {onlineCount > 0 && (
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                {onlineCount} {t(language, 'channels.online')}
              </span>
            )}
            {offlineCount > 0 && (
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                {offlineCount} {t(language, 'channels.offline')}
              </span>
            )}
            {uncheckedCount > 0 && (
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-muted-foreground/30" />
                {uncheckedCount} {t(language, 'channels.untested')}{uncheckedCount > 1 ? 's' : ''}
              </span>
            )}
          </div>
        )}

        {/* Group Tags */}
        {groups.length > 0 && (
          <div className="flex gap-1.5 flex-wrap">
            <button
              onClick={() => { setSelectedGroup(''); setPage(0); }}
              className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-[10px] font-semibold transition-all duration-200 ${
                selectedGroup === ''
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                  : 'bg-card dark:bg-white/[0.03] text-muted-foreground/50 border border-border dark:border-white/[0.05] hover:bg-accent dark:bg-white/[0.06]'
              }`}
            >
              {t(language, 'common.all')}
            </button>
            {groups.slice(0, 10).map((group) => (
              <button
                key={group}
                onClick={() => {
                  setSelectedGroup(selectedGroup === group ? '' : group);
                  setPage(0);
                }}
                className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-[10px] font-semibold transition-all duration-200 truncate max-w-[120px] ${
                  selectedGroup === group
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                    : 'bg-card dark:bg-white/[0.03] text-muted-foreground/50 border border-border dark:border-white/[0.05] hover:bg-accent dark:bg-white/[0.06]'
                }`}
              >
                {group}
              </button>
            ))}
            {groups.length > 10 && (
              <span className="text-[10px] text-muted-foreground/25 self-center">
                +{groups.length - 10} {t(language, 'common.more')}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Channels List */}
      {channelsLoading && channels.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center mb-3">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
          </div>
          <p className="text-sm text-muted-foreground/50">{t(language, 'common.loading')}...</p>
        </div>
      ) : displayChannels.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-card dark:bg-white/[0.03] flex items-center justify-center mb-3 border border-border dark:border-white/[0.05]">
            <Tv className="h-8 w-8 text-muted-foreground/25" />
          </div>
          <p className="text-sm text-muted-foreground/50 font-medium">{t(language, 'channels.noChannels')}</p>
          <p className="text-xs text-muted-foreground/30 mt-1">
            {onlineOnly ? t(language, 'channels.tryDisableFilter') : t(language, 'channels.adjustFilters')}
          </p>
          {onlineOnly && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOnlineOnly(false)}
              className="mt-3 rounded-xl border-border dark:border-white/[0.06] bg-secondary dark:bg-white/[0.02]"
            >
              <WifiOff className="h-3.5 w-3.5 mr-1.5" />
              {t(language, 'channels.showAllChannels')}
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between px-1">
            <p className="text-xs text-muted-foreground/40 font-medium">
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
                className="bg-card dark:bg-white/[0.03] border-border dark:border-white/[0.06] rounded-xl hover:bg-accent dark:bg-white/[0.06]"
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
