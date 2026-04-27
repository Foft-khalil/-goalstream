'use client';

import { useEffect, useState } from 'react';
import { useAppStore } from '@/lib/store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Loader2, Plus, Trash2, Tv, Link as LinkIcon, Shield, Save } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface ChannelOption {
  name: string;
  logo: string;
  url: string;
  group: string;
}

export default function AdminDashboard() {
  const { matches, channels, fetchMatches, fetchChannels, isAdmin, setIsAdmin } = useAppStore();
  const [assigningMatchId, setAssigningMatchId] = useState<string | null>(null);
  const [selectedChannelUrl, setSelectedChannelUrl] = useState('');
  const [customStreamUrl, setCustomStreamUrl] = useState('');
  const [customChannelName, setCustomChannelName] = useState('');
  const [saving, setSaving] = useState(false);
  const [showAddMatch, setShowAddMatch] = useState(false);
  const [newMatch, setNewMatch] = useState({
    homeTeam: '',
    awayTeam: '',
    competition: '',
    matchDate: '',
    status: 'upcoming',
  });

  // Filter channels for the dropdown - show sport-related ones
  const channelOptions: ChannelOption[] = channels
    .filter((ch) => ch.url)
    .map((ch) => ({
      name: ch.name,
      logo: ch.logo || '',
      url: ch.url,
      group: ch.group || '',
    }));

  useEffect(() => {
    fetchMatches();
    fetchChannels();
  }, [fetchMatches, fetchChannels]);

  const handleAssignStream = async (matchId: string) => {
    setSaving(true);
    try {
      const streamUrl = customStreamUrl || selectedChannelUrl;
      const channelName = customChannelName || channelOptions.find((c) => c.url === selectedChannelUrl)?.name || '';
      const channelLogo = channelOptions.find((c) => c.url === selectedChannelUrl)?.logo || '';

      if (!streamUrl) {
        toast({ title: 'Error', description: 'Please select a channel or enter a custom URL', variant: 'destructive' });
        return;
      }

      const res = await fetch(`/api/matches/${matchId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ streamUrl, channelName, channelLogo }),
      });

      if (!res.ok) throw new Error('Failed to assign stream');

      toast({ title: 'Stream assigned!', description: `${channelName} linked to match` });
      await fetchMatches();
      setAssigningMatchId(null);
      setSelectedChannelUrl('');
      setCustomStreamUrl('');
      setCustomChannelName('');
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to assign stream', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleAddMatch = async () => {
    if (!newMatch.homeTeam || !newMatch.awayTeam || !newMatch.matchDate) {
      toast({ title: 'Error', description: 'Please fill in all required fields', variant: 'destructive' });
      return;
    }

    try {
      const res = await fetch('/api/matches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newMatch),
      });

      if (!res.ok) throw new Error('Failed to create match');

      toast({ title: 'Match created!', description: `${newMatch.homeTeam} vs ${newMatch.awayTeam}` });
      await fetchMatches();
      setShowAddMatch(false);
      setNewMatch({ homeTeam: '', awayTeam: '', competition: '', matchDate: '', status: 'upcoming' });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to create match', variant: 'destructive' });
    }
  };

  const handleDeleteMatch = async (matchId: string) => {
    try {
      const res = await fetch(`/api/matches/${matchId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete match');
      toast({ title: 'Match deleted' });
      await fetchMatches();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to delete match', variant: 'destructive' });
    }
  };

  const handleRemoveStream = async (matchId: string) => {
    try {
      const res = await fetch(`/api/matches/${matchId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ streamUrl: null, channelName: null, channelLogo: null }),
      });
      if (!res.ok) throw new Error('Failed to remove stream');
      toast({ title: 'Stream removed' });
      await fetchMatches();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to remove stream', variant: 'destructive' });
    }
  };

  // Admin gate
  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
        <Shield className="h-16 w-16 text-muted-foreground/30 mb-4" />
        <h3 className="text-lg font-semibold mb-2">Admin Access Required</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Enter the admin password to access the dashboard
        </p>
        <div className="flex gap-2 w-full max-w-xs">
          <Input
            type="password"
            placeholder="Admin password"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const target = e.target as HTMLInputElement;
                if (target.value === 'admin123') {
                  setIsAdmin(true);
                } else {
                  toast({ title: 'Wrong password', variant: 'destructive' });
                }
              }
            }}
            className="bg-card/80 border-border/50"
          />
          <Button
            onClick={() => setIsAdmin(true)}
            variant="outline"
            className="shrink-0"
          >
            Enter
          </Button>
        </div>
        <p className="text-xs text-muted-foreground/50 mt-2">Hint: admin123</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">Match Management</h2>
          <p className="text-xs text-muted-foreground">
            {matches.length} match{matches.length !== 1 ? 'es' : ''} in database
          </p>
        </div>
        <Dialog open={showAddMatch} onOpenChange={setShowAddMatch}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5 bg-green-600 hover:bg-green-700">
              <Plus className="h-4 w-4" />
              Add Match
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Match</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Home Team *</Label>
                  <Input
                    value={newMatch.homeTeam}
                    onChange={(e) => setNewMatch({ ...newMatch, homeTeam: e.target.value })}
                    placeholder="e.g. PSG"
                    className="bg-card/80"
                  />
                </div>
                <div>
                  <Label className="text-xs">Away Team *</Label>
                  <Input
                    value={newMatch.awayTeam}
                    onChange={(e) => setNewMatch({ ...newMatch, awayTeam: e.target.value })}
                    placeholder="e.g. Real Madrid"
                    className="bg-card/80"
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs">Competition</Label>
                <Input
                  value={newMatch.competition}
                  onChange={(e) => setNewMatch({ ...newMatch, competition: e.target.value })}
                  placeholder="e.g. Champions League"
                  className="bg-card/80"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Date & Time *</Label>
                  <Input
                    type="datetime-local"
                    value={newMatch.matchDate}
                    onChange={(e) => setNewMatch({ ...newMatch, matchDate: e.target.value })}
                    className="bg-card/80"
                  />
                </div>
                <div>
                  <Label className="text-xs">Status</Label>
                  <Select
                    value={newMatch.status}
                    onValueChange={(val) => setNewMatch({ ...newMatch, status: val })}
                  >
                    <SelectTrigger className="bg-card/80">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="upcoming">Upcoming</SelectItem>
                      <SelectItem value="live">Live</SelectItem>
                      <SelectItem value="finished">Finished</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={handleAddMatch} className="w-full bg-green-600 hover:bg-green-700">
                Create Match
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Matches Table */}
      <Card className="border-border/50">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Match</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs">Stream</TableHead>
                  <TableHead className="text-xs w-[120px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {matches.map((match) => (
                  <TableRow key={match.id}>
                    <TableCell>
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">
                          {match.homeTeam} vs {match.awayTeam}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {match.competition || 'No competition'} •{' '}
                          {new Date(match.matchDate).toLocaleDateString()}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          match.status === 'live'
                            ? 'destructive'
                            : match.status === 'finished'
                              ? 'outline'
                              : 'secondary'
                        }
                        className="text-[10px]"
                      >
                        {match.status.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {match.streamUrl ? (
                        <div className="flex items-center gap-1.5">
                          <Tv className="h-3 w-3 text-green-500 shrink-0" />
                          <span className="text-xs truncate max-w-[120px]">
                            {match.channelName || 'Custom Stream'}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 shrink-0"
                            onClick={() => handleRemoveStream(match.id)}
                          >
                            <Trash2 className="h-3 w-3 text-muted-foreground" />
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">No stream</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-[10px] gap-1"
                          onClick={() => {
                            setAssigningMatchId(
                              assigningMatchId === match.id ? null : match.id
                            );
                            setSelectedChannelUrl('');
                            setCustomStreamUrl('');
                            setCustomChannelName('');
                          }}
                        >
                          <LinkIcon className="h-3 w-3" />
                          Assign
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleDeleteMatch(match.id)}
                        >
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </div>

                      {/* Assign Stream Panel */}
                      {assigningMatchId === match.id && (
                        <div className="mt-2 p-2 bg-muted/30 rounded-lg space-y-2">
                          <Label className="text-[10px] text-muted-foreground">
                            Select IPTV Channel
                          </Label>
                          <Select
                            value={selectedChannelUrl}
                            onValueChange={setSelectedChannelUrl}
                          >
                            <SelectTrigger className="h-8 text-xs bg-background">
                              <SelectValue placeholder="Choose a channel..." />
                            </SelectTrigger>
                            <SelectContent className="max-h-[200px]">
                              {channelOptions.slice(0, 50).map((ch, idx) => (
                                <SelectItem key={`${ch.name}-${idx}`} value={ch.url}>
                                  <div className="flex items-center gap-2">
                                    <span className="truncate">{ch.name}</span>
                                    <span className="text-muted-foreground text-[10px]">
                                      ({ch.group})
                                    </span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          <div className="text-center text-xs text-muted-foreground">— or —</div>

                          <div className="space-y-1.5">
                            <Label className="text-[10px] text-muted-foreground">
                              Custom m3u8 URL
                            </Label>
                            <Input
                              placeholder="https://example.com/stream.m3u8"
                              value={customStreamUrl}
                              onChange={(e) => setCustomStreamUrl(e.target.value)}
                              className="h-8 text-xs bg-background"
                            />
                            <Input
                              placeholder="Channel name (optional)"
                              value={customChannelName}
                              onChange={(e) => setCustomChannelName(e.target.value)}
                              className="h-8 text-xs bg-background"
                            />
                          </div>

                          <Button
                            size="sm"
                            className="w-full h-8 gap-1 bg-green-600 hover:bg-green-700"
                            onClick={() => handleAssignStream(match.id)}
                            disabled={saving}
                          >
                            {saving ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Save className="h-3 w-3" />
                            )}
                            {saving ? 'Saving...' : 'Assign Stream'}
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
