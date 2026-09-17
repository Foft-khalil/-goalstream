export type Language = 'fr' | 'en' | 'ar' | 'es' | 'pt';

export interface Translations {
  nav: {
    matches: string;
    basketball: string;
    basket: string;
    favorites: string;
    channels: string;
    standings: string;
  };
  common: {
    liveSport: string;
    today: string;
    tomorrow: string;
    live: string;
    finished: string;
    upcoming: string;
    loading: string;
    retry: string;
    offline: string;
    offlineMode: string;
    install: string;
    installApp: string;
    search: string;
    update: string;
    showMore: string;
    showLess: string;
    all: string;
    more: string;
    confirm: string;
    cancel: string;
    clearAll: string;
    vs: string;
    allCompetitions: string;
    lightMode: string;
    darkMode: string;
    nextMatch: string;
    nextMatchIn: string;
    noMatchesNow: string;
    checkBackLater: string;
    loadingMatches: string;
    otherMatches: string;
    yesterday: string;
    pickDate: string;
    noMatchesDay: string;
    showFinishedMatches: string;
    hideFinishedMatches: string;
    liveNow: string;
    todayUpcoming: string;
    dayMatches: string;
    finishedMatches: string;
    upcomingMatches: string;
  };
  match: {
    min: string;
    ht: string;
    firstHalf: string;
    secondHalf: string;
    extraTime: string;
    watchLive: string;
    watch: string;
    seeSummary: string;
    followMatch: string;
    follow: string;
    finished: string;
    startsIn: string;
    searching: string;
    noChannelFound: string;
    noChannelRetry: string;
    searchTooLong: string;
    liveBroadcast: string;
    broadcastOn: string;
    liveStreamAvailable: string;
    friendly: string;
    share: string;
    copied: string;
    highlights: string;
    externalSources: string;
  };
  basketball: {
    q1: string;
    q2: string;
    q3: string;
    q4: string;
    ot: string;
    firstHalf: string;
    secondHalf: string;
  };
  football: {
    halftime: string;
    secondHalf: string;
  };
  standings: {
    title: string;
    championships: string;
    clubCups: string;
    nationalTeams: string;
    women: string;
    basketball: string;
    fifaRanking: string;
    worldCup: string;
    team: string;
    played: string;
    won: string;
    drawn: string;
    lost: string;
    points: string;
    teams: string;
    clickTeam: string;
    championsLeague: string;
    europaConf: string;
    relegation: string;
    qualified: string;
    playoffs: string;
    playIn: string;
    eliminated: string;
    top10: string;
    top20: string;
    wins: string;
    losses: string;
    winPct: string;
    gamesBehind: string;
    loadingStandings: string;
    fetchingData: string;
    updating: string;
    loadingLeague: string;
    loadError: string;
    schedule: string;
    qualifiedTeams: string;
    showNextTeams: string;
    otherTeams: string;
    barrages: string;
    dataUnavailable: string;
    competitionPaused: string;
    groupsNotFormed: string;
    worldCupMessage: string;
    copaAmericaMessage: string;
    asianCupMessage: string;
    goldCupMessage: string;
    womenFriendlyMessage: string;
    ranking: string;
    topScorers: string;
    goals: string;
    assists: string;
    player: string;
    matchesPlayed: string;
    mlb: string;
    nhl: string;
    cricket: string;
    motorSport: string;
    mma: string;
    boxing: string;
    motorsports: string;
    other: string;
    rugby: string;
    otLosses: string;
    ties: string;
    drivers: string;
    constructors: string;
    runsFor: string;
    runsAgainst: string;
    goalsFor: string;
    goalsAgainst: string;
    winPctShort: string;
    streak: string;
  };
  teamDetail: {
    info: string;
    roster: string;
    schedule: string;
    stats: string;
    stadium: string;
    coach: string;
    founded: string;
    abbreviation: string;
    seasonStats: string;
    matchesPlayed: string;
    victories: string;
    draws: string;
    defeats: string;
    goalsScored: string;
    goalsConceded: string;
    goalDiff: string;
    avgGoals: string;
    pointsScored: string;
    pointsConceded: string;
    pointDiff: string;
    avgPoints: string;
    winPct: string;
    form: string;
    upcoming: string;
    finished: string;
    live: string;
    home: string;
    away: string;
    otherMatches: string;
    noInfo: string;
    noInfoHint: string;
    noRoster: string;
    noRosterHint: string;
    noSchedule: string;
    noScheduleHint: string;
    loading: string;
    loadError: string;
    retry: string;
    addFavorite: string;
    removeFavorite: string;
    goalkeepers: string;
    defenders: string;
    midfielders: string;
    attackers: string;
    pointGuard: string;
    shootingGuard: string;
    smallForward: string;
    powerForward: string;
    center: string;
    yearsOld: string;
    pitcher: string;
    catcher: string;
    baseman: string;
    outfielder: string;
    defenseman: string;
    forward: string;
    goaltender: string;
    quarterback: string;
    runningBack: string;
    wideReceiver: string;
    driver: string;
    fighter: string;
    weightClass: string;
    champion: string;
  };
  favorites: {
    title: string;
    myFavorites: string;
    noFavorites: string;
    addFavoritesHint: string;
    addFavorites: string;
    removeFavorites: string;
    favoriteTeams: string;
    favoriteChannels: string;
    teams: string;
    channels: string;
    noMatches: string;
    noMatchesDay: string;
    comeBackLater: string;
    savedLocally: string;
    tapHeart: string;
    quickAccess: string;
  };
  search: {
    title: string;
    placeholder: string;
    noResults: string;
    matches: string;
    channels: string;
    competitions: string;
    shortcut: string;
  };
  channels: {
    title: string;
    searchPlaceholder: string;
    onlineOnly: string;
    check: string;
    checking: string;
    allCountries: string;
    online: string;
    offline: string;
    untested: string;
    noChannels: string;
    tryDisableFilter: string;
    adjustFilters: string;
    showAllChannels: string;
    loadMore: string;
    channelsFound: string;
    direct: string;
  };
  notifications: {
    enabled: string;
    enable: string;
    settings: string;
    startsIn: string;
    goal: string;
    title: string;
    noNotifications: string;
    noNotificationsDesc: string;
    markAllRead: string;
    clearAll: string;
    enableNotifs: string;
    openSettings: string;
    justNow: string;
    minutesAgo: string;
    hoursAgo: string;
    settingsTitle: string;
    settingsDesc: string;
    matchStart: string;
    matchStartDesc: string;
    goalsPoints: string;
    goalsPointsDesc: string;
    favoriteTeams: string;
    favoriteTeamsDesc: string;
  };
  offline: {
    message: string;
  };
  errors: {
    cannotLoad: string;
    loadFailed: string;
    timeout: string;
    invalidResponse: string;
    updateFailed: string;
    serverError: string;
    boundaryTitle: string;
    boundaryMessage: string;
  };
  tracker: {
    timeline: string;
    timelineMatch: string;
    statistics: string;
    keyPlayers: string;
    lineups: string;
    startingXI: string;
    substitutes: string;
    formation: string;
    noLineups: string;
    loadingLineups: string;
    posGK: string;
    posDEF: string;
    posMID: string;
    posFWD: string;
    loadingEvents: string;
    loadingStats: string;
    loadingPlayers: string;
    statsUnavailable: string;
    playersUnavailable: string;
    goal: string;
    yellowCard: string;
    redCard: string;
    substitution: string;
    start: string;
    end: string;
    assist: string;
    spectators: string;
    referee: string;
    summary: string;
    winsMatch: string;
    draw: string;
    halftime: string;
    eventsWillAppear: string;
    liveAtKickoff: string;
    noEvents: string;
    autoRefresh: string;
    shots: string;
    accuratePasses: string;
    saves: string;
    cantLoadEvents: string;
    serverError: string;
    possession: string;
  };
  player: {
    streamUnavailable: string;
    playbackError: string;
    streamUnavailableShort: string;
    hlsNotSupported: string;
    otherChannels: string;
    loadingStream: string;
    autoNextChannel: string;
    channelUnavailable: string;
    iptvUnstable: string;
    retry: string;
    otherChannelsLabel: string;
    back: string;
    live: string;
    liveStream: string;
    resolvingStream: string;
    iframeError: string;
    iframeLoadTimeout: string;
    tryDirectStream: string;
    watchElsewhere: string;
  };
  stream: {
    watchLive: string;
    streamingSites: string;
    directStreams: string;
    searchingStreams: string;
    sportStreamDesc: string;
    rojaDirectaDesc: string;
    youtubeDesc: string;
    disclaimer: string;
    hesgoalDesc: string;
    hesgoalLive: string;
    resolvingStream: string;
    directPlayback: string;
    embedPlayback: string;
  };
  footer: {
    description: string;
    streamsFrom: string;
    privacyPolicy: string;
  };
  privacy: {
    title: string;
    lastUpdated: string;
    introduction: string;
    introductionContent: string;
    dataCollection: string;
    dataCollectionContent: string;
    automaticData: string;
    automaticDataContent: string;
    notifications: string;
    notificationsContent: string;
    contact: string;
    contactContent: string;
    contactEmail: string;
  };
  dates: {
    today: string;
    tomorrow: string;
    dayAfter: string;
    weekdaysShort: string[];
    weekdaysLong: string[];
    monthsLong: string[];
  };
}

