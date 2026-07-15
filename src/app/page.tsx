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
import ErrorBoundary from '@/components/error-boundary';
import { Zap, Tv, BarChart3, Menu, Download, WifiOff, Heart, Dribbble, Bell, Sun, Moon, Search, Shield, Trophy, ChevronRight, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { useState } from 'react';
import { usePWA } from '@/hooks/use-pwa';
import { NotificationSettingsDialog } from '@/components/notification-settings';
import NotificationCenter from '@/components/notification-center';
import GlobalSearch from '@/components/global-search';
import { PrivacyPolicyDialog } from '@/components/privacy-policy-dialog';
import { useNotificationStore } from '@/lib/notification-store';
import { useFavorites } from '@/hooks/use-favorites';
import { useNotifications } from '@/hooks/use-notifications';

function AppHeader() {
  const { currentView, setCurrentView, footballMatches, basketballMatches, language, theme, setTheme } = useAppStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { installPrompt, installApp, isOnline } = usePWA();
  const { totalFavorites } = useFavorites();
  const { settings, updateSettings } = useNotifications();
  const { unreadCount } = useNotificationStore();
  const [notifSettingsOpen, setNotifSettingsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);

  const footballLiveCount = footballMatches.filter((m) => m.status === 'live').length;
  const bballLiveCount = basketballMatches.filter((m) => m.status === 'live').length;

  const navItems = [
    { view: 'live' as ViewType, icon: <Zap className="h-4 w-4" />, label: t(language, 'nav.matches') },
    { view: 'basketball' as ViewType, icon: <Dribbble className="h-4 w-4" />, label: t(language, 'nav.basketball') },
    { view: 'favorites' as ViewType, icon: <Heart className="h-4 w-4" />, label: t(language, 'nav.favorites') },
    { view: 'channels' as ViewType, icon: <Tv className="h-4 w-4" />, label: t(language, 'nav.channels') },
    { view: 'standings' as ViewType, icon: <BarChart3 className="h-4 w-4" />, label: t(language, 'nav.standings') },
  ];

  const handleThemeToggle = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-border/30">
      <div className="header-glass">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex items-center justify-between h-14">
            {/* Logo */}
            <button
              onClick={() => setCurrentView('live')}
              className="flex items-center gap-2.5 hover:opacity-80 active:scale-[0.97] transition-all duration-200"
              title="GoalStream"
            >
              <div className="relative">
                <img
                  src="/icon-192.png?v=2"
                  alt="GoalStream"
                  className="w-9 h-9 rounded-xl"
                />
                {footballLiveCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-background animate-pulse" />
                )}
              </div>
              <div className="text-left">
                <h1 className="text-[15px] font-extrabold leading-tight tracking-tight">
                  <span className="gradient-text">Goal</span>Stream
                </h1>
                <p className="text-[9px] text-muted-foreground/40 leading-tight font-semibold uppercase tracking-[0.15em]">{t(language, 'common.liveSport')}</p>
              </div>
            </button>

            {/* Desktop: Search + Actions + Nav */}
            <div className="hidden sm:flex items-center gap-1.5">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-xl text-muted-foreground/60 hover:text-foreground hover:bg-white/5 dark:hover:bg-white/5"
                onClick={() => setSearchOpen(true)}
                title={t(language, 'search.title')}
              >
                <Search className="h-4 w-4" />
              </Button>
              <LanguageSelector />
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-xl text-muted-foreground/60 hover:text-foreground hover:bg-white/5 dark:hover:bg-white/5"
                onClick={handleThemeToggle}
                title={theme === 'dark' ? t(language, 'common.lightMode') : t(language, 'common.darkMode')}
              >
                {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 relative rounded-xl text-muted-foreground/60 hover:text-foreground hover:bg-white/5 dark:hover:bg-white/5"
                    title={t(language, 'notifications.title')}
                  >
                    <Bell className="h-4 w-4" />
                    {unreadCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[16px] h-4 px-0.5 rounded-full bg-red-500 text-[8px] font-bold text-white">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-80 p-0">
                  <NotificationCenter
                    onOpenSettings={() => setNotifSettingsOpen(true)}
                  />
                </PopoverContent>
              </Popover>
              {installPrompt && (
                <Button
                  size="sm"
                  onClick={installApp}
                  className="h-8 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-lg shadow-emerald-600/20"
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
            {/* Desktop Nav */}
            <nav className="hidden sm:flex items-center gap-0.5 bg-secondary/50 dark:bg-white/[0.02] rounded-xl p-0.5 border border-border/50 dark:border-white/[0.03]">
              {navItems.map((item) => {
                const isActive = currentView === item.view;
                const accentColor = item.view === 'basketball' ? 'orange' : 'emerald';
                return (
                  <button
                    key={item.view}
                    onClick={() => setCurrentView(item.view)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all duration-200 ${
                      isActive
                        ? accentColor === 'orange'
                          ? 'bg-orange-500/10 text-orange-400 shadow-sm'
                          : 'bg-emerald-500/10 text-emerald-400 shadow-sm'
                        : 'text-muted-foreground/50 hover:text-foreground hover:bg-white/[0.03]'
                    }`}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                    {item.view === 'live' && footballLiveCount > 0 && (
                      <span className="ml-0.5 flex items-center gap-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                        <span className="text-[10px] font-bold text-red-400">{footballLiveCount}</span>
                      </span>
                    )}
                    {item.view === 'basketball' && bballLiveCount > 0 && (
                      <span className="ml-0.5 flex items-center gap-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
                        <span className="text-[10px] font-bold text-orange-400">{bballLiveCount}</span>
                      </span>
                    )}
                    {item.view === 'favorites' && totalFavorites > 0 && (
                      <span className="ml-0.5 flex items-center justify-center min-w-[16px] h-4 px-0.5 rounded-full bg-emerald-500/15 text-[10px] font-bold text-emerald-400">
                        {totalFavorites}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>

            {/* Mobile actions */}
            <div className="flex sm:hidden items-center gap-0.5">
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-xl text-muted-foreground/60"
                onClick={() => setSearchOpen(true)}
                title={t(language, 'search.title')}
              >
                <Search className="h-[18px] w-[18px]" />
              </Button>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 relative rounded-xl text-muted-foreground/60"
                    title={t(language, 'notifications.title')}
                  >
                    <Bell className="h-[18px] w-[18px]" />
                    {unreadCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[16px] h-4 px-0.5 rounded-full bg-red-500 text-[8px] font-bold text-white">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-80 p-0">
                  <NotificationCenter
                    onOpenSettings={() => setNotifSettingsOpen(true)}
                  />
                </PopoverContent>
              </Popover>
              <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-muted-foreground/60">
                    <Menu className="h-[18px] w-[18px]" />
                  </Button>
                </SheetTrigger>
              <SheetContent side="right" className="w-72 bg-background border-border/30">
                <SheetTitle className="sr-only">{t(language, 'nav.matches')}</SheetTitle>
                <div className="flex items-center gap-2.5 mb-8 mt-4">
                  <img
                    src="/icon-192.png?v=2"
                    alt="GoalStream"
                    className="w-10 h-10 rounded-xl"
                  />
                  <div>
                    <span className="font-extrabold tracking-tight text-lg">
                      <span className="gradient-text">Goal</span>Stream
                    </span>
                    <p className="text-[10px] text-muted-foreground/40 font-medium uppercase tracking-wider">{t(language, 'common.liveSport')}</p>
                  </div>
                </div>
                {/* Quick actions in mobile menu */}
                <div className="flex items-center gap-2 mb-6">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 rounded-xl text-muted-foreground/60 hover:bg-white/5 dark:hover:bg-white/5"
                    onClick={handleThemeToggle}
                    title={theme === 'dark' ? t(language, 'common.lightMode') : t(language, 'common.darkMode')}
                  >
                    {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                  </Button>
                  <LanguageSelector />
                </div>
                {/* Install button in mobile menu */}
                {installPrompt && (
                  <Button
                    onClick={installApp}
                    className="w-full mb-5 gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl shadow-lg shadow-emerald-600/20"
                  >
                    <Download className="h-4 w-4" />
                    {t(language, 'common.installApp')}
                  </Button>
                )}
                {!isOnline && (
                  <div className="flex items-center gap-1.5 px-3 py-2 mb-5 rounded-xl bg-amber-500/10 border border-amber-500/20">
                    <WifiOff className="h-3.5 w-3.5 text-amber-500" />
                    <span className="text-xs font-semibold text-amber-500">{t(language, 'common.offlineMode')}</span>
                  </div>
                )}
                <nav className="space-y-1">
                  {navItems.map((item) => {
                    const isActive = currentView === item.view;
                    const accentColor = item.view === 'basketball' ? 'orange' : 'emerald';
                    return (
                      <button
                        key={item.view}
                        onClick={() => {
                          setCurrentView(item.view);
                          setMobileMenuOpen(false);
                        }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                          isActive
                            ? accentColor === 'orange'
                              ? 'bg-orange-500/10 text-orange-400'
                              : 'bg-emerald-500/10 text-emerald-400'
                            : 'text-muted-foreground/60 hover:text-foreground hover:bg-white/[0.03]'
                        }`}
                      >
                        {item.icon}
                        <span>{item.label}</span>
                        {item.view === 'live' && footballLiveCount > 0 && (
                          <span className="ml-auto flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                            <span className="text-[10px] font-bold text-red-400">{footballLiveCount}</span>
                          </span>
                        )}
                        {item.view === 'basketball' && bballLiveCount > 0 && (
                          <span className="ml-auto flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
                            <span className="text-[10px] font-bold text-orange-400">{bballLiveCount}</span>
                          </span>
                        )}
                        {item.view === 'favorites' && totalFavorites > 0 && (
                          <span className="ml-auto flex items-center justify-center min-w-[20px] h-5 rounded-full bg-emerald-500/15 text-[10px] font-bold text-emerald-400">
                            {totalFavorites}
                          </span>
                        )}
                        {isActive && <ChevronRight className="h-3.5 w-3.5 ml-auto text-muted-foreground/20" />}
                      </button>
                    );
                  })}
                </nav>
                {/* Privacy Policy link in mobile menu */}
                <div className="mt-6 pt-4 border-t border-border/20">
                  <button
                    onClick={() => { setPrivacyOpen(true); setMobileMenuOpen(false); }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground/40 hover:text-foreground hover:bg-white/[0.03] transition-all"
                  >
                    <Shield className="h-4 w-4" />
                    <span>{t(language, 'footer.privacyPolicy')}</span>
                  </button>
                </div>
              </SheetContent>
            </Sheet>
            </div>
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
      {/* Global Search Dialog */}
      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
      {/* Privacy Policy Dialog */}
      <PrivacyPolicyDialog open={privacyOpen} onOpenChange={setPrivacyOpen} />
    </header>
  );
}

function MobileBottomNav() {
  const { currentView, setCurrentView, footballMatches, basketballMatches, language } = useAppStore();
  const { totalFavorites } = useFavorites();
  const footballLiveCount = footballMatches.filter((m) => m.status === 'live').length;
  const bballLiveCount = basketballMatches.filter((m) => m.status === 'live').length;

  const navItems = [
    { view: 'live' as ViewType, icon: <Zap className="h-5 w-5" />, activeIcon: <Zap className="h-5 w-5" />, label: t(language, 'nav.matches') },
    { view: 'basketball' as ViewType, icon: <Dribbble className="h-5 w-5" />, activeIcon: <Dribbble className="h-5 w-5" />, label: t(language, 'nav.basket') },
    { view: 'favorites' as ViewType, icon: <Heart className="h-5 w-5" />, activeIcon: <Heart className="h-5 w-5" />, label: t(language, 'nav.favorites') },
    { view: 'channels' as ViewType, icon: <Tv className="h-5 w-5" />, activeIcon: <Tv className="h-5 w-5" />, label: t(language, 'nav.channels') },
    { view: 'standings' as ViewType, icon: <BarChart3 className="h-5 w-5" />, activeIcon: <BarChart3 className="h-5 w-5" />, label: t(language, 'nav.standings') },
  ];

  return (
    <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-40 safe-area-bottom">
      <div className="bottom-nav-glass border-t border-border/20">
        <div className="flex items-center justify-around h-16 px-1 max-w-lg mx-auto">
          {navItems.map((item) => {
            const isActive = currentView === item.view;
            const accentColor = item.view === 'basketball' ? 'orange' : 'emerald';
            const activeTextColor = accentColor === 'orange' ? 'text-orange-400' : 'text-emerald-400';
            return (
              <button
                key={item.view}
                onClick={() => setCurrentView(item.view)}
                className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-2xl transition-all duration-200 relative ${
                  isActive ? activeTextColor : 'text-muted-foreground/35'
                }`}
              >
                {/* Active indicator pill */}
                {isActive && (
                  <span className={`absolute -top-1.5 left-1/2 -translate-x-1/2 w-6 h-[3px] rounded-full ${
                    accentColor === 'orange' ? 'bg-orange-400' : 'bg-emerald-400'
                  }`} style={{ boxShadow: accentColor === 'orange' ? '0 0 8px rgba(249,115,22,0.5)' : '0 0 8px rgba(16,185,129,0.5)' }} />
                )}
                <div className="relative">
                  {isActive ? item.activeIcon : item.icon}
                  {item.view === 'live' && footballLiveCount > 0 && (
                    <span className="absolute -top-1 -right-1.5 w-2.5 h-2.5 rounded-full bg-red-500 border-2 border-background animate-pulse" />
                  )}
                  {item.view === 'basketball' && bballLiveCount > 0 && (
                    <span className="absolute -top-1 -right-1.5 w-2.5 h-2.5 rounded-full bg-orange-500 border-2 border-background animate-pulse" />
                  )}
                  {item.view === 'favorites' && totalFavorites > 0 && (
                    <span className="absolute -top-1 -right-1.5 flex items-center justify-center min-w-[14px] h-3.5 px-0.5 rounded-full bg-emerald-500 text-[7px] font-bold text-white">
                      {totalFavorites > 9 ? '9+' : totalFavorites}
                    </span>
                  )}
                </div>
                <span className={`text-[10px] font-semibold ${isActive ? '' : 'opacity-50'}`}>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

export default function Home() {
  const { currentView, fetchChannels, fetchFootballMatches, fetchBasketballMatches, fetchHesgoalMatches, mergeHesgoalStreams, language, theme, setTheme, setLanguage, footballMatches } = useAppStore();
  const { isOnline } = usePWA();
  const [footerPrivacyOpen, setFooterPrivacyOpen] = useState(false);

  // Initialize theme and language from localStorage on mount (after hydration)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Theme
      const savedTheme = localStorage.getItem('goalstream_theme');
      if (savedTheme === 'light' || savedTheme === 'dark') {
        setTheme(savedTheme);
      } else {
        document.documentElement.classList.add('dark');
      }
      // Language
      const savedLang = localStorage.getItem('goalstream_language');
      if (savedLang && ['en', 'fr', 'ar', 'es', 'pt'].includes(savedLang)) {
        setLanguage(savedLang);
      }
    }
  }, [setTheme, setLanguage]);

  useEffect(() => {
    // Initial fetch: today's matches first (fast), then near future in background
    const timer = setTimeout(() => {
      const now = new Date();
      const d = (offset: number) => {
        const dt = new Date(now.getTime() + offset * 24 * 60 * 60 * 1000);
        return `${dt.getFullYear()}${String(dt.getMonth() + 1).padStart(2, '0')}${String(dt.getDate()).padStart(2, '0')}`;
      };
      // Fetch today + past 3 days first
      fetchFootballMatches([d(-3), d(-2), d(-1), d(0)]);
      // Fetch next 7 days after a delay to avoid OOM
      setTimeout(() => {
        const dates: string[] = [];
        for (let i = 1; i <= 7; i++) dates.push(d(i));
        fetchFootballMatches(dates);
      }, 5000);
      // Pre-fetch next 8-14 days in smaller batches
      setTimeout(() => {
        const dates: string[] = [];
        for (let i = 8; i <= 14; i++) dates.push(d(i));
        fetchFootballMatches(dates);
      }, 12000);
    }, 2000);
    return () => clearTimeout(timer);
  }, [fetchFootballMatches]);

  // Fetch HesGoal stream data and merge with football matches
  useEffect(() => {
    if (footballMatches.length === 0) return;
    const hasLive = footballMatches.some(m => m.status === 'live');
    if (!hasLive) return;

    const timer = setTimeout(() => {
      fetchHesgoalMatches().then(() => {
        mergeHesgoalStreams();
      });
    }, 3000);

    const interval = setInterval(() => {
      fetchHesgoalMatches().then(() => {
        mergeHesgoalStreams();
      });
    }, 60000);

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [footballMatches.length, footballMatches.filter(m => m.status === 'live').length, fetchHesgoalMatches, mergeHesgoalStreams]);

  // Fetch secondary data when user navigates to those views
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
        <div className="bg-amber-500/8 border-b border-amber-500/10 py-1.5 text-center">
          <span className="text-xs font-semibold text-amber-500">
            <WifiOff className="h-3 w-3 inline mr-1" />
            {t(language, 'offline.message')}
          </span>
        </div>
      )}

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-5 pb-20 sm:pb-5" style={{ touchAction: 'pan-y' }}>
        <ErrorBoundary>
          {currentView === 'live' && <LiveMatches />}
          {currentView === 'basketball' && <BasketballMatches />}
          {currentView === 'favorites' && <FavoritesView />}
          {currentView === 'channels' && <ChannelsList />}
          {currentView === 'standings' && <StandingsView />}
        </ErrorBoundary>
      </main>

      {/* Footer */}
      <footer className="hidden sm:block border-t border-border/20 bg-background/50">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <p className="text-[11px] text-muted-foreground/30 font-medium">
            GoalStream — {t(language, 'footer.description')}
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setFooterPrivacyOpen(true)}
              className="text-[11px] text-muted-foreground/30 hover:text-emerald-400 transition-colors"
            >
              {t(language, 'footer.privacyPolicy')}
            </button>
          </div>
        </div>
      </footer>

      {/* Mobile Bottom Nav */}
      <MobileBottomNav />

      {/* Privacy Policy Dialog (from footer) */}
      <PrivacyPolicyDialog open={footerPrivacyOpen} onOpenChange={setFooterPrivacyOpen} />

      {/* Video Player Overlay */}
      <VideoPlayer />
    </div>
  );
}
