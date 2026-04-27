'use client';

import { useEffect } from 'react';
import { useAppStore, ViewType } from '@/lib/store';
import LiveMatches from '@/components/live-matches';
import ChannelsList from '@/components/channels-list';
import AdminDashboard from '@/components/admin-dashboard';
import VideoPlayer from '@/components/video-player';
import { Zap, Tv, Shield, Trophy, Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useState } from 'react';

function NavItem({
  view,
  currentView,
  icon,
  label,
  onClick,
  badge,
}: {
  view: ViewType;
  currentView: ViewType;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  badge?: number;
}) {
  const isActive = currentView === view;
  return (
    <button
      onClick={onClick}
      className={`flex flex-col sm:flex-row items-center gap-1 sm:gap-2 px-3 py-2 sm:px-4 sm:py-2 rounded-lg transition-all text-xs sm:text-sm ${
        isActive
          ? 'bg-green-600/20 text-green-400 font-semibold'
          : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
      }`}
    >
      {icon}
      <span>{label}</span>
      {badge !== undefined && badge > 0 && (
        <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4 min-w-[16px]">
          {badge}
        </Badge>
      )}
    </button>
  );
}

function AppHeader() {
  const { currentView, setCurrentView, matches } = useAppStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const liveCount = matches.filter((m) => m.status === 'live').length;

  const navItems = [
    { view: 'live' as ViewType, icon: <Zap className="h-4 w-4" />, label: 'Live', badge: liveCount },
    { view: 'channels' as ViewType, icon: <Tv className="h-4 w-4" />, label: 'Channels' },
    { view: 'admin' as ViewType, icon: <Shield className="h-4 w-4" />, label: 'Admin' },
  ];

  return (
    <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/50">
      <div className="max-w-5xl mx-auto px-4">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
              <Trophy className="h-4 w-4 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold leading-tight">GoalStream</h1>
              <p className="text-[10px] text-muted-foreground leading-tight">Free Football Live</p>
            </div>
          </div>

          {/* Desktop Nav */}
          <nav className="hidden sm:flex items-center gap-1">
            {navItems.map((item) => (
              <NavItem
                key={item.view}
                {...item}
                currentView={currentView}
                onClick={() => setCurrentView(item.view)}
              />
            ))}
          </nav>

          {/* Mobile Menu */}
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild className="sm:hidden">
              <Button variant="ghost" size="icon" className="h-9 w-9">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-64">
              <div className="flex items-center gap-2 mb-6 mt-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                  <Trophy className="h-4 w-4 text-white" />
                </div>
                <h2 className="font-bold">GoalStream</h2>
              </div>
              <nav className="space-y-1">
                {navItems.map((item) => (
                  <NavItem
                    key={item.view}
                    {...item}
                    currentView={currentView}
                    onClick={() => {
                      setCurrentView(item.view);
                      setMobileMenuOpen(false);
                    }}
                  />
                ))}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}

function MobileBottomNav() {
  const { currentView, setCurrentView, matches } = useAppStore();
  const liveCount = matches.filter((m) => m.status === 'live').length;

  const navItems = [
    { view: 'live' as ViewType, icon: <Zap className="h-5 w-5" />, label: 'Live', badge: liveCount },
    { view: 'channels' as ViewType, icon: <Tv className="h-5 w-5" />, label: 'Channels' },
    { view: 'admin' as ViewType, icon: <Shield className="h-5 w-5" />, label: 'Admin' },
  ];

  return (
    <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-background/90 backdrop-blur-xl border-t border-border/50 safe-area-bottom">
      <div className="flex items-center justify-around h-16">
        {navItems.map((item) => {
          const isActive = currentView === item.view;
          return (
            <button
              key={item.view}
              onClick={() => setCurrentView(item.view)}
              className={`flex flex-col items-center gap-0.5 px-4 py-2 relative ${
                isActive ? 'text-green-500' : 'text-muted-foreground'
              }`}
            >
              {item.icon}
              <span className="text-[10px] font-medium">{item.label}</span>
              {item.badge !== undefined && item.badge > 0 && (
                <span className="absolute -top-0.5 right-2 bg-red-500 text-white text-[9px] rounded-full h-4 min-w-[16px] flex items-center justify-center px-1 font-bold">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export default function Home() {
  const { currentView, fetchMatches, fetchChannels } = useAppStore();

  // Initial data fetch
  useEffect(() => {
    fetchMatches();
    fetchChannels();
  }, [fetchMatches, fetchChannels]);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <AppHeader />

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-4 pb-20 sm:pb-4">
        {currentView === 'live' && <LiveMatches />}
        {currentView === 'channels' && <ChannelsList />}
        {currentView === 'admin' && <AdminDashboard />}
      </main>

      {/* Footer */}
      <footer className="hidden sm:block border-t border-border/30 bg-muted/20">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            GoalStream — Free football streaming via IPTV
          </p>
          <p className="text-xs text-muted-foreground">
            Streams sourced from{' '}
            <a
              href="https://github.com/iptv-org/iptv"
              target="_blank"
              rel="noopener noreferrer"
              className="text-green-500 hover:underline"
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
