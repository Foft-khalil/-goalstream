'use client';

import { useEffect } from 'react';
import { useAppStore, ViewType } from '@/lib/store';
import LiveMatches from '@/components/live-matches';
import ChannelsList from '@/components/channels-list';
import AdminDashboard from '@/components/admin-dashboard';
import VideoPlayer from '@/components/video-player';
import { Zap, Tv, Shield, Trophy, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useState } from 'react';

function AppHeader() {
  const { currentView, setCurrentView, footballMatches } = useAppStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const liveCount = footballMatches.filter((m) => m.status === 'live').length;

  const navItems = [
    { view: 'live' as ViewType, icon: <Zap className="h-4 w-4" />, label: 'Matchs' },
    { view: 'channels' as ViewType, icon: <Tv className="h-4 w-4" />, label: 'Chaînes' },
    { view: 'admin' as ViewType, icon: <Shield className="h-4 w-4" />, label: 'Admin' },
  ];

  return (
    <header className="sticky top-0 z-40 bg-background/90 backdrop-blur-xl border-b border-border/30">
      <div className="max-w-5xl mx-auto px-4">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-sm shadow-green-500/20">
              <Trophy className="h-4.5 w-4.5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-extrabold leading-tight tracking-tight">GoalStream</h1>
              <p className="text-[9px] text-muted-foreground/60 leading-tight font-medium uppercase tracking-wider">Football en direct</p>
            </div>
          </div>

          {/* Desktop Nav */}
          <nav className="hidden sm:flex items-center bg-muted/40 rounded-xl p-1 gap-0.5">
            {navItems.map((item) => {
              const isActive = currentView === item.view;
              return (
                <button
                  key={item.view}
                  onClick={() => setCurrentView(item.view)}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                  {item.view === 'live' && liveCount > 0 && (
                    <span className="ml-0.5 flex items-center gap-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                      <span className="text-[10px] font-bold text-red-500">{liveCount}</span>
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Mobile Menu */}
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild className="sm:hidden">
              <Button variant="ghost" size="icon" className="h-9 w-9">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-64">
              <div className="flex items-center gap-2.5 mb-8 mt-4">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                  <Trophy className="h-4.5 w-4.5 text-white" />
                </div>
                <h2 className="font-extrabold tracking-tight">GoalStream</h2>
              </div>
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
                      {item.view === 'live' && liveCount > 0 && (
                        <span className="ml-auto flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                          <span className="text-[10px] font-bold text-red-500">{liveCount}</span>
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
    </header>
  );
}

function MobileBottomNav() {
  const { currentView, setCurrentView, footballMatches } = useAppStore();
  const liveCount = footballMatches.filter((m) => m.status === 'live').length;

  const navItems = [
    { view: 'live' as ViewType, icon: <Zap className="h-5 w-5" />, label: 'Matchs' },
    { view: 'channels' as ViewType, icon: <Tv className="h-5 w-5" />, label: 'Chaînes' },
    { view: 'admin' as ViewType, icon: <Shield className="h-5 w-5" />, label: 'Admin' },
  ];

  return (
    <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-xl border-t border-border/30 safe-area-bottom">
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          const isActive = currentView === item.view;
          return (
            <button
              key={item.view}
              onClick={() => setCurrentView(item.view)}
              className={`flex flex-col items-center gap-0.5 px-5 py-2 rounded-xl transition-all relative ${
                isActive
                  ? 'text-green-500'
                  : 'text-muted-foreground/60'
              }`}
            >
              {item.icon}
              <span className="text-[10px] font-semibold">{item.label}</span>
              {item.view === 'live' && liveCount > 0 && (
                <span className="absolute top-0.5 right-3 flex items-center justify-center">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                </span>
              )}
              {isActive && (
                <span className="absolute -bottom-2 w-8 h-0.5 rounded-full bg-green-500" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export default function Home() {
  const { currentView, fetchMatches, fetchChannels, fetchFootballMatches } = useAppStore();

  useEffect(() => {
    fetchMatches();
    fetchChannels();
    fetchFootballMatches();
  }, [fetchMatches, fetchChannels, fetchFootballMatches]);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <AppHeader />

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-5 pb-20 sm:pb-5">
        {currentView === 'live' && <LiveMatches />}
        {currentView === 'channels' && <ChannelsList />}
        {currentView === 'admin' && <AdminDashboard />}
      </main>

      {/* Footer */}
      <footer className="hidden sm:block border-t border-border/20 bg-muted/10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <p className="text-[11px] text-muted-foreground/50 font-medium">
            GoalStream — Streaming football gratuit via IPTV
          </p>
          <p className="text-[11px] text-muted-foreground/50">
            Flux issus de{' '}
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
