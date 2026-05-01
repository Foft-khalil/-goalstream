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
    comeBackLater: string;
    savedLocally: string;
    tapHeart: string;
    quickAccess: string;
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
  };
  footer: {
    description: string;
    streamsFrom: string;
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
      comeBackLater: 'Revenez plus tard !',
      savedLocally: 'Vos favoris sont sauvegardés localement sur votre appareil',
      tapHeart: 'Appuyez sur ❤️',
      quickAccess: 'Accès rapide',
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
    },
    footer: {
      description: 'Streaming sportif gratuit via IPTV',
      streamsFrom: 'Flux issus de',
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
      comeBackLater: 'Come back later!',
      savedLocally: 'Your favorites are saved locally on your device',
      tapHeart: 'Tap ❤️',
      quickAccess: 'Quick access',
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
    },
    footer: {
      description: 'Free sports streaming via IPTV',
      streamsFrom: 'Streams from',
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
      comeBackLater: 'عد لاحقاً!',
      savedLocally: 'يتم حفظ مفضلاتك محلياً على جهازك',
      tapHeart: 'اضغط على ❤️',
      quickAccess: 'وصول سريع',
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
    },
    footer: {
      description: 'بث رياضي مجاني عبر IPTV',
      streamsFrom: 'البث من',
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
      comeBackLater: '¡Vuelve más tarde!',
      savedLocally: 'Tus favoritos se guardan localmente en tu dispositivo',
      tapHeart: 'Toca ❤️',
      quickAccess: 'Acceso rápido',
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
    },
    footer: {
      description: 'Streaming deportivo gratuito vía IPTV',
      streamsFrom: 'Transmisiones de',
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
      comeBackLater: 'Volte mais tarde!',
      savedLocally: 'Seus favoritos são salvos localmente no seu dispositivo',
      tapHeart: 'Toque em ❤️',
      quickAccess: 'Acesso rápido',
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
    },
    footer: {
      description: 'Streaming esportivo gratuito via IPTV',
      streamsFrom: 'Transmissões de',
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