export const translations: Record<Language, Translations> = {
  fr: {
    nav: {
      matches: 'Matchs',
      basketball: 'Basketball',
      basket: 'Basket',
      favorites: 'Favoris',
      channels: 'Chaînes',
      standings: 'Classement',
    },
    common: {
      liveSport: 'Sport en direct',
      today: "Aujourd'hui",
      tomorrow: 'Demain',
      live: 'En Direct',
      finished: 'Terminé',
      upcoming: 'À venir',
      loading: 'Chargement',
      retry: 'Réessayer',
      offline: 'Hors ligne',
      offlineMode: 'Mode hors ligne',
      install: 'Installer',
      installApp: "Installer l'application",
      search: 'Recherche',
      update: 'Maj',
      showMore: 'Voir plus',
      showLess: 'Voir moins',
      all: 'Tout',
      more: 'plus',
      confirm: 'Confirmer',
      cancel: 'Annuler',
      clearAll: 'Tout effacer',
      vs: 'VS',
      allCompetitions: 'Toutes les compétitions',
      lightMode: 'Mode clair',
      darkMode: 'Mode sombre',
      nextMatch: 'Prochain match',
      nextMatchIn: 'Prochain match dans',
      noMatchesNow: 'Aucun match en cours',
      checkBackLater: 'Revenez plus tard pour les prochains matchs !',
      loadingMatches: 'Chargement des matchs...',
      otherMatches: 'autres matchs',
      yesterday: 'Hier',
      pickDate: 'Choisir une date',
      noMatchesDay: 'Aucun match programmé ce jour',
      showFinishedMatches: 'Afficher les matchs terminés',
      hideFinishedMatches: 'Masquer les matchs terminés',
      liveNow: 'En direct maintenant',
      todayUpcoming: "À venir aujourd'hui",
      dayMatches: 'Matchs du jour',
      finishedMatches: 'Matchs terminés',
      upcomingMatches: 'Matchs à venir',
    },
    match: {
      min: 'min',
      ht: 'MT',
      firstHalf: '1ère MT',
      secondHalf: '2ème MT',
      extraTime: 'PROL',
      watchLive: 'Regarder en direct',
      watch: 'Regarder',
      seeSummary: 'Voir le résumé',
      followMatch: 'Suivre le match',
      follow: 'Suivre',
      finished: 'Match terminé',
      startsIn: 'Commence dans {0} min',
      searching: 'Recherche...',
      noChannelFound: 'Aucune chaîne trouvée pour ce match',
      noChannelRetry: 'Aucune chaîne trouvée — réessayez',
      searchTooLong: 'Recherche trop longue — réessayez',
      liveBroadcast: 'Diffusion en direct',
      broadcastOn: 'Diffusé sur',
      liveStreamAvailable: 'Diffusion en direct disponible ({0} flux)',
      friendly: 'Amical',
      share: 'Partager',
      copied: 'Copié !',
      highlights: 'Résumé vidéo',
      externalSources: 'Sources externes',
    },
    basketball: {
      q1: 'Q1',
      q2: 'Q2',
      q3: 'Q3',
      q4: 'Q4',
      ot: 'OT',
      firstHalf: '1ère MT',
      secondHalf: '2ème MT',
    },
    football: {
      halftime: 'Mi-temps',
      secondHalf: '2ème mi-temps',
    },
    standings: {
      title: 'Classements',
      championships: 'Championnats',
      clubCups: 'Coupes Clubs',
      nationalTeams: 'Éq. Nationales',
      women: 'Féminines',
      basketball: 'Basketball',
      fifaRanking: 'Classement FIFA',
      worldCup: 'Coupe du Monde',
      team: 'Équipe',
      played: 'J',
      won: 'V',
      drawn: 'N',
      lost: 'D',
      points: 'Pts',
      teams: 'équipes',
      clickTeam: 'Cliquez sur une équipe',
      championsLeague: 'Ligue des Champions',
      europaConf: 'Europa / Conf.',
      relegation: 'Relégation',
      qualified: 'Qualifié tour suivant',
      playoffs: 'Playoffs',
      playIn: 'Play-In',
      eliminated: 'Éliminé',
      top10: 'Top 10',
      top20: 'Top 20',
      wins: 'V',
      losses: 'D',
      winPct: 'PCT',
      gamesBehind: 'GB',
      loadingStandings: 'Chargement des classements',
      fetchingData: 'Récupération des données...',
      updating: 'Mise à jour en cours...',
      loadingLeague: 'Chargement en cours...',
      loadError: 'Erreur lors du chargement de {0}',
      schedule: 'Calendrier',
      qualifiedTeams: 'Équipes qualifiées',
      showNextTeams: 'Voir les {0} équipes suivantes',
      otherTeams: 'Voir les {0} autres équipes',
      barrages: 'Barrages',
      dataUnavailable: 'Les données ne sont pas encore disponibles pour cette compétition. Réessayez dans quelques minutes.',
      competitionPaused: 'Les données de {0} ne sont pas disponibles actuellement. La compétition est peut-être en pause entre les phases.',
      groupsNotFormed: 'Les groupes ne sont pas encore formés pour la prochaine édition.',
      worldCupMessage: 'La Coupe du Monde FIFA 2026 se déroulera du 11 juin au 19 juillet aux États-Unis, au Canada et au Mexique. Consultez les matchs pour suivre les résultats en direct.',
      copaAmericaMessage: 'La prochaine Copa América aura lieu en 2028. Les groupes seront communiqués ultérieurement.',
      asianCupMessage: "La prochaine Coupe d'Asie aura lieu en 2027 en Arabie Saoudite. Les qualifications sont en cours.",
      goldCupMessage: 'La prochaine Gold Cup aura lieu en 2027. Les détails seront communiqués ultérieurement.',
      womenFriendlyMessage: "Les matchs amicaux n'ont pas de classement. Consultez les résultats dans l'onglet Matchs.",
      ranking: 'classement',
      topScorers: 'Meilleurs buteurs',
      goals: 'Buts',
      assists: 'Passes D.',
      player: 'Joueur',
      matchesPlayed: 'MJ',
      mlb: 'MLB ⚾',
      nhl: 'NHL 🏒',
      cricket: 'Cricket 🏏',
      motorSport: 'Sport Auto 🏎️',
      mma: 'MMA 🥊',
      boxing: 'Boxe 🥊',
      motorsports: 'Motorsports 🏁',
      other: 'Autres 🏈',
      rugby: 'Rugby 🏉',
      otLosses: 'OTL',
      ties: 'N',
      drivers: 'Pilotes',
      constructors: 'Constructeurs',
      runsFor: 'RC',
      runsAgainst: 'RA',
      goalsFor: 'BP',
      goalsAgainst: 'BC',
      winPctShort: 'PCT',
      streak: 'Série',
    },
    teamDetail: {
      info: 'Infos',
      roster: 'Effectif',
      schedule: 'Calendrier',
      stats: 'Statistiques',
      stadium: 'Stade',
      coach: 'Entraineur',
      founded: 'Fondé',
      abbreviation: 'Abréviation',
      seasonStats: 'Statistiques de saison',
      matchesPlayed: 'Matchs joués',
      victories: 'Victoires',
      draws: 'Nuls',
      defeats: 'Défaites',
      goalsScored: 'Buts marqués',
      goalsConceded: 'Buts encaissés',
      goalDiff: 'Diff. de buts',
      avgGoals: 'Moy. buts/match',
      pointsScored: 'Points marqués',
      pointsConceded: 'Points encaissés',
      pointDiff: 'Diff. de points',
      avgPoints: 'Moy. points/match',
      winPct: '% Victoires',
      form: 'Forme',
      upcoming: 'À venir',
      finished: 'Terminé',
      live: 'En direct',
      home: 'DOM',
      away: 'EXT',
      otherMatches: 'autres matchs',
      noInfo: 'Informations limitées',
      noInfoHint: 'Les données détaillées seront disponibles prochainement',
      noRoster: 'Effectif non disponible',
      noRosterHint: "L'effectif sera annoncé prochainement",
      noSchedule: 'Calendrier non disponible',
      noScheduleHint: 'Les matchs seront programmés prochainement',
      loading: 'Chargement des données...',
      loadError: 'Échec du chargement',
      retry: 'Réessayer',
      addFavorite: 'Ajouter aux favoris',
      removeFavorite: 'Retirer des favoris',
      goalkeepers: 'Gardiens',
      defenders: 'Défenseurs',
      midfielders: 'Milieux',
      attackers: 'Attaquants',
      pointGuard: 'Meneur',
      shootingGuard: 'Arrière',
      smallForward: 'Ailier',
      powerForward: 'Ailier fort',
      center: 'Pivot',
      yearsOld: 'ans',
      pitcher: 'Lanceur',
      catcher: 'Receveur',
      baseman: 'Base',
      outfielder: 'Voltigeur',
      defenseman: 'Défenseur',
      forward: 'Attaquant',
      goaltender: 'Gardien',
      quarterback: 'Quarterback',
      runningBack: 'Coureur',
      wideReceiver: 'Receveur',
      driver: 'Pilote',
      fighter: 'Combattant',
      weightClass: 'Catégorie',
      champion: 'Champion',
    },
    favorites: {
      title: 'Favoris',
      myFavorites: 'Mes Favoris',
      noFavorites: 'Aucun favori',
      addFavoritesHint: "Ajoutez vos équipes et chaînes préférées en appuyant sur l'icône ❤️ pour un accès rapide",
      addFavorites: 'Ajouter aux favoris',
      removeFavorites: 'Retirer des favoris',
      favoriteTeams: 'Équipes favorites',
      favoriteChannels: 'Chaînes favorites',
      teams: 'équipe',
      channels: 'chaîne',
      noMatches: 'Aucun match prévu pour vos équipes sur les 3 prochains jours',
      noMatchesDay: 'Aucun match prévu ce jour',
      comeBackLater: 'Revenez plus tard !',
      savedLocally: 'Vos favoris sont sauvegardés localement sur votre appareil',
      tapHeart: 'Appuyez sur ❤️',
      quickAccess: 'Accès rapide',
    },
    search: {
      title: 'Recherche globale',
      placeholder: 'Rechercher matchs, chaînes, compétitions...',
      noResults: 'Aucun résultat trouvé',
      matches: 'Matchs',
      channels: 'Chaînes',
      competitions: 'Compétitions',
      shortcut: 'Ctrl+K',
    },
    channels: {
      title: 'Chaînes',
      searchPlaceholder: 'Rechercher une chaîne...',
      onlineOnly: 'En ligne uniquement',
      check: 'Tester',
      checking: 'Vérification...',
      allCountries: 'Tous les pays',
      online: 'en ligne',
      offline: 'hors ligne',
      untested: 'non testé',
      noChannels: 'Aucune chaîne trouvée',
      tryDisableFilter: 'Essayez de désactiver le filtre "En ligne uniquement"',
      adjustFilters: 'Ajustez votre recherche ou vos filtres',
      showAllChannels: 'Afficher toutes les chaînes',
      loadMore: 'Charger plus de chaînes',
      channelsFound: 'chaîne',
      direct: 'DIRECT',
    },
    notifications: {
      enabled: 'Notifications activées',
      enable: 'Activer les notifications',
      settings: 'Paramètres de notification',
      startsIn: 'commence dans {0} min',
      goal: 'BUT !',
      title: 'Notifications',
      noNotifications: 'Aucune notification',
      noNotificationsDesc: "Les alertes de match apparaîtront ici",
      markAllRead: 'Tout marquer comme lu',
      clearAll: 'Tout effacer',
      enableNotifs: 'Activer les notifications',
      openSettings: 'Paramètres',
      justNow: "À l'instant",
      minutesAgo: 'il y a {0} min',
      hoursAgo: 'il y a {0}h',
      settingsTitle: 'Paramètres de notification',
      settingsDesc: 'Choisissez les types de notifications que vous souhaitez recevoir.',
      matchStart: 'Début de match',
      matchStartDesc: 'Recevoir une notification quand un match commence',
      goalsPoints: 'Buts & Points',
      goalsPointsDesc: 'Recevoir une notification quand un but ou des points sont marqués',
      favoriteTeams: 'Équipes favorites',
      favoriteTeamsDesc: "Rappel quand les matchs de vos équipes favorites approchent",
    },
    offline: {
      message: 'Vous êtes hors ligne — certaines données peuvent être anciennes',
    },
    errors: {
      cannotLoad: 'Impossible de charger',
      loadFailed: 'Échec du chargement',
      timeout: "Délai d'attente dépassé",
      invalidResponse: 'Réponse invalide',
      updateFailed: 'Mise à jour échouée — données en cache',
      serverError: 'Erreur serveur',
      boundaryTitle: 'Oups !',
      boundaryMessage: 'Une erreur inattendue est survenue. Veuillez réessayer.',
    },
    tracker: {
      timeline: 'Chronologie',
      timelineMatch: 'Chronologie du match',
      statistics: 'Statistiques',
      keyPlayers: 'Joueurs clés',
      lineups: 'Alignements',
      startingXI: 'Composition de départ',
      substitutes: 'Remplaçants',
      formation: 'Formation',
      noLineups: 'Alignements non disponibles',
      loadingLineups: 'Chargement des alignements...',
      posGK: 'Gardien',
      posDEF: 'Défenseur',
      posMID: 'Milieu',
      posFWD: 'Attaquant',
      loadingEvents: 'Chargement des événements...',
      loadingStats: 'Chargement des statistiques...',
      loadingPlayers: 'Chargement des joueurs clés...',
      statsUnavailable: 'Statistiques non disponibles',
      playersUnavailable: 'Données des joueurs non disponibles',
      goal: 'But',
      yellowCard: 'Carton jaune',
      redCard: 'Carton rouge',
      substitution: 'Remplacement',
      start: 'Début',
      end: 'Fin',
      assist: 'passe décisive',
      spectators: 'spectateurs',
      referee: 'Arbitre',
      summary: 'Résumé',
      winsMatch: 'remporte le match',
      draw: 'Match nul',
      halftime: 'MI-TEMPS',
      eventsWillAppear: "Les événements apparaîtront ici en temps réel",
      liveAtKickoff: "Le suivi en direct sera disponible au coup d'envoi",
      noEvents: 'Aucun événement disponible pour ce match',
      autoRefresh: 'Mise à jour automatique toutes les 15 secondes',
      shots: 'Tirs',
      accuratePasses: 'Passes réussies',
      saves: 'Arrêts',
      cantLoadEvents: 'Impossible de charger les événements',
      serverError: 'Erreur serveur',
      possession: 'Possession',
    },
    player: {
      streamUnavailable: 'Flux indisponible — chaîne probablement hors ligne',
      playbackError: 'Erreur de lecture — ce flux ne peut pas être lu',
      streamUnavailableShort: 'Flux indisponible',
      hlsNotSupported: 'HLS non supporté par ce navigateur',
      otherChannels: '+{0} autres chaînes',
      loadingStream: 'Chargement du flux...',
      autoNextChannel: 'Si la chaîne ne charge pas, on essaie la suivante automatiquement',
      channelUnavailable: 'Chaîne indisponible',
      iptvUnstable: 'Les flux IPTV gratuits sont souvent instables.',
      retry: 'Réessayer',
      otherChannelsLabel: 'Autres chaînes :',
      back: 'Retour',
      live: 'DIRECT',
      liveStream: 'Diffusion en direct',
      resolvingStream: 'Résolution du flux...',
      iframeError: 'Le flux n\'a pas pu se charger',
      iframeLoadTimeout: 'Le flux met trop de temps à se charger',
      tryDirectStream: 'Essayer le flux direct',
      watchElsewhere: 'Regarder ailleurs :',
    },
    stream: {
      watchLive: 'Regarder en direct',
      streamingSites: 'Sites de streaming',
      directStreams: 'Flux directs',
      searchingStreams: 'Recherche de flux...',
      sportStreamDesc: 'Recherche de matchs en direct avec liens de streaming',
      rojaDirectaDesc: 'Streaming en direct de football et plus',
      youtubeDesc: 'Rechercher des diffusions en direct sur YouTube',
      disclaimer: 'Les liens redirigent vers des sites tiers. GoalStream ne héberge aucun contenu.',
      hesgoalDesc: 'Matchs de football en direct HD — Premier League, Champions League, La Liga et plus',
      hesgoalLive: 'Flux HesGoal en direct',
      resolvingStream: 'Résolution du flux en cours...',
      directPlayback: 'Lecture directe HD dans l\'application',
      embedPlayback: 'Lecture via lecteur intégré',
    },
    footer: {
      description: 'Streaming sportif gratuit via IPTV',
      streamsFrom: 'Flux issus de',
      privacyPolicy: 'Politique de confidentialité',
    },
    privacy: {
      title: 'Politique de confidentialité',
      lastUpdated: 'Dernière mise à jour : Mai 2026',
      introduction: '1. Introduction',
      introductionContent: 'GoalStream est une application gratuite de suivi de matchs sportifs en direct. Nous respectons la vie privée de nos utilisateurs et nous nous engageons à la protéger.',
      dataCollection: '2. Collecte de données',
      dataCollectionContent: 'GoalStream ne collecte aucune donnée personnelle de ses utilisateurs. Aucune inscription ni connexion n\'est requise pour utiliser l\'application.',
      automaticData: '3. Données collectées automatiquement',
      automaticDataContent: 'Notre application peut collecter automatiquement certaines données techniques comme l\'adresse IP de l\'appareil, le type d\'appareil et le système d\'exploitation, ainsi que des données de navigation anonymes. Ces données sont utilisées uniquement pour améliorer les performances de l\'application et ne sont jamais vendues à des tiers.',
      notifications: '4. Notifications',
      notificationsContent: 'Si l\'utilisateur active les notifications, celles-ci sont utilisées uniquement pour l\'informer du début des matchs et des buts marqués.',
      contact: '5. Contact',
      contactContent: 'Pour toute question concernant cette politique de confidentialité, les utilisateurs peuvent nous contacter à l\'adresse ci-dessous.',
      contactEmail: 'Adresse de contact',
    },
    dates: {
      today: "Aujourd'hui",
      tomorrow: 'Demain',
      dayAfter: 'Après-demain',
      weekdaysShort: ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'],
      weekdaysLong: ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'],
      monthsLong: ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'],
    },
  },
  en: {
    nav: {
      matches: 'Matches',
      basketball: 'Basketball',
      basket: 'Basket',
      favorites: 'Favorites',
      channels: 'Channels',
      standings: 'Standings',
    },
    common: {
      liveSport: 'Live Sports',
      today: 'Today',
      tomorrow: 'Tomorrow',
      live: 'Live',
      finished: 'Finished',
      upcoming: 'Upcoming',
      loading: 'Loading',
      retry: 'Retry',
      offline: 'Offline',
      offlineMode: 'Offline mode',
      install: 'Install',
      installApp: 'Install app',
      search: 'Search',
      update: 'Upd',
      showMore: 'Show more',
      showLess: 'Show less',
      all: 'All',
      more: 'more',
      confirm: 'Confirm',
      cancel: 'Cancel',
      clearAll: 'Clear all',
      vs: 'VS',
      allCompetitions: 'All competitions',
      lightMode: 'Light mode',
      darkMode: 'Dark mode',
      nextMatch: 'Next match',
      nextMatchIn: 'Next match in',
      noMatchesNow: 'No matches currently',
      checkBackLater: 'Check back later for upcoming matches!',
      loadingMatches: 'Loading matches...',
      otherMatches: 'other matches',
      yesterday: 'Yesterday',
      pickDate: 'Pick a date',
      noMatchesDay: 'No matches scheduled on this day',
      showFinishedMatches: 'Show finished matches',
      hideFinishedMatches: 'Hide finished matches',
      liveNow: 'Live now',
      todayUpcoming: 'Today upcoming',
      dayMatches: 'Day matches',
      finishedMatches: 'Finished matches',
      upcomingMatches: 'Upcoming matches',
    },
    match: {
      min: 'min',
      ht: 'HT',
      firstHalf: '1st Half',
      secondHalf: '2nd Half',
      extraTime: 'ET',
      watchLive: 'Watch live',
      watch: 'Watch',
      seeSummary: 'See summary',
      followMatch: 'Follow match',
      follow: 'Follow',
      finished: 'Match finished',
      startsIn: 'Starts in {0} min',
      searching: 'Searching...',
      noChannelFound: 'No channel found for this match',
      noChannelRetry: 'No channel found — try again',
      searchTooLong: 'Search taking too long — try again',
      liveBroadcast: 'Live broadcast',
      broadcastOn: 'Broadcast on',
      liveStreamAvailable: 'Live stream available ({0} streams)',
      friendly: 'Friendly',
      share: 'Share',
      copied: 'Copied!',
      highlights: 'Highlights',
      externalSources: 'External sources',
    },
    basketball: {
      q1: 'Q1',
      q2: 'Q2',
      q3: 'Q3',
      q4: 'Q4',
      ot: 'OT',
      firstHalf: '1st Half',
      secondHalf: '2nd Half',
    },
    football: {
      halftime: 'Halftime',
      secondHalf: '2nd Half',
    },
    standings: {
      title: 'Standings',
      championships: 'Championships',
      clubCups: 'Club Cups',
      nationalTeams: 'National Teams',
      women: 'Women',
      basketball: 'Basketball',
      fifaRanking: 'FIFA Ranking',
      worldCup: 'World Cup',
      team: 'Team',
      played: 'P',
      won: 'W',
      drawn: 'D',
      lost: 'L',
      points: 'Pts',
      teams: 'teams',
      clickTeam: 'Click on a team',
      championsLeague: 'Champions League',
      europaConf: 'Europa / Conf.',
      relegation: 'Relegation',
      qualified: 'Qualified next round',
      playoffs: 'Playoffs',
      playIn: 'Play-In',
      eliminated: 'Eliminated',
      top10: 'Top 10',
      top20: 'Top 20',
      wins: 'W',
      losses: 'L',
      winPct: 'PCT',
      gamesBehind: 'GB',
      loadingStandings: 'Loading standings',
      fetchingData: 'Fetching data...',
      updating: 'Updating...',
      loadingLeague: 'Loading...',
      loadError: 'Error loading {0}',
      schedule: 'Schedule',
      qualifiedTeams: 'Qualified teams',
      showNextTeams: 'Show next {0} teams',
      otherTeams: 'Show {0} more teams',
      barrages: 'Playoffs',
      dataUnavailable: 'Data not yet available for this competition. Try again in a few minutes.',
      competitionPaused: 'Data for {0} is currently unavailable. The competition may be between phases.',
      groupsNotFormed: 'Groups have not yet been formed for the next edition.',
      worldCupMessage: 'The 2026 FIFA World Cup will take place from June 11 to July 19 in the United States, Canada, and Mexico. Check matches for live results.',
      copaAmericaMessage: 'The next Copa América will take place in 2028. Groups will be announced later.',
      asianCupMessage: 'The next Asian Cup will take place in 2027 in Saudi Arabia. Qualifications are ongoing.',
      goldCupMessage: 'The next Gold Cup will take place in 2027. Details will be announced later.',
      womenFriendlyMessage: 'Friendly matches do not have standings. Check results in the Matches tab.',
      ranking: 'ranking',
      topScorers: 'Top Scorers',
      goals: 'Goals',
      assists: 'Assists',
      player: 'Player',
      matchesPlayed: 'MP',
      mlb: 'MLB ⚾',
      nhl: 'NHL 🏒',
      cricket: 'Cricket 🏏',
      motorSport: 'Motor Sport 🏎️',
      mma: 'MMA 🥊',
      boxing: 'Boxing 🥊',
      motorsports: 'Motorsports 🏁',
      other: 'Other 🏈',
      rugby: 'Rugby 🏉',
      otLosses: 'OTL',
      ties: 'T',
      drivers: 'Drivers',
      constructors: 'Constructors',
      runsFor: 'RS',
      runsAgainst: 'RA',
      goalsFor: 'GF',
      goalsAgainst: 'GA',
      winPctShort: 'PCT',
      streak: 'Streak',
    },
    teamDetail: {
      info: 'Info',
      roster: 'Roster',
      schedule: 'Schedule',
      stats: 'Statistics',
      stadium: 'Stadium',
      coach: 'Coach',
      founded: 'Founded',
      abbreviation: 'Abbreviation',
      seasonStats: 'Season Statistics',
      matchesPlayed: 'Matches Played',
      victories: 'Wins',
      draws: 'Draws',
      defeats: 'Losses',
      goalsScored: 'Goals Scored',
      goalsConceded: 'Goals Conceded',
      goalDiff: 'Goal Diff.',
      avgGoals: 'Avg goals/match',
      pointsScored: 'Points Scored',
      pointsConceded: 'Points Conceded',
      pointDiff: 'Point Diff.',
      avgPoints: 'Avg points/match',
      winPct: 'Win %',
      form: 'Form',
      upcoming: 'Upcoming',
      finished: 'Finished',
      live: 'Live',
      home: 'HOME',
      away: 'AWAY',
      otherMatches: 'other matches',
      noInfo: 'Limited information',
      noInfoHint: 'Detailed data will be available soon',
      noRoster: 'Roster unavailable',
      noRosterHint: 'Roster will be announced soon',
      noSchedule: 'Schedule unavailable',
      noScheduleHint: 'Matches will be scheduled soon',
      loading: 'Loading data...',
      loadError: 'Failed to load',
      retry: 'Retry',
      addFavorite: 'Add to favorites',
      removeFavorite: 'Remove from favorites',
      goalkeepers: 'Goalkeepers',
      defenders: 'Defenders',
      midfielders: 'Midfielders',
      attackers: 'Attackers',
      pointGuard: 'Point Guard',
      shootingGuard: 'Shooting Guard',
      smallForward: 'Small Forward',
      powerForward: 'Power Forward',
      center: 'Center',
      yearsOld: 'y/o',
      pitcher: 'Pitcher',
      catcher: 'Catcher',
      baseman: 'Baseman',
      outfielder: 'Outfielder',
      defenseman: 'Defenseman',
      forward: 'Forward',
      goaltender: 'Goaltender',
      quarterback: 'Quarterback',
      runningBack: 'Running Back',
      wideReceiver: 'Wide Receiver',
      driver: 'Driver',
      fighter: 'Fighter',
      weightClass: 'Weight Class',
      champion: 'Champion',
    },
    favorites: {
      title: 'Favorites',
      myFavorites: 'My Favorites',
      noFavorites: 'No favorites',
      addFavoritesHint: 'Add your favorite teams and channels by tapping the ❤️ icon for quick access',
      addFavorites: 'Add to favorites',
      removeFavorites: 'Remove from favorites',
      favoriteTeams: 'Favorite teams',
      favoriteChannels: 'Favorite channels',
      teams: 'team',
      channels: 'channel',
      noMatches: 'No matches scheduled for your teams in the next 3 days',
      noMatchesDay: 'No matches scheduled for this day',
      comeBackLater: 'Come back later!',
      savedLocally: 'Your favorites are saved locally on your device',
      tapHeart: 'Tap ❤️',
      quickAccess: 'Quick access',
    },
    search: {
      title: 'Global Search',
      placeholder: 'Search matches, channels, competitions...',
      noResults: 'No results found',
      matches: 'Matches',
      channels: 'Channels',
      competitions: 'Competitions',
      shortcut: 'Ctrl+K',
    },
    channels: {
      title: 'Channels',
      searchPlaceholder: 'Search channels...',
      onlineOnly: 'Online only',
      check: 'Test',
      checking: 'Checking...',
      allCountries: 'All countries',
      online: 'online',
      offline: 'offline',
      untested: 'untested',
      noChannels: 'No channels found',
      tryDisableFilter: 'Try disabling the "Online only" filter',
      adjustFilters: 'Adjust your search or filters',
      showAllChannels: 'Show all channels',
      loadMore: 'Load more channels',
      channelsFound: 'channel',
      direct: 'LIVE',
    },
    notifications: {
      enabled: 'Notifications enabled',
      enable: 'Enable notifications',
      settings: 'Notification settings',
      startsIn: 'starts in {0} min',
      goal: 'GOAL!',
      title: 'Notifications',
      noNotifications: 'No notifications',
      noNotificationsDesc: 'Match alerts will appear here',
      markAllRead: 'Mark all as read',
      clearAll: 'Clear all',
      enableNotifs: 'Enable notifications',
      openSettings: 'Settings',
      justNow: 'Just now',
      minutesAgo: '{0} min ago',
      hoursAgo: '{0}h ago',
      settingsTitle: 'Notification settings',
      settingsDesc: 'Choose which types of notifications you want to receive.',
      matchStart: 'Match start',
      matchStartDesc: 'Get notified when a match starts',
      goalsPoints: 'Goals & Points',
      goalsPointsDesc: 'Get notified when a goal or points are scored',
      favoriteTeams: 'Favorite teams',
      favoriteTeamsDesc: 'Reminder when your favorite teams\' matches are coming up',
    },
    offline: {
      message: 'You are offline — some data may be outdated',
    },
    errors: {
      cannotLoad: 'Cannot load',
      loadFailed: 'Loading failed',
      timeout: 'Request timed out',
      invalidResponse: 'Invalid response',
      updateFailed: 'Update failed — cached data',
      serverError: 'Server error',
      boundaryTitle: 'Oops!',
      boundaryMessage: 'An unexpected error occurred. Please try again.',
    },
    tracker: {
      timeline: 'Timeline',
      timelineMatch: 'Match timeline',
      statistics: 'Statistics',
      keyPlayers: 'Key players',
      lineups: 'Lineups',
      startingXI: 'Starting XI',
      substitutes: 'Substitutes',
      formation: 'Formation',
      noLineups: 'Lineups unavailable',
      loadingLineups: 'Loading lineups...',
      posGK: 'Goalkeeper',
      posDEF: 'Defender',
      posMID: 'Midfielder',
      posFWD: 'Forward',
      loadingEvents: 'Loading events...',
      loadingStats: 'Loading statistics...',
      loadingPlayers: 'Loading key players...',
      statsUnavailable: 'Statistics unavailable',
      playersUnavailable: 'Player data unavailable',
      goal: 'Goal',
      yellowCard: 'Yellow card',
      redCard: 'Red card',
      substitution: 'Substitution',
      start: 'Start',
      end: 'End',
      assist: 'assist',
      spectators: 'spectators',
      referee: 'Referee',
      summary: 'Summary',
      winsMatch: 'wins the match',
      draw: 'Draw',
      halftime: 'HALFTIME',
      eventsWillAppear: 'Events will appear here in real time',
      liveAtKickoff: 'Live tracking will be available at kickoff',
      noEvents: 'No events available for this match',
      autoRefresh: 'Auto-refresh every 15 seconds',
      shots: 'Shots',
      accuratePasses: 'Accurate passes',
      saves: 'Saves',
      cantLoadEvents: 'Cannot load events',
      serverError: 'Server error',
      possession: 'Possession',
    },
    player: {
      streamUnavailable: 'Stream unavailable — channel likely offline',
      playbackError: 'Playback error — this stream cannot be played',
      streamUnavailableShort: 'Stream unavailable',
      hlsNotSupported: 'HLS not supported by this browser',
      otherChannels: '+{0} other channels',
      loadingStream: 'Loading stream...',
      autoNextChannel: 'If the channel doesn\'t load, we\'ll try the next one automatically',
      channelUnavailable: 'Channel unavailable',
      iptvUnstable: 'Free IPTV streams are often unstable.',
      retry: 'Retry',
      otherChannelsLabel: 'Other channels:',
      back: 'Back',
      live: 'LIVE',
      liveStream: 'Live stream',
      resolvingStream: 'Resolving stream...',
      iframeError: 'Stream failed to load',
      iframeLoadTimeout: 'Stream is taking too long to load',
      tryDirectStream: 'Try direct stream',
      watchElsewhere: 'Watch elsewhere:',
    },
    stream: {
      watchLive: 'Watch Live',
      streamingSites: 'Streaming Sites',
      directStreams: 'Direct Streams',
      searchingStreams: 'Searching for streams...',
      sportStreamDesc: 'Search live matches with streaming links',
      rojaDirectaDesc: 'Live football streaming and more',
      youtubeDesc: 'Search for live broadcasts on YouTube',
      disclaimer: 'Links redirect to third-party sites. GoalStream does not host any content.',
      hesgoalDesc: 'Live HD football matches — Premier League, Champions League, La Liga and more',
      hesgoalLive: 'HesGoal Live Stream',
      resolvingStream: 'Resolving stream...',
      directPlayback: 'Direct HD playback in app',
      embedPlayback: 'Playback via embedded player',
    },
    footer: {
      description: 'Free sports streaming via IPTV',
      streamsFrom: 'Streams from',
      privacyPolicy: 'Privacy Policy',
    },
    privacy: {
      title: 'Privacy Policy',
      lastUpdated: 'Last updated: May 2026',
      introduction: '1. Introduction',
      introductionContent: 'GoalStream is a free live sports match tracking application. We respect the privacy of our users and are committed to protecting it.',
      dataCollection: '2. Data Collection',
      dataCollectionContent: 'GoalStream does not collect any personal data from its users. No registration or login is required to use the application.',
      automaticData: '3. Automatically Collected Data',
      automaticDataContent: 'Our application may automatically collect certain technical data such as the device IP address, device type and operating system, as well as anonymous browsing data. This data is used solely to improve the performance of the application and is never sold to third parties.',
      notifications: '4. Notifications',
      notificationsContent: 'If the user enables notifications, they are used solely to inform about match starts and goals scored.',
      contact: '5. Contact',
      contactContent: 'For any questions regarding this privacy policy, users can contact us at the address below.',
      contactEmail: 'Contact email',
    },
    dates: {
      today: 'Today',
      tomorrow: 'Tomorrow',
      dayAfter: 'Day after tomorrow',
      weekdaysShort: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
      weekdaysLong: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      monthsLong: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    },
  },
  ar: {
    nav: {
      matches: 'مباريات',
      basketball: 'كرة سلة',
      basket: 'سلة',
      favorites: 'المفضلة',
      channels: 'قنوات',
      standings: 'ترتيب',
    },
    common: {
      liveSport: 'رياضة مباشرة',
      today: 'اليوم',
      tomorrow: 'غداً',
      live: 'مباشر',
      finished: 'منتهي',
      upcoming: 'قادم',
      loading: 'جاري التحميل',
      retry: 'إعادة المحاولة',
      offline: 'غير متصل',
      offlineMode: 'وضع عدم الاتصال',
      install: 'تثبيت',
      installApp: 'تثبيت التطبيق',
      search: 'بحث',
      update: 'تحديث',
      showMore: 'عرض المزيد',
      showLess: 'عرض أقل',
      all: 'الكل',
      more: 'المزيد',
      confirm: 'تأكيد',
      cancel: 'إلغاء',
      clearAll: 'مسح الكل',
      vs: 'ضد',
      allCompetitions: 'جميع البطولات',
      lightMode: 'الوضع الفاتح',
      darkMode: 'الوضع الداكن',
      nextMatch: 'المباراة التالية',
      nextMatchIn: 'المباراة التالية بعد',
      noMatchesNow: 'لا توجد مباريات حالياً',
      checkBackLater: 'عد لاحقاً للمباريات القادمة!',
      loadingMatches: 'جاري تحميل المباريات...',
      otherMatches: 'مباريات أخرى',
      yesterday: 'أمس',
      pickDate: 'اختر تاريخاً',
      noMatchesDay: 'لا توجد مباريات في هذا اليوم',
      showFinishedMatches: 'عرض المباريات المنتهية',
      hideFinishedMatches: 'إخفاء المباريات المنتهية',
      liveNow: 'مباشر الآن',
      todayUpcoming: 'قادمة اليوم',
      dayMatches: 'مباريات اليوم',
      finishedMatches: 'مباريات منتهية',
      upcomingMatches: 'مباريات قادمة',
    },
    match: {
      min: 'د',
      ht: 'الشوط',
      firstHalf: 'الشوط الأول',
      secondHalf: 'الشوط الثاني',
      extraTime: 'إضافي',
      watchLive: 'شاهد مباشر',
      watch: 'شاهد',
      seeSummary: 'شاهد الملخص',
      followMatch: 'تابع المباراة',
      follow: 'تابع',
      finished: 'المباراة انتهت',
      startsIn: 'تبدأ خلال {0} د',
      searching: 'جاري البحث...',
      noChannelFound: 'لم يتم العثور على قناة لهذه المباراة',
      noChannelRetry: 'لم يتم العثور على قناة — حاول مجدداً',
      searchTooLong: 'البحث طويل جداً — حاول مجدداً',
      liveBroadcast: 'بث مباشر',
      broadcastOn: 'يبث على',
      liveStreamAvailable: 'بث مباشر متاح ({0} بث)',
      friendly: 'ودي',
      share: 'مشاركة',
      copied: 'تم النسخ!',
      highlights: 'ملخصات',
      externalSources: 'مصادر خارجية',
    },
    basketball: {
      q1: 'ر1',
      q2: 'ر2',
      q3: 'ر3',
      q4: 'ر4',
      ot: 'إضافي',
      firstHalf: 'الشوط الأول',
      secondHalf: 'الشوط الثاني',
    },
    football: {
      halftime: 'نهاية الشوط',
      secondHalf: 'الشوط الثاني',
    },
    standings: {
      title: 'الترتيب',
      championships: 'البطولات',
      clubCups: 'كأس الأندية',
      nationalTeams: 'الفرق الوطنية',
      women: 'نسائية',
      basketball: 'كرة السلة',
      fifaRanking: 'تصنيف FIFA',
      worldCup: 'كأس العالم',
      team: 'الفريق',
      played: 'لعب',
      won: 'فاز',
      drawn: 'تعادل',
      lost: 'خسر',
      points: 'نقاط',
      teams: 'فرق',
      clickTeam: 'انقر على فريق',
      championsLeague: 'دوري الأبطال',
      europaConf: 'يوروبا / كونف',
      relegation: 'هبوط',
      qualified: 'تأهل للجولة القادمة',
      playoffs: 'بلاي أوف',
      playIn: 'بلاي إن',
      eliminated: 'خارج',
      top10: 'أفضل 10',
      top20: 'أفضل 20',
      wins: 'ف',
      losses: 'خ',
      winPct: 'نسبة',
      gamesBehind: 'خلف',
      loadingStandings: 'تحميل الترتيب',
      fetchingData: 'جاري استرجاع البيانات...',
      updating: 'جاري التحديث...',
      loadingLeague: 'جاري التحميل...',
      loadError: 'خطأ في تحميل {0}',
      schedule: 'الجدول',
      qualifiedTeams: 'الفرق المتأهلة',
      showNextTeams: 'عرض الفرق الـ {0} التالية',
      otherTeams: 'عرض {0} فرق أخرى',
      barrages: 'التصفيات',
      dataUnavailable: 'البيانات غير متاحة بعد لهذه البطولة. حاول مرة أخرى بعد بضع دقائق.',
      competitionPaused: 'بيانات {0} غير متاحة حالياً. قد تكون البطولة بين مراحل.',
      groupsNotFormed: 'المجموعات لم تتشكل بعد للنسخة القادمة.',
      worldCupMessage: 'ستقام كأس العالم FIFA 2026 من 11 يونيو إلى 19 يوليو في الولايات المتحدة وكندا والمكسيك. تحقق من المباريات لمتابعة النتائج المباشرة.',
      copaAmericaMessage: 'ستقام كوبا أمريكا القادمة في 2028. سيتم الإعلان عن المجموعات لاحقاً.',
      asianCupMessage: 'ستقام كأس آسيا القادمة في 2027 في السعودية. التصفيات جارية.',
      goldCupMessage: 'ستقام كأس الكونكاكاف الذهبية القادمة في 2027. سيتم الإعلان عن التفاصيل لاحقاً.',
      womenFriendlyMessage: 'المباريات الودية ليس لها ترتيب. تحقق من النتائج في علامة تبويب المباريات.',
      ranking: 'ترتيب',
      topScorers: 'الهدافون',
      goals: 'أهداف',
      assists: 'تمريرات',
      player: 'لاعب',
      matchesPlayed: 'مباريات',
      mlb: 'MLB ⚾',
      nhl: 'NHL 🏒',
      cricket: 'الكريكت 🏏',
      motorSport: 'سباق السيارات 🏎️',
      mma: 'MMA 🥊',
      boxing: 'الملاكمة 🥊',
      motorsports: 'الرياضات الآلية 🏁',
      other: 'أخرى 🏈',
      rugby: 'الرغبي 🏉',
      otLosses: 'خ.إ',
      ties: 'ت',
      drivers: 'السائقون',
      constructors: 'الفرق',
      runsFor: 'نقاط',
      runsAgainst: 'عليه',
      goalsFor: 'له',
      goalsAgainst: 'عليه',
      winPctShort: 'نسبة',
      streak: 'سلسلة',
    },
    teamDetail: {
      info: 'معلومات',
      roster: 'القائمة',
      schedule: 'الجدول',
      stats: 'إحصائيات',
      stadium: 'الملعب',
      coach: 'المدرب',
      founded: 'تأسس',
      abbreviation: 'الاختصار',
      seasonStats: 'إحصائيات الموسم',
      matchesPlayed: 'المباريات',
      victories: 'انتصارات',
      draws: 'تعادلات',
      defeats: 'هزائم',
      goalsScored: 'أهداف مسجلة',
      goalsConceded: 'أهداف مستقبلة',
      goalDiff: 'فارق الأهداف',
      avgGoals: 'معدل أهداف/مباراة',
      pointsScored: 'نقاط مسجلة',
      pointsConceded: 'نقاط مستقبلة',
      pointDiff: 'فارق النقاط',
      avgPoints: 'معدل نقاط/مباراة',
      winPct: 'نسبة الفوز',
      form: 'الشكل',
      upcoming: 'قادمة',
      finished: 'منتهية',
      live: 'مباشر',
      home: 'أرض',
      away: 'خارج',
      otherMatches: 'مباريات أخرى',
      noInfo: 'معلومات محدودة',
      noInfoHint: 'ستتوفر البيانات التفصيلية قريبًا',
      noRoster: 'القائمة غير متوفرة',
      noRosterHint: 'سيتم الإعلان عن القائمة قريبًا',
      noSchedule: 'الجدول غير متوفر',
      noScheduleHint: 'سيتم جدولة المباريات قريبًا',
      loading: 'جاري التحميل...',
      loadError: 'فشل التحميل',
      retry: 'إعادة المحاولة',
      addFavorite: 'أضف للمفضلة',
      removeFavorite: 'إزالة من المفضلة',
      goalkeepers: 'حراس المرمى',
      defenders: 'مدافعون',
      midfielders: 'لاعبو وسط',
      attackers: 'مهاجمون',
      pointGuard: 'لاعب نقطة',
      shootingGuard: 'لاعب رمي',
      smallForward: 'جناح صغير',
      powerForward: 'جناح قوي',
      center: 'محور',
      yearsOld: 'سنة',
      pitcher: 'رامي',
      catcher: 'لاقط',
      baseman: 'قاعدي',
      outfielder: 'خارجي',
      defenseman: 'مدافع',
      forward: 'مهاجم',
      goaltender: 'حارس',
      quarterback: 'ظهير',
      runningBack: 'عداء',
      wideReceiver: 'مستقبل',
      driver: 'سائق',
      fighter: 'مقاتل',
      weightClass: 'فئة وزن',
      champion: 'بطل',
    },
    favorites: {
      title: 'المفضلة',
      myFavorites: 'مفضلاتي',
      noFavorites: 'لا توجد مفضلات',
      addFavoritesHint: 'أضف فرقك وقنواتك المفضلة بالضغط على أيقونة ❤️ للوصول السريع',
      addFavorites: 'أضف إلى المفضلة',
      removeFavorites: 'إزالة من المفضلة',
      favoriteTeams: 'الفرق المفضلة',
      favoriteChannels: 'القنوات المفضلة',
      teams: 'فريق',
      channels: 'قناة',
      noMatches: 'لا توجد مباريات لفرقك في الأيام الثلاثة القادمة',
      noMatchesDay: 'لا توجد مباريات مجدولة في هذا اليوم',
      comeBackLater: 'عد لاحقاً!',
      savedLocally: 'يتم حفظ مفضلاتك محلياً على جهازك',
      tapHeart: 'اضغط على ❤️',
      quickAccess: 'وصول سريع',
    },
    search: {
      title: 'بحث شامل',
      placeholder: 'ابحث عن مباريات، قنوات، بطولات...',
      noResults: 'لم يتم العثور على نتائج',
      matches: 'مباريات',
      channels: 'قنوات',
      competitions: 'بطولات',
      shortcut: 'Ctrl+K',
    },
    channels: {
      title: 'القنوات',
      searchPlaceholder: 'ابحث عن قناة...',
      onlineOnly: 'متصل فقط',
      check: 'اختبار',
      checking: 'جاري الفحص...',
      allCountries: 'جميع البلدان',
      online: 'متصل',
      offline: 'غير متصل',
      untested: 'غير مختبر',
      noChannels: 'لم يتم العثور على قنوات',
      tryDisableFilter: 'حاول تعطيل فلتر "متصل فقط"',
      adjustFilters: 'عدّل بحثك أو فلاترك',
      showAllChannels: 'عرض جميع القنوات',
      loadMore: 'تحميل المزيد من القنوات',
      channelsFound: 'قناة',
      direct: 'مباشر',
    },
    notifications: {
      enabled: 'الإشعارات مفعّلة',
      enable: 'تفعيل الإشعارات',
      settings: 'إعدادات الإشعارات',
      startsIn: 'تبدأ خلال {0} د',
      goal: 'هدف!',
      title: 'الإشعارات',
      noNotifications: 'لا توجد إشعارات',
      noNotificationsDesc: 'ستظهر تنبيهات المباريات هنا',
      markAllRead: 'تحديد الكل كمقروء',
      clearAll: 'مسح الكل',
      enableNotifs: 'تفعيل الإشعارات',
      openSettings: 'الإعدادات',
      justNow: 'الآن',
      minutesAgo: 'منذ {0} د',
      hoursAgo: 'منذ {0} س',
      settingsTitle: 'إعدادات الإشعارات',
      settingsDesc: 'اختر أنواع الإشعارات التي تريد تلقيها.',
      matchStart: 'بداية المباراة',
      matchStartDesc: 'تلقي إشعار عند بداية المباراة',
      goalsPoints: 'أهداف ونقاط',
      goalsPointsDesc: 'تلقي إشعار عند تسجيل هدف أو نقاط',
      favoriteTeams: 'الفرق المفضلة',
      favoriteTeamsDesc: 'تذكير عند اقتراب مباريات فرقك المفضلة',
    },
    offline: {
      message: 'أنت غير متصل — قد تكون بعض البيانات قديمة',
    },
    errors: {
      cannotLoad: 'لا يمكن التحميل',
      loadFailed: 'فشل التحميل',
      timeout: 'انتهت مهلة الطلب',
      invalidResponse: 'استجابة غير صالحة',
      updateFailed: 'فشل التحديث — بيانات مخزنة مؤقتاً',
      serverError: 'خطأ في الخادم',
      boundaryTitle: 'عفواً!',
      boundaryMessage: 'حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.',
    },
    tracker: {
      timeline: 'الجدول الزمني',
      timelineMatch: 'الجدول الزمني للمباراة',
      statistics: 'الإحصائيات',
      keyPlayers: 'اللاعبون الرئيسيون',
      lineups: 'التشكيلة',
      startingXI: 'التشكيلة الأساسية',
      substitutes: 'البدلاء',
      formation: 'التشكيل',
      noLineups: 'التشكيلة غير متاحة',
      loadingLineups: 'تحميل التشكيلة...',
      posGK: 'حارس مرمى',
      posDEF: 'مدافع',
      posMID: 'لاعب وسط',
      posFWD: 'مهاجم',
      loadingEvents: 'تحميل الأحداث...',
      loadingStats: 'تحميل الإحصائيات...',
      loadingPlayers: 'تحميل اللاعبين الرئيسيين...',
      statsUnavailable: 'الإحصائيات غير متاحة',
      playersUnavailable: 'بيانات اللاعبين غير متاحة',
      goal: 'هدف',
      yellowCard: 'بطاقة صفراء',
      redCard: 'بطاقة حمراء',
      substitution: 'تبديل',
      start: 'بداية',
      end: 'نهاية',
      assist: 'تمريرة حاسمة',
      spectators: 'متفرجون',
      referee: 'الحكم',
      summary: 'ملخص',
      winsMatch: 'يفوز بالمباراة',
      draw: 'تعادل',
      halftime: 'نهاية الشوط',
      eventsWillAppear: 'ستظهر الأحداث هنا في الوقت الفعلي',
      liveAtKickoff: 'سيكون التتبع المباشر متاحاً عند بدء المباراة',
      noEvents: 'لا توجد أحداث متاحة لهذه المباراة',
      autoRefresh: 'تحديث تلقائي كل 15 ثانية',
      shots: 'تسديدات',
      accuratePasses: 'تمريرات دقيقة',
      saves: 'تصديات',
      cantLoadEvents: 'لا يمكن تحميل الأحداث',
      serverError: 'خطأ في الخادم',
      possession: 'الاستحواذ',
    },
    player: {
      streamUnavailable: 'البث غير متاح — القناة على الأرجح غير متصلة',
      playbackError: 'خطأ في التشغيل — لا يمكن تشغيل هذا البث',
      streamUnavailableShort: 'البث غير متاح',
      hlsNotSupported: 'HLS غير مدعوم في هذا المتصفح',
      otherChannels: '+{0} قنوات أخرى',
      loadingStream: 'جاري تحميل البث...',
      autoNextChannel: 'إذا لم يتم تحميل القناة، سنحاول التالية تلقائياً',
      channelUnavailable: 'القناة غير متاحة',
      iptvUnstable: 'البث المباشر المجاني غالباً ما يكون غير مستقر.',
      retry: 'إعادة المحاولة',
      otherChannelsLabel: 'قنوات أخرى:',
      back: 'رجوع',
      live: 'مباشر',
      liveStream: 'بث مباشر',
      resolvingStream: 'جاري تحليل البث...',
      iframeError: 'فشل تحميل البث',
      iframeLoadTimeout: 'البث يستغرق وقتاً طويلاً للتحميل',
      tryDirectStream: 'تجربة البث المباشر',
      watchElsewhere: 'شاهد في مكان آخر:',
    },
    stream: {
      watchLive: 'شاهد مباشر',
      streamingSites: 'مواقع البث',
      directStreams: 'بث مباشر',
      searchingStreams: 'جاري البحث عن بث...',
      sportStreamDesc: 'البحث عن مباريات مباشرة مع روابط بث',
      rojaDirectaDesc: 'بث مباشر لكرة القدم والمزيد',
      youtubeDesc: 'البحث عن بث مباشر على يوتيوب',
      disclaimer: 'الروابط تعيد التوجيه إلى مواقع خارجية. GoalStream لا يستضيف أي محتوى.',
      hesgoalDesc: 'مباريات كرة قدم مباشرة بجودة عالية — الدوري الإنجليزي ودوري الأبطال والمزيد',
      hesgoalLive: 'بث HesGoal المباشر',
      resolvingStream: 'جاري حل البث...',
      directPlayback: 'تشغيل مباشر بجودة عالية',
      embedPlayback: 'تشغيل عبر المشغل المدمج',
    },
    footer: {
      description: 'بث رياضي مجاني عبر IPTV',
      streamsFrom: 'البث من',
      privacyPolicy: 'سياسة الخصوصية',
    },
    privacy: {
      title: 'سياسة الخصوصية',
      lastUpdated: 'آخر تحديث: مايو 2026',
      introduction: '1. مقدمة',
      introductionContent: 'GoalStream هو تطبيق مجاني لتتبع المباريات الرياضية المباشرة. نحن نحترم خصوصية مستخدمينا ونلتزم بحمايتها.',
      dataCollection: '2. جمع البيانات',
      dataCollectionContent: 'GoalStream لا يجمع أي بيانات شخصية من مستخدميه. لا يتطلب التسجيل أو تسجيل الدخول لاستخدام التطبيق.',
      automaticData: '3. البيانات المجمعة تلقائياً',
      automaticDataContent: 'قد يجمع تطبيقنا تلقائياً بعض البيانات التقنية مثل عنوان IP للجهاز ونوع الجهاز ونظام التشغيل بالإضافة إلى بيانات التصفح المجهولة. تستخدم هذه البيانات فقط لتحسين أداء التطبيق ولا يتم بيعها أبداً لأطراف ثالثة.',
      notifications: '4. الإشعارات',
      notificationsContent: 'إذا قام المستخدم بتفعيل الإشعارات، فتُستخدم فقط لإبلاغه ببداية المباريات والأهداف المسجلة.',
      contact: '5. الاتصال',
      contactContent: 'لأي أسئلة تتعلق بسياسة الخصوصية هذه، يمكن للمستخدمين الاتصال بنا على العنوان أدناه.',
      contactEmail: 'البريد الإلكتروني للاتصال',
    },
    dates: {
      today: 'اليوم',
      tomorrow: 'غداً',
      dayAfter: 'بعد غد',
      weekdaysShort: ['أحد', 'إثن', 'ثلا', 'أرب', 'خمي', 'جمع', 'سبت'],
      weekdaysLong: ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'],
      monthsLong: ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'],
    },
  },
  es: {
    nav: {
      matches: 'Partidos',
      basketball: 'Baloncesto',
      basket: 'Baloncesto',
      favorites: 'Favoritos',
      channels: 'Canales',
      standings: 'Clasificación',
    },
    common: {
      liveSport: 'Deporte en vivo',
      today: 'Hoy',
      tomorrow: 'Mañana',
      live: 'En vivo',
      finished: 'Finalizado',
      upcoming: 'Próximo',
      loading: 'Cargando',
      retry: 'Reintentar',
      offline: 'Sin conexión',
      offlineMode: 'Modo sin conexión',
      install: 'Instalar',
      installApp: 'Instalar aplicación',
      search: 'Buscar',
      update: 'Act',
      showMore: 'Ver más',
      showLess: 'Ver menos',
      all: 'Todo',
      more: 'más',
      confirm: 'Confirmar',
      cancel: 'Cancelar',
      clearAll: 'Borrar todo',
      vs: 'VS',
      allCompetitions: 'Todas las competiciones',
      lightMode: 'Modo claro',
      darkMode: 'Modo oscuro',
      nextMatch: 'Próximo partido',
      nextMatchIn: 'Próximo partido en',
      noMatchesNow: 'No hay partidos actualmente',
      checkBackLater: '¡Vuelve más tarde para los próximos partidos!',
      loadingMatches: 'Cargando partidos...',
      otherMatches: 'otros partidos',
      yesterday: 'Ayer',
      pickDate: 'Elige una fecha',
      noMatchesDay: 'No hay partidos programados en este día',
      showFinishedMatches: 'Mostrar partidos finalizados',
      hideFinishedMatches: 'Ocultar partidos finalizados',
      liveNow: 'En directo ahora',
      todayUpcoming: 'Próximos hoy',
      dayMatches: 'Partidos del día',
      finishedMatches: 'Partidos finalizados',
      upcomingMatches: 'Partidos próximos',
    },
    match: {
      min: 'min',
      ht: 'DT',
      firstHalf: '1er Tiempo',
      secondHalf: '2do Tiempo',
      extraTime: 'PROR',
      watchLive: 'Ver en vivo',
      watch: 'Ver',
      seeSummary: 'Ver resumen',
      followMatch: 'Seguir partido',
      follow: 'Seguir',
      finished: 'Partido terminado',
      startsIn: 'Empieza en {0} min',
      searching: 'Buscando...',
      noChannelFound: 'No se encontró canal para este partido',
      noChannelRetry: 'No se encontró canal — intente de nuevo',
      searchTooLong: 'Búsqueda muy larga — intente de nuevo',
      liveBroadcast: 'Transmisión en vivo',
      broadcastOn: 'Transmitido por',
      liveStreamAvailable: 'Transmisión en vivo disponible ({0} flujos)',
      friendly: 'Amistoso',
      share: 'Compartir',
      copied: '¡Copiado!',
      highlights: 'Resumen',
      externalSources: 'Fuentes externas',
    },
    basketball: {
      q1: 'C1',
      q2: 'C2',
      q3: 'C3',
      q4: 'C4',
      ot: 'TP',
      firstHalf: '1er Tiempo',
      secondHalf: '2do Tiempo',
    },
    football: {
      halftime: 'Medio tiempo',
      secondHalf: '2do Tiempo',
    },
    standings: {
      title: 'Clasificaciones',
      championships: 'Campeonatos',
      clubCups: 'Copas de Clubes',
      nationalTeams: 'Selecciones',
      women: 'Femenino',
      basketball: 'Baloncesto',
      fifaRanking: 'Ranking FIFA',
      worldCup: 'Copa del Mundo',
      team: 'Equipo',
      played: 'J',
      won: 'G',
      drawn: 'E',
      lost: 'P',
      points: 'Pts',
      teams: 'equipos',
      clickTeam: 'Haga clic en un equipo',
      championsLeague: 'Champions League',
      europaConf: 'Europa / Conf.',
      relegation: 'Descenso',
      qualified: 'Clasificado siguiente ronda',
      playoffs: 'Playoffs',
      playIn: 'Play-In',
      eliminated: 'Eliminado',
      top10: 'Top 10',
      top20: 'Top 20',
      wins: 'G',
      losses: 'P',
      winPct: 'PCT',
      gamesBehind: 'GB',
      loadingStandings: 'Cargando clasificaciones',
      fetchingData: 'Obteniendo datos...',
      updating: 'Actualizando...',
      loadingLeague: 'Cargando...',
      loadError: 'Error al cargar {0}',
      schedule: 'Calendario',
      qualifiedTeams: 'Equipos clasificados',
      showNextTeams: 'Ver los {0} equipos siguientes',
      otherTeams: 'Ver {0} equipos más',
      barrages: 'Playoffs',
      dataUnavailable: 'Los datos aún no están disponibles para esta competición. Intente de nuevo en unos minutos.',
      competitionPaused: 'Los datos de {0} no están disponibles actualmente. La competición puede estar entre fases.',
      groupsNotFormed: 'Los grupos aún no se han formado para la próxima edición.',
      worldCupMessage: 'La Copa del Mundo FIFA 2026 se celebrará del 11 de junio al 19 de julio en Estados Unidos, Canadá y México. Consulta los partidos para seguir los resultados en vivo.',
      copaAmericaMessage: 'La próxima Copa América se celebrará en 2028. Los grupos se anunciarán más adelante.',
      asianCupMessage: 'La próxima Copa Asiática se celebrará en 2027 en Arabia Saudita. Las clasificaciones están en curso.',
      goldCupMessage: 'La próxima Copa de Oro se celebrará en 2027. Los detalles se anunciarán más adelante.',
      womenFriendlyMessage: 'Los partidos amistosos no tienen clasificación. Consulte los resultados en la pestaña de Partidos.',
      ranking: 'clasificación',
      topScorers: 'Máximos goleadores',
      goals: 'Goles',
      assists: 'Asistencias',
      player: 'Jugador',
      matchesPlayed: 'PJ',
      mlb: 'MLB ⚾',
      nhl: 'NHL 🏒',
      cricket: 'Cricket 🏏',
      motorSport: 'Automovilismo 🏎️',
      mma: 'MMA 🥊',
      boxing: 'Boxeo 🥊',
      motorsports: 'Motociclismo 🏁',
      other: 'Otros 🏈',
      rugby: 'Rugby 🏉',
      otLosses: 'DPR',
      ties: 'E',
      drivers: 'Pilotos',
      constructors: 'Constructores',
      runsFor: 'CA',
      runsAgainst: 'CP',
      goalsFor: 'GF',
      goalsAgainst: 'GC',
      winPctShort: 'PCT',
      streak: 'Racha',
    },
    teamDetail: {
      info: 'Información',
      roster: 'Plantilla',
      schedule: 'Calendario',
      stats: 'Estadísticas',
      stadium: 'Estadio',
      coach: 'Entrenador',
      founded: 'Fundado',
      abbreviation: 'Abreviatura',
      seasonStats: 'Estadísticas de temporada',
      matchesPlayed: 'Partidos jugados',
      victories: 'Victorias',
      draws: 'Empates',
      defeats: 'Derrotas',
      goalsScored: 'Goles a favor',
      goalsConceded: 'Goles en contra',
      goalDiff: 'Dif. de goles',
      avgGoals: 'Prom. goles/partido',
      pointsScored: 'Puntos anotados',
      pointsConceded: 'Puntos recibidos',
      pointDiff: 'Dif. de puntos',
      avgPoints: 'Prom. puntos/partido',
      winPct: '% Victorias',
      form: 'Forma',
      upcoming: 'Próximos',
      finished: 'Finalizados',
      live: 'En vivo',
      home: 'CASA',
      away: 'FUERA',
      otherMatches: 'otros partidos',
      noInfo: 'Información limitada',
      noInfoHint: 'Los datos detallados estarán disponibles pronto',
      noRoster: 'Plantilla no disponible',
      noRosterHint: 'La plantilla se anunciará pronto',
      noSchedule: 'Calendario no disponible',
      noScheduleHint: 'Los partidos se programarán pronto',
      loading: 'Cargando datos...',
      loadError: 'Error al cargar',
      retry: 'Reintentar',
      addFavorite: 'Añadir a favoritos',
      removeFavorite: 'Quitar de favoritos',
      goalkeepers: 'Porteros',
      defenders: 'Defensas',
      midfielders: 'Mediocampistas',
      attackers: 'Delanteros',
      pointGuard: 'Base',
      shootingGuard: 'Escolta',
      smallForward: 'Alero',
      powerForward: 'Ala-pívot',
      center: 'Pívot',
      yearsOld: 'años',
      pitcher: 'Lanzador',
      catcher: 'Receptor',
      baseman: 'Base',
      outfielder: 'Jardinero',
      defenseman: 'Defensa',
      forward: 'Delantero',
      goaltender: 'Portero',
      quarterback: 'Quarterback',
      runningBack: 'Corredor',
      wideReceiver: 'Receptor',
      driver: 'Piloto',
      fighter: 'Luchador',
      weightClass: 'Categoría',
      champion: 'Campeón',
    },
    favorites: {
      title: 'Favoritos',
      myFavorites: 'Mis Favoritos',
      noFavorites: 'Sin favoritos',
      addFavoritesHint: 'Agrega tus equipos y canales favoritos tocando el ícono ❤️ para acceso rápido',
      addFavorites: 'Agregar a favoritos',
      removeFavorites: 'Quitar de favoritos',
      favoriteTeams: 'Equipos favoritos',
      favoriteChannels: 'Canales favoritos',
      teams: 'equipo',
      channels: 'canal',
      noMatches: 'No hay partidos para tus equipos en los próximos 3 días',
      noMatchesDay: 'No hay partidos programados para este día',
      comeBackLater: '¡Vuelve más tarde!',
      savedLocally: 'Tus favoritos se guardan localmente en tu dispositivo',
      tapHeart: 'Toca ❤️',
      quickAccess: 'Acceso rápido',
    },
    search: {
      title: 'Búsqueda global',
      placeholder: 'Buscar partidos, canales, competiciones...',
      noResults: 'No se encontraron resultados',
      matches: 'Partidos',
      channels: 'Canales',
      competitions: 'Competiciones',
      shortcut: 'Ctrl+K',
    },
    channels: {
      title: 'Canales',
      searchPlaceholder: 'Buscar un canal...',
      onlineOnly: 'Solo en línea',
      check: 'Probar',
      checking: 'Verificando...',
      allCountries: 'Todos los países',
      online: 'en línea',
      offline: 'sin conexión',
      untested: 'sin probar',
      noChannels: 'No se encontraron canales',
      tryDisableFilter: 'Intente desactivar el filtro "Solo en línea"',
      adjustFilters: 'Ajuste su búsqueda o filtros',
      showAllChannels: 'Mostrar todos los canales',
      loadMore: 'Cargar más canales',
      channelsFound: 'canal',
      direct: 'EN VIVO',
    },
    notifications: {
      enabled: 'Notificaciones activadas',
      enable: 'Activar notificaciones',
      settings: 'Configuración de notificaciones',
      startsIn: 'empieza en {0} min',
      goal: '¡GOL!',
      title: 'Notificaciones',
      noNotifications: 'Sin notificaciones',
      noNotificationsDesc: 'Las alertas de partidos aparecerán aquí',
      markAllRead: 'Marcar todo como leído',
      clearAll: 'Borrar todo',
      enableNotifs: 'Activar notificaciones',
      openSettings: 'Configuración',
      justNow: 'Ahora mismo',
      minutesAgo: 'hace {0} min',
      hoursAgo: 'hace {0}h',
      settingsTitle: 'Configuración de notificaciones',
      settingsDesc: 'Elija los tipos de notificaciones que desea recibir.',
      matchStart: 'Inicio de partido',
      matchStartDesc: 'Recibir notificación cuando comience un partido',
      goalsPoints: 'Goles y Puntos',
      goalsPointsDesc: 'Recibir notificación cuando se marque un gol o puntos',
      favoriteTeams: 'Equipos favoritos',
      favoriteTeamsDesc: 'Recordatorio cuando se acercan los partidos de sus equipos favoritos',
    },
    offline: {
      message: 'Estás sin conexión — algunos datos pueden estar desactualizados',
    },
    errors: {
      cannotLoad: 'No se puede cargar',
      loadFailed: 'Error al cargar',
      timeout: 'Tiempo de espera agotado',
      invalidResponse: 'Respuesta inválida',
      updateFailed: 'Actualización fallida — datos en caché',
      serverError: 'Error del servidor',
      boundaryTitle: '¡Ups!',
      boundaryMessage: 'Ocurrió un error inesperado. Por favor, intente de nuevo.',
    },
    tracker: {
      timeline: 'Cronología',
      timelineMatch: 'Cronología del partido',
      statistics: 'Estadísticas',
      keyPlayers: 'Jugadores clave',
      lineups: 'Alineaciones',
      startingXI: 'Once inicial',
      substitutes: 'Suplentes',
      formation: 'Formación',
      noLineups: 'Alineaciones no disponibles',
      loadingLineups: 'Cargando alineaciones...',
      posGK: 'Portero',
      posDEF: 'Defensa',
      posMID: 'Centrocampista',
      posFWD: 'Delantero',
      loadingEvents: 'Cargando eventos...',
      loadingStats: 'Cargando estadísticas...',
      loadingPlayers: 'Cargando jugadores clave...',
      statsUnavailable: 'Estadísticas no disponibles',
      playersUnavailable: 'Datos de jugadores no disponibles',
      goal: 'Gol',
      yellowCard: 'Tarjeta amarilla',
      redCard: 'Tarjeta roja',
      substitution: 'Sustitución',
      start: 'Inicio',
      end: 'Fin',
      assist: 'asistencia',
      spectators: 'espectadores',
      referee: 'Árbitro',
      summary: 'Resumen',
      winsMatch: 'gana el partido',
      draw: 'Empate',
      halftime: 'MEDIO TIEMPO',
      eventsWillAppear: 'Los eventos aparecerán aquí en tiempo real',
      liveAtKickoff: 'El seguimiento en vivo estará disponible al inicio',
      noEvents: 'No hay eventos disponibles para este partido',
      autoRefresh: 'Actualización automática cada 15 segundos',
      shots: 'Tiros',
      accuratePasses: 'Pases precisos',
      saves: 'Atajadas',
      cantLoadEvents: 'No se pueden cargar los eventos',
      serverError: 'Error del servidor',
      possession: 'Posesión',
    },
    player: {
      streamUnavailable: 'Stream no disponible — el canal probablemente está fuera de línea',
      playbackError: 'Error de reproducción — este stream no se puede reproducir',
      streamUnavailableShort: 'Stream no disponible',
      hlsNotSupported: 'HLS no soportado por este navegador',
      otherChannels: '+{0} otros canales',
      loadingStream: 'Cargando stream...',
      autoNextChannel: 'Si el canal no carga, se intentará el siguiente automáticamente',
      channelUnavailable: 'Canal no disponible',
      iptvUnstable: 'Los streams IPTV gratuitos suelen ser inestables.',
      retry: 'Reintentar',
      otherChannelsLabel: 'Otros canales:',
      back: 'Volver',
      live: 'EN VIVO',
      liveStream: 'Transmisión en vivo',
      resolvingStream: 'Resolviendo stream...',
      iframeError: 'El stream no se pudo cargar',
      iframeLoadTimeout: 'El stream está tardando demasiado en cargar',
      tryDirectStream: 'Probar stream directo',
      watchElsewhere: 'Ver en otro sitio:',
    },
    stream: {
      watchLive: 'Ver en vivo',
      streamingSites: 'Sitios de streaming',
      directStreams: 'Streams directos',
      searchingStreams: 'Buscando streams...',
      sportStreamDesc: 'Buscar partidos en vivo con enlaces de streaming',
      rojaDirectaDesc: 'Streaming en vivo de fútbol y más',
      youtubeDesc: 'Buscar transmisiones en vivo en YouTube',
      disclaimer: 'Los enlaces redirigen a sitios de terceros. GoalStream no aloja ningún contenido.',
      hesgoalDesc: 'Partidos de fútbol en vivo HD — Premier League, Champions League, La Liga y más',
      hesgoalLive: 'Stream HesGoal en vivo',
      resolvingStream: 'Resolviendo stream...',
      directPlayback: 'Reproducción directa HD en la app',
      embedPlayback: 'Reproducción vía reproductor integrado',
    },
    footer: {
      description: 'Streaming deportivo gratuito vía IPTV',
      streamsFrom: 'Transmisiones de',
      privacyPolicy: 'Política de privacidad',
    },
    privacy: {
      title: 'Política de privacidad',
      lastUpdated: 'Última actualización: Mayo 2026',
      introduction: '1. Introducción',
      introductionContent: 'GoalStream es una aplicación gratuita de seguimiento de partidos deportivos en vivo. Respetamos la privacidad de nuestros usuarios y nos comprometemos a protegerla.',
      dataCollection: '2. Recopilación de datos',
      dataCollectionContent: 'GoalStream no recopila ningún dato personal de sus usuarios. No se requiere registro ni inicio de sesión para utilizar la aplicación.',
      automaticData: '3. Datos recopilados automáticamente',
      automaticDataContent: 'Nuestra aplicación puede recopilar automáticamente ciertos datos técnicos como la dirección IP del dispositivo, el tipo de dispositivo y el sistema operativo, así como datos de navegación anónimos. Estos datos se utilizan únicamente para mejorar el rendimiento de la aplicación y nunca se venden a terceros.',
      notifications: '4. Notificaciones',
      notificationsContent: 'Si el usuario activa las notificaciones, estas se utilizan únicamente para informarle sobre el inicio de los partidos y los goles marcados.',
      contact: '5. Contacto',
      contactContent: 'Para cualquier pregunta sobre esta política de privacidad, los usuarios pueden contactarnos en la dirección a continuación.',
      contactEmail: 'Correo de contacto',
    },
    dates: {
      today: 'Hoy',
      tomorrow: 'Mañana',
      dayAfter: 'Pasado mañana',
      weekdaysShort: ['dom.', 'lun.', 'mar.', 'mié.', 'jue.', 'vie.', 'sáb.'],
      weekdaysLong: ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'],
      monthsLong: ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'],
    },
  },
  pt: {
    nav: {
      matches: 'Jogos',
      basketball: 'Basquete',
      basket: 'Basquete',
      favorites: 'Favoritos',
      channels: 'Canais',
      standings: 'Classificação',
    },
    common: {
      liveSport: 'Esporte ao vivo',
      today: 'Hoje',
      tomorrow: 'Amanhã',
      live: 'Ao vivo',
      finished: 'Encerrado',
      upcoming: 'Em breve',
      loading: 'Carregando',
      retry: 'Tentar novamente',
      offline: 'Offline',
      offlineMode: 'Modo offline',
      install: 'Instalar',
      installApp: 'Instalar app',
      search: 'Buscar',
      update: 'Atu',
      showMore: 'Ver mais',
      showLess: 'Ver menos',
      all: 'Tudo',
      more: 'mais',
      confirm: 'Confirmar',
      cancel: 'Cancelar',
      clearAll: 'Limpar tudo',
      vs: 'VS',
      allCompetitions: 'Todas as competições',
      lightMode: 'Modo claro',
      darkMode: 'Modo escuro',
      nextMatch: 'Próximo jogo',
      nextMatchIn: 'Próximo jogo em',
      noMatchesNow: 'Nenhum jogo no momento',
      checkBackLater: 'Volte mais tarde para os próximos jogos!',
      loadingMatches: 'Carregando jogos...',
      otherMatches: 'outros jogos',
      yesterday: 'Ontem',
      pickDate: 'Escolher data',
      noMatchesDay: 'Nenhum jogo programado neste dia',
      showFinishedMatches: 'Mostrar jogos finalizados',
      hideFinishedMatches: 'Ocultar jogos finalizados',
      liveNow: 'Ao vivo agora',
      todayUpcoming: 'A seguir hoje',
      dayMatches: 'Jogos do dia',
      finishedMatches: 'Jogos finalizados',
      upcomingMatches: 'Próximos jogos',
    },
    match: {
      min: 'min',
      ht: 'INT',
      firstHalf: '1º Tempo',
      secondHalf: '2º Tempo',
      extraTime: 'PROR',
      watchLive: 'Assistir ao vivo',
      watch: 'Assistir',
      seeSummary: 'Ver resumo',
      followMatch: 'Acompanhar jogo',
      follow: 'Acompanhar',
      finished: 'Jogo encerrado',
      startsIn: 'Começa em {0} min',
      searching: 'Buscando...',
      noChannelFound: 'Nenhum canal encontrado para este jogo',
      noChannelRetry: 'Nenhum canal encontrado — tente novamente',
      searchTooLong: 'Busca demorando muito — tente novamente',
      liveBroadcast: 'Transmissão ao vivo',
      broadcastOn: 'Transmitido por',
      liveStreamAvailable: 'Transmissão ao vivo disponível ({0} streams)',
      friendly: 'Amistoso',
      share: 'Compartilhar',
      copied: 'Copiado!',
      highlights: 'Melhores momentos',
      externalSources: 'Fontes externas',
    },
    basketball: {
      q1: 'Q1',
      q2: 'Q2',
      q3: 'Q3',
      q4: 'Q4',
      ot: 'PROR',
      firstHalf: '1º Tempo',
      secondHalf: '2º Tempo',
    },
    football: {
      halftime: 'Intervalo',
      secondHalf: '2º Tempo',
    },
    standings: {
      title: 'Classificações',
      championships: 'Campeonatos',
      clubCups: 'Copas de Clubes',
      nationalTeams: 'Seleções',
      women: 'Feminino',
      basketball: 'Basquetebol',
      fifaRanking: 'Ranking FIFA',
      worldCup: 'Copa do Mundo',
      team: 'Time',
      played: 'J',
      won: 'V',
      drawn: 'E',
      lost: 'D',
      points: 'Pts',
      teams: 'times',
      clickTeam: 'Clique em um time',
      championsLeague: 'Champions League',
      europaConf: 'Europa / Conf.',
      relegation: 'Rebaixamento',
      qualified: 'Classificado próxima rodada',
      playoffs: 'Playoffs',
      playIn: 'Play-In',
      eliminated: 'Eliminado',
      top10: 'Top 10',
      top20: 'Top 20',
      wins: 'V',
      losses: 'D',
      winPct: 'PCT',
      gamesBehind: 'GB',
      loadingStandings: 'Carregando classificações',
      fetchingData: 'Obtendo dados...',
      updating: 'Atualizando...',
      loadingLeague: 'Carregando...',
      loadError: 'Erro ao carregar {0}',
      schedule: 'Calendário',
      qualifiedTeams: 'Times classificados',
      showNextTeams: 'Ver os {0} próximos times',
      otherTeams: 'Ver mais {0} times',
      barrages: 'Playoffs',
      dataUnavailable: 'Dados ainda não disponíveis para esta competição. Tente novamente em alguns minutos.',
      competitionPaused: 'Dados de {0} não estão disponíveis no momento. A competição pode estar entre fases.',
      groupsNotFormed: 'Os grupos ainda não foram formados para a próxima edição.',
      worldCupMessage: 'A Copa do Mundo FIFA 2026 será realizada de 11 de junho a 19 de julho nos Estados Unidos, Canadá e México. Confira as partidas para acompanhar os resultados ao vivo.',
      copaAmericaMessage: 'A próxima Copa América será em 2028. Os grupos serão anunciados posteriormente.',
      asianCupMessage: 'A próxima Copa da Ásia será em 2027 na Arábia Saudita. As eliminatórias estão em andamento.',
      goldCupMessage: 'A próxima Copa Ouro será em 2027. Os detalhes serão anunciados posteriormente.',
      womenFriendlyMessage: 'Jogos amigáveis não têm classificação. Confira os resultados na aba de Jogos.',
      ranking: 'classificação',
      topScorers: 'Artilheiros',
      goals: 'Gols',
      assists: 'Assistências',
      player: 'Jogador',
      matchesPlayed: 'JJ',
      mlb: 'MLB ⚾',
      nhl: 'NHL 🏒',
      cricket: 'Críquete 🏏',
      motorSport: 'Automobilismo 🏎️',
      mma: 'MMA 🥊',
      boxing: 'Boxe 🥊',
      motorsports: 'Motociclismo 🏁',
      other: 'Outros 🏈',
      rugby: 'Rugby 🏉',
      otLosses: 'DPP',
      ties: 'E',
      drivers: 'Pilotos',
      constructors: 'Construtores',
      runsFor: 'RC',
      runsAgainst: 'RS',
      goalsFor: 'GP',
      goalsAgainst: 'GC',
      winPctShort: 'PCT',
      streak: 'Sequência',
    },
    teamDetail: {
      info: 'Informações',
      roster: 'Elenco',
      schedule: 'Calendário',
      stats: 'Estatísticas',
      stadium: 'Estádio',
      coach: 'Treinador',
      founded: 'Fundado',
      abbreviation: 'Abreviação',
      seasonStats: 'Estatísticas da temporada',
      matchesPlayed: 'Jogos disputados',
      victories: 'Vitórias',
      draws: 'Empates',
      defeats: 'Derrotas',
      goalsScored: 'Gols marcados',
      goalsConceded: 'Gols sofridos',
      goalDiff: 'Saldo de gols',
      avgGoals: 'Média gols/jogo',
      pointsScored: 'Pontos marcados',
      pointsConceded: 'Pontos sofridos',
      pointDiff: 'Saldo de pontos',
      avgPoints: 'Média pontos/jogo',
      winPct: '% Vitórias',
      form: 'Forma',
      upcoming: 'Próximos',
      finished: 'Finalizados',
      live: 'Ao vivo',
      home: 'CASA',
      away: 'FORA',
      otherMatches: 'outros jogos',
      noInfo: 'Informações limitadas',
      noInfoHint: 'Dados detalhados estarão disponíveis em breve',
      noRoster: 'Elenco indisponível',
      noRosterHint: 'O elenco será anunciado em breve',
      noSchedule: 'Calendário indisponível',
      noScheduleHint: 'Os jogos serão agendados em breve',
      loading: 'Carregando dados...',
      loadError: 'Falha ao carregar',
      retry: 'Tentar novamente',
      addFavorite: 'Adicionar aos favoritos',
      removeFavorite: 'Remover dos favoritos',
      goalkeepers: 'Goleiros',
      defenders: 'Zagueiros',
      midfielders: 'Meio-campistas',
      attackers: 'Atacantes',
      pointGuard: 'Armador',
      shootingGuard: 'Ala-armador',
      smallForward: 'Ala',
      powerForward: 'Ala-pivô',
      center: 'Pivô',
      yearsOld: 'anos',
      pitcher: 'Arremessador',
      catcher: 'Receptor',
      baseman: 'Base',
      outfielder: 'Externo',
      defenseman: 'Zagueiro',
      forward: 'Atacante',
      goaltender: 'Goleiro',
      quarterback: 'Quarterback',
      runningBack: 'Corredor',
      wideReceiver: 'Receptor',
      driver: 'Piloto',
      fighter: 'Lutador',
      weightClass: 'Categoria',
      champion: 'Campeão',
    },
    favorites: {
      title: 'Favoritos',
      myFavorites: 'Meus Favoritos',
      noFavorites: 'Sem favoritos',
      addFavoritesHint: 'Adicione seus times e canais favoritos tocando no ícone ❤️ para acesso rápido',
      addFavorites: 'Adicionar aos favoritos',
      removeFavorites: 'Remover dos favoritos',
      favoriteTeams: 'Times favoritos',
      favoriteChannels: 'Canais favoritos',
      teams: 'time',
      channels: 'canal',
      noMatches: 'Nenhum jogo previsto para seus times nos próximos 3 dias',
      noMatchesDay: 'Nenhum jogo programado para este dia',
      comeBackLater: 'Volte mais tarde!',
      savedLocally: 'Seus favoritos são salvos localmente no seu dispositivo',
      tapHeart: 'Toque em ❤️',
      quickAccess: 'Acesso rápido',
    },
    search: {
      title: 'Busca global',
      placeholder: 'Buscar jogos, canais, competições...',
      noResults: 'Nenhum resultado encontrado',
      matches: 'Jogos',
      channels: 'Canais',
      competitions: 'Competições',
      shortcut: 'Ctrl+K',
    },
    channels: {
      title: 'Canais',
      searchPlaceholder: 'Buscar um canal...',
      onlineOnly: 'Somente online',
      check: 'Testar',
      checking: 'Verificando...',
      allCountries: 'Todos os países',
      online: 'online',
      offline: 'offline',
      untested: 'não testado',
      noChannels: 'Nenhum canal encontrado',
      tryDisableFilter: 'Tente desativar o filtro "Somente online"',
      adjustFilters: 'Ajuste sua busca ou filtros',
      showAllChannels: 'Mostrar todos os canais',
      loadMore: 'Carregar mais canais',
      channelsFound: 'canal',
      direct: 'AO VIVO',
    },
    notifications: {
      enabled: 'Notificações ativadas',
      enable: 'Ativar notificações',
      settings: 'Configurações de notificação',
      startsIn: 'começa em {0} min',
      goal: 'GOL!',
      title: 'Notificações',
      noNotifications: 'Sem notificações',
      noNotificationsDesc: 'Os alertas de jogos aparecerão aqui',
      markAllRead: 'Marcar tudo como lido',
      clearAll: 'Limpar tudo',
      enableNotifs: 'Ativar notificações',
      openSettings: 'Configurações',
      justNow: 'Agora mesmo',
      minutesAgo: 'há {0} min',
      hoursAgo: 'há {0}h',
      settingsTitle: 'Configurações de notificação',
      settingsDesc: 'Escolha os tipos de notificações que deseja receber.',
      matchStart: 'Início do jogo',
      matchStartDesc: 'Receber notificação quando um jogo começar',
      goalsPoints: 'Gols e Pontos',
      goalsPointsDesc: 'Receber notificação quando um gol ou pontos forem marcados',
      favoriteTeams: 'Times favoritos',
      favoriteTeamsDesc: 'Lembrete quando os jogos dos seus times favoritos estiverem se aproximando',
    },
    offline: {
      message: 'Você está offline — alguns dados podem estar desatualizados',
    },
    errors: {
      cannotLoad: 'Não foi possível carregar',
      loadFailed: 'Falha ao carregar',
      timeout: 'Tempo de espera esgotado',
      invalidResponse: 'Resposta inválida',
      updateFailed: 'Atualização falhou — dados em cache',
      serverError: 'Erro do servidor',
      boundaryTitle: 'Ops!',
      boundaryMessage: 'Ocorreu um erro inesperado. Por favor, tente novamente.',
    },
    tracker: {
      timeline: 'Cronologia',
      timelineMatch: 'Cronologia do jogo',
      statistics: 'Estatísticas',
      keyPlayers: 'Jogadores-chave',
      lineups: 'Escalações',
      startingXI: 'Titulares',
      substitutes: 'Reservas',
      formation: 'Formação',
      noLineups: 'Escalações indisponíveis',
      loadingLineups: 'Carregando escalações...',
      posGK: 'Goleiro',
      posDEF: 'Zagueiro',
      posMID: 'Meio-campo',
      posFWD: 'Atacante',
      loadingEvents: 'Carregando eventos...',
      loadingStats: 'Carregando estatísticas...',
      loadingPlayers: 'Carregando jogadores-chave...',
      statsUnavailable: 'Estatísticas indisponíveis',
      playersUnavailable: 'Dados dos jogadores indisponíveis',
      goal: 'Gol',
      yellowCard: 'Cartão amarelo',
      redCard: 'Cartão vermelho',
      substitution: 'Substituição',
      start: 'Início',
      end: 'Fim',
      assist: 'assistência',
      spectators: 'espectadores',
      referee: 'Árbitro',
      summary: 'Resumo',
      winsMatch: 'vence o jogo',
      draw: 'Empate',
      halftime: 'INTERVALO',
      eventsWillAppear: 'Os eventos aparecerão aqui em tempo real',
      liveAtKickoff: 'O acompanhamento ao vivo estará disponível no início do jogo',
      noEvents: 'Nenhum evento disponível para este jogo',
      autoRefresh: 'Atualização automática a cada 15 segundos',
      shots: 'Chutes',
      accuratePasses: 'Passes precisos',
      saves: 'Defesas',
      cantLoadEvents: 'Não foi possível carregar os eventos',
      serverError: 'Erro do servidor',
      possession: 'Posse de bola',
    },
    player: {
      streamUnavailable: 'Stream indisponível — canal provavelmente offline',
      playbackError: 'Erro de reprodução — este stream não pode ser reproduzido',
      streamUnavailableShort: 'Stream indisponível',
      hlsNotSupported: 'HLS não suportado por este navegador',
      otherChannels: '+{0} outros canais',
      loadingStream: 'Carregando stream...',
      autoNextChannel: 'Se o canal não carregar, tentaremos o próximo automaticamente',
      channelUnavailable: 'Canal indisponível',
      iptvUnstable: 'Streams IPTV gratuitos costumam ser instáveis.',
      retry: 'Tentar novamente',
      otherChannelsLabel: 'Outros canais:',
      back: 'Voltar',
      live: 'AO VIVO',
      liveStream: 'Transmissão ao vivo',
      resolvingStream: 'Resolvendo stream...',
      iframeError: 'O stream não pôde ser carregado',
      iframeLoadTimeout: 'O stream está demorando muito para carregar',
      tryDirectStream: 'Tentar stream direto',
      watchElsewhere: 'Assistir em outro site:',
    },
    stream: {
      watchLive: 'Assistir ao vivo',
      streamingSites: 'Sites de streaming',
      directStreams: 'Streams diretos',
      searchingStreams: 'Procurando streams...',
      sportStreamDesc: 'Pesquisar jogos ao vivo com links de streaming',
      rojaDirectaDesc: 'Streaming ao vivo de futebol e mais',
      youtubeDesc: 'Pesquisar transmissões ao vivo no YouTube',
      disclaimer: 'Os links redirecionam para sites de terceiros. GoalStream não hospeda nenhum conteúdo.',
      hesgoalDesc: 'Jogos de futebol ao vivo em HD — Premier League, Champions League, La Liga e mais',
      hesgoalLive: 'Stream HesGoal ao vivo',
      resolvingStream: 'Resolvendo stream...',
      directPlayback: 'Reprodução direta HD no app',
      embedPlayback: 'Reprodução via player integrado',
    },
    footer: {
      description: 'Streaming esportivo gratuito via IPTV',
      streamsFrom: 'Transmissões de',
      privacyPolicy: 'Política de privacidade',
    },
    privacy: {
      title: 'Política de privacidade',
      lastUpdated: 'Última atualização: Maio 2026',
      introduction: '1. Introdução',
      introductionContent: 'GoalStream é um aplicativo gratuito de acompanhamento de partidas esportivas ao vivo. Respeitamos a privacidade de nossos usuários e nos comprometemos a protegê-la.',
      dataCollection: '2. Coleta de dados',
      dataCollectionContent: 'GoalStream não coleta nenhum dado pessoal de seus usuários. Nenhum registro ou login é necessário para usar o aplicativo.',
      automaticData: '3. Dados coletados automaticamente',
      automaticDataContent: 'Nosso aplicativo pode coletar automaticamente certos dados técnicos como o endereço IP do dispositivo, tipo de dispositivo e sistema operacional, além de dados de navegação anônimos. Esses dados são usados exclusivamente para melhorar o desempenho do aplicativo e nunca são vendidos a terceiros.',
      notifications: '4. Notificações',
      notificationsContent: 'Se o usuário ativar as notificações, elas serão usadas exclusivamente para informá-lo sobre o início das partidas e os gols marcados.',
      contact: '5. Contato',
      contactContent: 'Para qualquer pergunta sobre esta política de privacidade, os usuários podem nos contatar no endereço abaixo.',
      contactEmail: 'E-mail de contato',
    },
    dates: {
      today: 'Hoje',
      tomorrow: 'Amanhã',
      dayAfter: 'Depois de amanhã',
      weekdaysShort: ['dom.', 'seg.', 'ter.', 'qua.', 'qui.', 'sex.', 'sáb.'],
      weekdaysLong: ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'],
      monthsLong: ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'],
    },
  },
};
