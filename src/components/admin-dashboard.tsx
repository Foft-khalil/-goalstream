'use client';

import { useEffect, useState } from 'react';
import { useAppStore, FootballMatch } from '@/lib/store';
import { Card, CardContent } from '@/components/ui/card';
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
import { Loader2, Plus, Trash2, Tv, Link as LinkIcon, Shield, Save, Globe, Database, RefreshCw } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface ChannelOption {
  name: string;
  logo: string;
  url: string;
  group: string;
}

type CombinedMatch = {
  id: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  status: string;
  competition: string | null;
  matchDate: string | null;
  streamUrl: string | null;
  channelName: string | null;
  channelLogo: string | null;
  source: 'db' | 'api';
  minute?: number | null;
};

export default function AdminDashboard() {
  const {
    matches,
    channels,
    footballMatches,
    fetchMatches,
    fetchChannels,
    fetchFootballMatches,
    footballLoading,
    isAdmin,
    setIsAdmin,
  } = useAppStore();

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

  // Filter channels for the dropdown
  const channelOptions: ChannelOption[] = channels
    .filter((ch) => ch.url)
    .map((ch) => ({
      name: ch.name,
      logo: ch.logo || '',
      url: ch.url,
      group: ch.group || '',
    }));

  // Combine DB matches and API matches
  const combinedMatches: CombinedMatch[] = [
    // DB matches first
    ...matches.map((m) => ({
      id: m.id,
      homeTeam: m.homeTeam,
      awayTeam: m.awayTeam,
      homeScore: m.homeScore,
      awayScore: m.awayScore,
      status: m.status,
      competition: m.competition,
      matchDate: m.matchDate,
      streamUrl: m.streamUrl,
      channelName: m.channelName,
      channelLogo: m.channelLogo,
      source: 'db' as const,
    })),
    // API matches (only those not already in DB)
    ...footballMatches
      .filter(
        (fm) =>
          !matches.some(
            (m) =>
              m.homeTeam.toLowerCase() === fm.homeTeam.toLowerCase() &&
              m.awayTeam.toLowerCase() === fm.awayTeam.toLowerCase()
          )
      )
      .map((fm) => ({
        id: fm.id,
        homeTeam: fm.homeTeam,
        awayTeam: fm.awayTeam,
        homeScore: fm.homeScore,
        awayScore: fm.awayScore,
        status: fm.status,
        competition: fm.competition,
        matchDate: fm.matchDate,
        streamUrl: fm.streamUrl ?? null,
        channelName: fm.channelName ?? null,
        channelLogo: fm.channelLogo ?? null,
        source: 'api' as const,
        minute: fm.minute,
      })),
  ];

  useEffect(() => {
    fetchMatches();
    fetchChannels();
    fetchFootballMatches();
  }, [fetchMatches, fetchChannels, fetchFootballMatches]);

  // For DB matches: assign stream directly
  const handleAssignStreamToDbMatch = async (matchId: string) => {
    setSaving(true);
    try {
      const streamUrl = customStreamUrl || selectedChannelUrl;
      const channelName = customChannelName || channelOptions.find((c) => c.url === selectedChannelUrl)?.name || '';
      const channelLogo = channelOptions.find((c) => c.url === selectedChannelUrl)?.logo || '';

      if (!streamUrl) {
        toast({ title: 'Erreur', description: 'Veuillez sélectionner une chaîne ou entrer une URL', variant: 'destructive' });
        return;
      }

      const res = await fetch(`/api/matches/${matchId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ streamUrl, channelName, channelLogo }),
      });

      if (!res.ok) throw new Error('Failed to assign stream');

      toast({ title: 'Flux assigné !', description: `${channelName} lié au match` });
      await fetchMatches();
      setAssigningMatchId(null);
      setSelectedChannelUrl('');
      setCustomStreamUrl('');
      setCustomChannelName('');
    } catch (error) {
      toast({ title: 'Erreur', description: 'Échec de l\'assignation du flux', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // For API matches: create a DB match entry first, then assign stream
  const handleAssignStreamToApiMatch = async (match: CombinedMatch) => {
    setSaving(true);
    try {
      const streamUrl = customStreamUrl || selectedChannelUrl;
      const channelName = customChannelName || channelOptions.find((c) => c.url === selectedChannelUrl)?.name || '';
      const channelLogo = channelOptions.find((c) => c.url === selectedChannelUrl)?.logo || '';

      if (!streamUrl) {
        toast({ title: 'Erreur', description: 'Veuillez sélectionner une chaîne ou entrer une URL', variant: 'destructive' });
        return;
      }

      // Create a DB match entry for this API match
      const res = await fetch('/api/matches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          homeTeam: match.homeTeam,
          awayTeam: match.awayTeam,
          competition: match.competition || 'Football',
          matchDate: match.matchDate || new Date().toISOString(),
          status: match.status,
          streamUrl,
          channelName,
          channelLogo,
        }),
      });

      if (!res.ok) throw new Error('Failed to create match');

      toast({ title: 'Flux assigné !', description: `${channelName} lié à ${match.homeTeam} vs ${match.awayTeam}` });
      await fetchMatches();
      await fetchFootballMatches();
      setAssigningMatchId(null);
      setSelectedChannelUrl('');
      setCustomStreamUrl('');
      setCustomChannelName('');
    } catch (error) {
      toast({ title: 'Erreur', description: 'Échec de l\'assignation du flux', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleAssignStream = (match: CombinedMatch) => {
    if (match.source === 'db') {
      return handleAssignStreamToDbMatch(match.id);
    } else {
      return handleAssignStreamToApiMatch(match);
    }
  };

  const handleAddMatch = async () => {
    if (!newMatch.homeTeam || !newMatch.awayTeam || !newMatch.matchDate) {
      toast({ title: 'Erreur', description: 'Veuillez remplir tous les champs requis', variant: 'destructive' });
      return;
    }

    try {
      const res = await fetch('/api/matches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newMatch),
      });

      if (!res.ok) throw new Error('Failed to create match');

      toast({ title: 'Match créé !', description: `${newMatch.homeTeam} vs ${newMatch.awayTeam}` });
      await fetchMatches();
      setShowAddMatch(false);
      setNewMatch({ homeTeam: '', awayTeam: '', competition: '', matchDate: '', status: 'upcoming' });
    } catch (error) {
      toast({ title: 'Erreur', description: 'Échec de la création du match', variant: 'destructive' });
    }
  };

  const handleDeleteMatch = async (matchId: string) => {
    try {
      const res = await fetch(`/api/matches/${matchId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete match');
      toast({ title: 'Match supprimé' });
      await fetchMatches();
    } catch (error) {
      toast({ title: 'Erreur', description: 'Échec de la suppression', variant: 'destructive' });
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
      toast({ title: 'Flux retiré' });
      await fetchMatches();
      await fetchFootballMatches();
    } catch (error) {
      toast({ title: 'Erreur', description: 'Échec du retrait du flux', variant: 'destructive' });
    }
  };

  // Admin gate
  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
        <Shield className="h-16 w-16 text-muted-foreground/30 mb-4" />
        <h3 className="text-lg font-semibold mb-2">Accès admin requis</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Entrez le mot de passe admin pour accéder au tableau de bord
        </p>
        <div className="flex gap-2 w-full max-w-xs">
          <Input
            type="password"
            placeholder="Mot de passe admin"
            onKeyDown={async (e) => {
              if (e.key === 'Enter') {
                const target = e.target as HTMLInputElement;
                // Verify password server-side instead of client-side
                try {
                  const res = await fetch('/api/admin-auth', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ password: target.value }),
                  });
                  if (res.ok) {
                    setIsAdmin(true);
                  } else {
                    toast({ title: 'Mauvais mot de passe', variant: 'destructive' });
                  }
                } catch {
                  toast({ title: 'Erreur de connexion', variant: 'destructive' });
                }
              }
            }}
            className="bg-card/80 border-border/50"
          />
          <Button
            onClick={async () => {
              // Server-side auth check
              try {
                const res = await fetch('/api/admin-auth', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ password: 'check' }),
                });
                if (res.ok) {
                  setIsAdmin(true);
                }
              } catch {
                // ignore
              }
            }}
            variant="outline"
            className="shrink-0"
          >
            Entrer
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">Gestion des matchs</h2>
          <p className="text-xs text-muted-foreground">
            {combinedMatches.length} match{combinedMatches.length !== 1 ? 'es' : ''} au total
            {' '}({matches.length} BD, {footballMatches.length} API)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchFootballMatches()}
            disabled={footballLoading}
            className="gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${footballLoading ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
          <Dialog open={showAddMatch} onOpenChange={setShowAddMatch}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5 bg-green-600 hover:bg-green-700">
                <Plus className="h-4 w-4" />
                Ajouter
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Ajouter un match</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 pt-2">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Équipe domicile *</Label>
                    <Input
                      value={newMatch.homeTeam}
                      onChange={(e) => setNewMatch({ ...newMatch, homeTeam: e.target.value })}
                      placeholder="ex: PSG"
                      className="bg-card/80"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Équipe extérieur *</Label>
                    <Input
                      value={newMatch.awayTeam}
                      onChange={(e) => setNewMatch({ ...newMatch, awayTeam: e.target.value })}
                      placeholder="ex: Real Madrid"
                      className="bg-card/80"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Compétition</Label>
                  <Input
                    value={newMatch.competition}
                    onChange={(e) => setNewMatch({ ...newMatch, competition: e.target.value })}
                    placeholder="ex: Champions League"
                    className="bg-card/80"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Date et heure *</Label>
                    <Input
                      type="datetime-local"
                      value={newMatch.matchDate}
                      onChange={(e) => setNewMatch({ ...newMatch, matchDate: e.target.value })}
                      className="bg-card/80"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Statut</Label>
                    <Select
                      value={newMatch.status}
                      onValueChange={(val) => setNewMatch({ ...newMatch, status: val })}
                    >
                      <SelectTrigger className="bg-card/80">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="upcoming">À venir</SelectItem>
                        <SelectItem value="live">En direct</SelectItem>
                        <SelectItem value="finished">Terminé</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button onClick={handleAddMatch} className="w-full bg-green-600 hover:bg-green-700">
                  Créer le match
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Matches Table */}
      <Card className="border-border/50">
        <CardContent className="p-0">
          <div className="overflow-x-auto max-h-[70vh] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Match</TableHead>
                  <TableHead className="text-xs">Statut</TableHead>
                  <TableHead className="text-xs">Source</TableHead>
                  <TableHead className="text-xs">Flux</TableHead>
                  <TableHead className="text-xs w-[120px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {combinedMatches.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground text-sm">
                      Aucun match trouvé. Cliquez sur &quot;Actualiser&quot; pour charger les matchs du jour.
                    </TableCell>
                  </TableRow>
                ) : (
                  combinedMatches.map((match) => (
                    <TableRow key={`${match.source}-${match.id}`}>
                      <TableCell>
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">
                            {match.homeTeam} vs {match.awayTeam}
                          </p>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">
                              {match.competition || 'Football'}
                            </span>
                            {(match.homeScore !== null || match.awayScore !== null) && (
                              <span className="text-xs font-semibold tabular-nums">
                                {match.homeScore ?? 0}-{match.awayScore ?? 0}
                              </span>
                            )}
                            {match.minute != null && (
                              <span className="text-[10px] text-red-400 font-medium">
                                {match.minute}&apos;
                              </span>
                            )}
                          </div>
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
                          {match.status === 'live' ? 'DIRECT' : match.status === 'finished' ? 'TERMINÉ' : 'À VENIR'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {match.source === 'api' ? (
                            <>
                              <Globe className="h-3 w-3 text-blue-400" />
                              <span className="text-[10px] text-blue-400">API</span>
                            </>
                          ) : (
                            <>
                              <Database className="h-3 w-3 text-amber-400" />
                              <span className="text-[10px] text-amber-400">BD</span>
                            </>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {match.streamUrl ? (
                          <div className="flex items-center gap-1.5">
                            <Tv className="h-3 w-3 text-green-500 shrink-0" />
                            <span className="text-xs truncate max-w-[100px]">
                              {match.channelName || 'Flux personnalisé'}
                            </span>
                            {match.source === 'db' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5 shrink-0"
                                onClick={() => handleRemoveStream(match.id)}
                              >
                                <Trash2 className="h-3 w-3 text-muted-foreground" />
                              </Button>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Aucun flux</span>
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
                                assigningMatchId === `${match.source}-${match.id}` ? null : `${match.source}-${match.id}`
                              );
                              setSelectedChannelUrl('');
                              setCustomStreamUrl('');
                              setCustomChannelName('');
                            }}
                          >
                            <LinkIcon className="h-3 w-3" />
                            Flux
                          </Button>
                          {match.source === 'db' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => handleDeleteMatch(match.id)}
                            >
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </Button>
                          )}
                        </div>

                        {/* Assign Stream Panel */}
                        {assigningMatchId === `${match.source}-${match.id}` && (
                          <div className="mt-2 p-2 bg-muted/30 rounded-lg space-y-2">
                            <Label className="text-[10px] text-muted-foreground">
                              Sélectionner une chaîne IPTV
                            </Label>
                            <Select
                              value={selectedChannelUrl}
                              onValueChange={setSelectedChannelUrl}
                            >
                              <SelectTrigger className="h-8 text-xs bg-background">
                                <SelectValue placeholder="Choisir une chaîne..." />
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

                            <div className="text-center text-xs text-muted-foreground">— ou —</div>

                            <div className="space-y-1.5">
                              <Label className="text-[10px] text-muted-foreground">
                                URL m3u8 personnalisée
                              </Label>
                              <Input
                                placeholder="https://example.com/stream.m3u8"
                                value={customStreamUrl}
                                onChange={(e) => setCustomStreamUrl(e.target.value)}
                                className="h-8 text-xs bg-background"
                              />
                              <Input
                                placeholder="Nom de la chaîne (optionnel)"
                                value={customChannelName}
                                onChange={(e) => setCustomChannelName(e.target.value)}
                                className="h-8 text-xs bg-background"
                              />
                            </div>

                            <Button
                              size="sm"
                              className="w-full h-8 gap-1 bg-green-600 hover:bg-green-700"
                              onClick={() => handleAssignStream(match)}
                              disabled={saving}
                            >
                              {saving ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Save className="h-3 w-3" />
                              )}
                              {saving ? 'Enregistrement...' : 'Assigner le flux'}
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
