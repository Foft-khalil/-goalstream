'use client';

import { useEffect } from 'react';
import { useAppStore, ViewType } from '@/lib/store';
import { t } from '@/lib/i18n';
import LiveMatches from '@/components/live-matches';
import BasketballMatches from '@/components/basketball-matches';
import ChannelsList from '@/components/channels-list';
import StandingsView from '@/components/standings-view';
import FavoritesView from '@/components/favorites-view';
import VideoPlayer from '@/components/video-player';
import LanguageSelector from '@/components/language-selector';
import { Zap, Tv, BarChart3, Menu, Download, WifiOff, Heart, Dribbble, Bell, BellOff, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { useState } from 'react';
import { usePWA } from '@/hooks/use-pwa';
import { NotificationSettingsDialog } from '@/components/notification-settings';
import { useFavorites } from '@/hooks/use-favorites';
import { useNotifications } from '@/hooks/use-notifications';

function AppHeader() {
  const { currentView, setCurrentView, footballMatches, basketballMatches, language } = useAppStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { installPrompt, installApp, isOnline } = usePWA();
  const { totalFavorites } = useFavorites();
  const { notificationsEnabled, toggleNotifications, upcomingFavoriteCount, settings, updateSettings } = useNotifications();
  const [notifSettingsOpen, setNotifSettingsOpen] = useState(false);

  const footballLiveCount = footballMatches.filter((m) => m.status === 'live').length;
  const bballLiveCount = basketballMatches.filter((m) => m.status === 'live').length;

  const navItems = [
    { view: 'live' as ViewType, icon: <Zap className="h-4 w-4" />, label: t(language, 'nav.matches') },
    { view: 'basketball' as ViewType, icon: <Dribbble className="h-4 w-4" />, label: t(language, 'nav.basketball') },
    { view: 'favorites' as ViewType, icon: <Heart className="h-4 w-4" />, label: t(language, 'nav.favorites') },
    { view: 'channels' as ViewType, icon: <Tv className="h-4 w-4" />, label: t(language, 'nav.channels') },
    { view: 'standings' as ViewType, icon: <BarChart3 className="h-4 w-4" />, label: t(language, 'nav.standings') },
  ];

  return (
    <header className="sticky top-0 z-40 bg-background/90 backdrop-blur-xl border-b border-border/30">
      <div className="max-w-5xl mx-auto px-4">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <img
              src="/icon-192.png?v=2"
              alt="GoalStream"
              className="w-9 h-9 rounded-xl shadow-sm shadow-green-500/20"
            />
            <div>
              <h1 className="text-base font-extrabold leading-tight tracking-tight">GoalStream</h1>
              <p className="text-[9px] text-muted-foreground/60 leading-tight font-medium uppercase tracking-wider">{t(language, 'common.liveSport')}</p>
            </div>
          </div>

          {/* Language + Notification + Install button + Desktop Nav */}
          <div className="hidden sm:flex items-center gap-1">
            <LanguageSelector />
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleNotifications}
              className={`h-8 w-8 relative rounded-lg ${
                notificationsEnabled
                  ? 'text-green-500 hover:text-green-600 hover:bg-green-500/10'
                  : 'text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/50'
              }`}
              title={notificationsEnabled ? t(language, 'notifications.enabled') : t(language, 'notifications.enable')}
            >
              {notificationsEnabled ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
              {notificationsEnabled && upcomingFavoriteCount > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              )}
            </Button>
            {notificationsEnabled && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setNotifSettingsOpen(true)}
                className="h-8 w-8 rounded-lg text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/50"
                title={t(language, 'notifications.settings')}
              >
                <Settings2 className="h-3.5 w-3.5" />
              </Button>
            )}
            {installPrompt && (
              <Button
                size="sm"
                onClick={installApp}
                className="h-8 gap-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-lg"
              >
                <Download className="h-3.5 w-3.5" />
                {t(language, 'common.install')}
              </Button>
            )}
            {!isOnline && (
              <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <WifiOff className="h-3 w-3 text-amber-500" />
                <span className="text-[10px] font-semibold text-amber-500">{t(language, 'common.offline')}</span>
              </div>
            )}
          </div>
          <nav className="hidden sm:flex items-center bg-muted/40 rounded-xl p-1 gap-0.5">
            {navItems.map((item) => {
              const isActive = currentView === item.view;
              return (
                <button
                  key={item.view}
                  onClick={() => setCurrentView(item.view)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                  {item.view === 'live' && footballLiveCount > 0 && (
                    <span className="ml-0.5 flex items-center gap-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                      <span className="text-[10px] font-bold text-red-500">{footballLiveCount}</span>
                    </span>
                  )}
                  {item.view === 'basketball' && bballLiveCount > 0 && (
                    <span className="ml-0.5 flex items-center gap-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
                      <span className="text-[10px] font-bold text-orange-500">{bballLiveCount}</span>
                    </span>
                  )}
                  {item.view === 'favorites' && totalFavorites > 0 && (
                    <span className="ml-0.5 flex items-center justify-center w-4 h-4 rounded-full bg-green-500/15 text-[10px] font-bold text-green-500">
                      {totalFavorites}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Mobile language + notification + menu */}
          <div className="flex sm:hidden items-center gap-0.5">
            <LanguageSelector />
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleNotifications}
              className={`h-9 w-9 relative ${
                notificationsEnabled
                  ? 'text-green-500 hover:text-green-600 hover:bg-green-500/10'
                  : 'text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/50'
              }`}
              title={notificationsEnabled ? t(language, 'notifications.enabled') : t(language, 'notifications.enable')}
            >
              {notificationsEnabled ? <Bell className="h-4.5 w-4.5" /> : <BellOff className="h-4.5 w-4.5" />}
              {notificationsEnabled && upcomingFavoriteCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              )}
            </Button>
            {notificationsEnabled && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setNotifSettingsOpen(true)}
                className="h-9 w-9 text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/50"
                title={t(language, 'notifications.settings')}
              >
                <Settings2 className="h-4 w-4" />
              </Button>
            )}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
            <SheetContent side="right" className="w-64">
              <SheetTitle className="sr-only">{t(language, 'nav.matches')}</SheetTitle>
              <div className="flex items-center gap-2.5 mb-8 mt-4">
                <img
                  src="/icon-192.png?v=2"
                  alt="GoalStream"
                  className="w-9 h-9 rounded-xl"
                />
                <span className="font-extrabold tracking-tight">GoalStream</span>
              </div>
              {/* Install button in mobile menu */}
              {installPrompt && (
                <Button
                  onClick={installApp}
                  className="w-full mb-4 gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg"
                >
                  <Download className="h-4 w-4" />
                  {t(language, 'common.installApp')}
                </Button>
              )}
              {!isOnline && (
                <div className="flex items-center gap-1.5 px-3 py-2 mb-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <WifiOff className="h-3.5 w-3.5 text-amber-500" />
                  <span className="text-xs font-semibold text-amber-500">{t(language, 'common.offlineMode')}</span>
                </div>
              )}
              <nav className="space-y-1">
                {navItems.map((item) => {
                  const isActive = currentView === item.view;
                  return (
                    <button
                      key={item.view}
                      onClick={() => {
                        setCurrentView(item.view);
                        setMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                        isActive
                          ? 'bg-green-500/10 text-green-600'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                      }`}
                    >
                      {item.icon}
                      <span>{item.label}</span>
                      {item.view === 'live' && footballLiveCount > 0 && (
                        <span className="ml-auto flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                          <span className="text-[10px] font-bold text-red-500">{footballLiveCount}</span>
                        </span>
                      )}
                      {item.view === 'basketball' && bballLiveCount > 0 && (
                        <span className="ml-auto flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
                          <span className="text-[10px] font-bold text-orange-500">{bballLiveCount}</span>
                        </span>
                      )}
                      {item.view === 'favorites' && totalFavorites > 0 && (
                        <span className="ml-auto flex items-center justify-center w-5 h-5 rounded-full bg-green-500/15 text-[10px] font-bold text-green-500">
                          {totalFavorites}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>
            </SheetContent>
          </Sheet>
          </div>
        </div>
      </div>
      {/* Notification Settings Dialog */}
      <NotificationSettingsDialog
        open={notifSettingsOpen}
        onOpenChange={setNotifSettingsOpen}
        settings={settings}
        onSettingsChange={updateSettings}
      />
    </header>
  );
}

function MobileBottomNav() {
  const { currentView, setCurrentView, footballMatches, basketballMatches, language } = useAppStore();
  const { totalFavorites } = useFavorites();
  const footballLiveCount = footballMatches.filter((m) => m.status === 'live').length;
  const bballLiveCount = basketballMatches.filter((m) => m.status === 'live').length;

  const navItems = [
    { view: 'live' as ViewType, icon: <Zap className="h-5 w-5" />, label: t(language, 'nav.matches') },
    { view: 'basketball' as ViewType, icon: <Dribbble className="h-5 w-5" />, label: t(language, 'nav.basket') },
    { view: 'favorites' as ViewType, icon: <Heart className="h-5 w-5" />, label: t(language, 'nav.favorites') },
    { view: 'channels' as ViewType, icon: <Tv className="h-5 w-5" />, label: t(language, 'nav.channels') },
    { view: 'standings' as ViewType, icon: <BarChart3 className="h-5 w-5" />, label: t(language, 'nav.standings') },
  ];

  return (
    <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-xl border-t border-border/30 safe-area-bottom">
      <div className="flex items-center justify-around h-16 px-1">
        {navItems.map((item) => {
          const isActive = currentView === item.view;
          return (
            <button
              key={item.view}
              onClick={() => setCurrentView(item.view)}
              className={`flex flex-col items-center gap-0.5 px-2 py-2 rounded-xl transition-all relative ${
                isActive
                  ? item.view === 'basketball' ? 'text-orange-500' : 'text-green-500'
                  : 'text-muted-foreground/60'
              }`}
            >
              {item.icon}
              <span className="text-[10px] font-semibold">{item.label}</span>
              {item.view === 'live' && footballLiveCount > 0 && (
                <span className="absolute top-0.5 right-1 flex items-center justify-center">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                </span>
              )}
              {item.view === 'basketball' && bballLiveCount > 0 && (
                <span className="absolute top-0.5 right-1 flex items-center justify-center">
                  <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                </span>
              )}
              {item.view === 'favorites' && totalFavorites > 0 && (
                <span className="absolute top-0.5 right-0 flex items-center justify-center w-3.5 h-3.5 rounded-full bg-green-500 text-[8px] font-bold text-white">
                  {totalFavorites > 9 ? '9+' : totalFavorites}
                </span>
              )}
              {isActive && (
                <span className={`absolute -bottom-2 w-8 h-0.5 rounded-full ${item.view === 'basketball' ? 'bg-orange-500' : 'bg-green-500'}`} />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export default function Home() {
  const { currentView, fetchChannels, fetchFootballMatches, fetchBasketballMatches, language } = useAppStore();
  const { isOnline } = usePWA();

  useEffect(() => {
    // Initial fetch: today's matches first (fast), then rest of week in background
    const timer = setTimeout(() => {
      const now = new Date();
      const today = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
      fetchFootballMatches([today]);
      // Fetch the rest of the week after a delay to avoid OOM
      setTimeout(() => {
        const dates: string[] = [];
        for (let i = 1; i <= 6; i++) {
          const d = new Date(now.getTime() + i * 24 * 60 * 60 * 1000);
          dates.push(`${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`);
        }
        fetchFootballMatches(dates);
      }, 5000);
    }, 2000);
    return () => clearTimeout(timer);
  }, [fetchFootballMatches]);

  // Fetch secondary data when user navigates to those views
  // Basketball also pre-fetches after a delay so live badge shows immediately
  useEffect(() => {
    const timer = setTimeout(() => {
      if (currentView === 'channels') fetchChannels();
      if (currentView === 'basketball') fetchBasketballMatches();
    }, 1000);
    return () => clearTimeout(timer);
  }, [currentView, fetchChannels, fetchBasketballMatches]);

  // Pre-fetch basketball data after initial load so live badge shows in nav
  useEffect(() => {
    const timer = setTimeout(() => {
      const now = new Date();
      const today = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
      fetchBasketballMatches([today]);
    }, 8000);
    return () => clearTimeout(timer);
  }, [fetchBasketballMatches]);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <AppHeader />

      {/* Offline banner */}
      {!isOnline && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 py-1.5 text-center">
          <span className="text-xs font-semibold text-amber-600">
            <WifiOff className="h-3 w-3 inline mr-1" />
            {t(language, 'offline.message')}
          </span>
        </div>
      )}

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-5 pb-20 sm:pb-5">
        {currentView === 'live' && <LiveMatches />}
        {currentView === 'basketball' && <BasketballMatches />}
        {currentView === 'favorites' && <FavoritesView />}
        {currentView === 'channels' && <ChannelsList />}
        {currentView === 'standings' && <StandingsView />}
      </main>

      {/* Footer */}
      <footer className="hidden sm:block border-t border-border/20 bg-muted/10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <p className="text-[11px] text-muted-foreground/50 font-medium">
            GoalStream — {t(language, 'footer.description')}
          </p>
          <p className="text-[11px] text-muted-foreground/50">
            {t(language, 'footer.streamsFrom')}{' '}
            <a
              href="https://github.com/iptv-org/iptv"
              target="_blank"
              rel="noopener noreferrer"
              className="text-green-500/70 hover:text-green-500 hover:underline"
            >
              iptv-org
            </a>
          </p>
        </div>
      </footer>

      {/* Mobile Bottom Nav */}
      <MobileBottomNav />

      {/* Video Player Overlay */}
      <VideoPlayer />
    </div>
  );
}
