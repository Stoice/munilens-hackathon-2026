export type Language = 'en' | 'af' | 'xh' | 'zu';

export type TranslationKeys = {
  // Nav
  'nav.report': string;
  'nav.dashboard': string;
  'nav.map': string;
  // Home hero
  'hero.titleBefore': string;
  'hero.titleHighlight': string;
  'hero.subtitle': string;
  'hero.cta': string;
  'hero.signInPrompt': string;
  // Home features
  'feature.snap.title': string;
  'feature.snap.desc': string;
  'feature.route.title': string;
  'feature.route.desc': string;
  'feature.insights.title': string;
  'feature.insights.desc': string;
  // Footer
  'footer.hackathon': string;
  'footer.copyright': string;
  // Auth
  'auth.signIn': string;
  'auth.signUp': string;
  'auth.signOut': string;
  'auth.email': string;
  'auth.password': string;
  'auth.firstName': string;
  'auth.lastName': string;
  'auth.phone': string;
  'auth.province': string;
  'auth.selectProvince': string;
  'auth.googleContinue': string;
  'auth.or': string;
  'auth.haveAccount': string;
  'auth.noAccount': string;
  'auth.welcomeBack': string;
  'auth.createAccount': string;
  // Report Form
  'report.fieldUnit': string;
  'report.gpsLocked': string;
  'report.gpsSearching': string;
  'report.offline': string;
  'report.lowAccuracy': string;
  'report.capturing': string;
  'report.capture': string;
  'report.retake': string;
  'report.analyzing': string;
  'report.description': string;
  'report.descPlaceholder': string;
  'report.submit': string;
  'report.submitting': string;
  'report.category': string;
  'report.urgency': string;
  'report.routedTo': string;
  'report.estimatedSolution': string;
  'report.success.title': string;
  'report.success.message': string;
  'report.success.reportAnother': string;
  'report.success.officialFeedback': string;
  'report.disabled.title': string;
  'report.disabled.message': string;
  // Status pages
  'status.unauthorized.title': string;
  'status.unauthorized.message': string;
  'status.unauthorized.returnHome': string;
  'status.suspended.title': string;
  'status.suspended.message': string;
  'status.suspended.signOut': string;
  'status.suspended.backHome': string;
  // Citizen score card
  'score.yourScore': string;
  'score.totalPoints': string;
  'score.clickCategory': string;
  'score.pointsKey': string;
  'score.potholes': string;
  'score.waterLeaks': string;
  'score.electricalDamage': string;
  'score.other': string;
  'score.yourReports': string;
  'score.categoryTotal': string;
  'score.pts': string;
  'score.report': string;
  'score.reports': string;
  // Language names
  'lang.en': string;
  'lang.af': string;
  'lang.xh': string;
  'lang.zu': string;
  // Dashboard
  'dash.municipalControl': string;
  'dash.overview': string;
  'dash.mapView': string;
  'dash.leaderboard': string;
  'dash.notifications': string;
  'dash.userManagement': string;
  'dash.dashboardOverview': string;
  'dash.systemOperational': string;
  'dash.activeReports': string;
  'dash.generateAiReport': string;
  'dash.totalReports': string;
  'dash.activeIssues': string;
  'dash.resolved': string;
  'dash.topCategory': string;
  'dash.faultDistribution': string;
  'dash.statusBreakdown': string;
  'dash.importanceLevels': string;
  'dash.aiOperationalBriefing': string;
  'dash.executiveSummary': string;
  'dash.priorityActions': string;
  'dash.trendInsights': string;
  'dash.strategicRecommendations': string;
  'dash.exportPdf': string;
  'dash.recentReports': string;
  'dash.liveFeed': string;
  'dash.filterStatus': string;
  'dash.filterImportance': string;
  'dash.filterType': string;
  'dash.allStatuses': string;
  'dash.allImportance': string;
  'dash.allTypes': string;
  'dash.colType': string;
  'dash.colImportance': string;
  'dash.colStatus': string;
  'dash.colLocation': string;
  'dash.colDate': string;
  'dash.colReporter': string;
  'dash.colAction': string;
  'dash.descriptionSnippet': string;
  'dash.quickUpdate': string;
  'dash.open': string;
  'dash.inProgress': string;
  'dash.solved': string;
  'dash.updating': string;
  'dash.updateStatus': string;
  'dash.fullDetails': string;
  'dash.close': string;
  'dash.breakdown': string;
  'dash.noReports': string;
  'dash.locationData': string;
  'dash.reporterInfo': string;
  'dash.routedTo': string;
  'dash.estimatedSolution': string;
  'dash.fieldDescription': string;
  'dash.pendingAssignment': string;
  'dash.addressNotAvailable': string;
  'dash.noDescriptionProvided': string;
  'dash.generatingReport': string;
  // UserManagement
  'users.title': string;
  'users.searchPlaceholder': string;
  'users.colUser': string;
  'users.colContact': string;
  'users.colProvince': string;
  'users.colRole': string;
  'users.colStatus': string;
  'users.colActions': string;
  'users.active': string;
  'users.disabled': string;
  'users.disable': string;
  'users.enable': string;
  'users.confirmAction': string;
  'users.confirmQuestion': string;
  'users.adminWarning': string;
  'users.cancel': string;
  'users.confirm': string;
  'users.anonymous': string;
  // Notifications
  'notif.title': string;
  'notif.liveFeed': string;
  'notif.total': string;
  'notif.unread': string;
  'notif.markAllRead': string;
  'notif.criticalAlert': string;
  'notif.highPriority': string;
  'notif.newReport': string;
  'notif.emptyTitle': string;
  'notif.emptyDesc': string;
  'notif.view': string;
  'notif.dismiss': string;
  // Leaderboard
  'lb.title': string;
  'lb.scoringActive': string;
  'lb.reportersRanked': string;
  'lb.fullRankings': string;
  'lb.scoringKey': string;
  'lb.noReportsYet': string;
  'lb.colRank': string;
  'lb.colUsername': string;
  'lb.colTotalPoints': string;
  'lb.colTotalReports': string;
  'lb.colPotholes': string;
  'lb.colWaterLeaks': string;
  'lb.colElectricalDamage': string;
  'lb.colOther': string;
  'lb.categoryTotal': string;
  'lb.pts': string;
  'lb.report': string;
  'lb.reports': string;
  'lb.potholes': string;
  'lb.waterLeaks': string;
  'lb.electricalDamage': string;
  'lb.otherReports': string;
  // Map
  'map.reports': string;
  'map.aggregate': string;
  'map.filters': string;
  'map.inProgress': string;
  'map.resolved': string;
  'map.critical': string;
  'map.clear': string;
  'map.satellite': string;
  'map.street': string;
  'map.locate': string;
  'map.liveFaultMap': string;
  'map.aggregateView': string;
  'map.results': string;
  'map.result': string;
  'map.high': string;
  'map.medium': string;
  'map.low': string;
  'map.2d': string;
  'map.3d': string;
};

export const translations: Record<Language, TranslationKeys> = {
  en: {
    'nav.report': 'Report',
    'nav.dashboard': 'Dashboard',
    'nav.map': 'Map',
    'hero.titleBefore': 'Fix your city with',
    'hero.titleHighlight': 'AI.',
    'hero.subtitle': 'MuniLens uses computer vision to instantly classify municipal faults. Report potholes, leaks, and outages in seconds.',
    'hero.cta': 'Start Reporting Now',
    'hero.signInPrompt': 'Sign in to start reporting',
    'feature.snap.title': 'Snap a Photo',
    'feature.snap.desc': 'AI identifies the fault type instantly using computer vision.',
    'feature.route.title': 'Auto-Route',
    'feature.route.desc': 'Reports go directly to the correct municipal department.',
    'feature.insights.title': 'Smart Insights',
    'feature.insights.desc': 'Managers get AI-written summaries to prioritize repairs.',
    'footer.hackathon': 'MICT SETA 2026 Hackathon Submission',
    'footer.copyright': '© 2026 MuniLens. Built for South African Municipalities.',
    'auth.signIn': 'Sign In',
    'auth.signUp': 'Sign Up',
    'auth.signOut': 'Sign Out',
    'auth.email': 'Email Address',
    'auth.password': 'Password',
    'auth.firstName': 'First Name',
    'auth.lastName': 'Last Name',
    'auth.phone': 'Phone Number',
    'auth.province': 'Province',
    'auth.selectProvince': 'Select Province',
    'auth.googleContinue': 'Continue with Google',
    'auth.or': 'or',
    'auth.haveAccount': 'Already have an account?',
    'auth.noAccount': "Don't have an account?",
    'auth.welcomeBack': 'Welcome Back',
    'auth.createAccount': 'Create Account',
    'report.fieldUnit': 'Field Unit v1.0',
    'report.gpsLocked': 'GPS_LOCKED',
    'report.gpsSearching': 'GPS_SEARCHING',
    'report.offline': 'OFFLINE_MODE: Reports will sync automatically.',
    'report.lowAccuracy': 'LOW_GPS_ACCURACY: Move to open area.',
    'report.capturing': 'Capturing...',
    'report.capture': 'Capture Photo',
    'report.retake': 'Retake',
    'report.analyzing': 'AI Analyzing...',
    'report.description': 'Description (optional)',
    'report.descPlaceholder': 'Briefly describe the issue...',
    'report.submit': 'Transmit Report',
    'report.submitting': 'Transmitting...',
    'report.category': 'Category',
    'report.urgency': 'Urgency',
    'report.routedTo': 'Routed To',
    'report.estimatedSolution': 'Estimated Solution',
    'report.success.title': 'Report Submitted!',
    'report.success.message': 'Thank you for helping improve our city. Your report has been successfully transmitted.',
    'report.success.reportAnother': 'Report Another Issue',
    'report.success.officialFeedback': 'Official Feedback',
    'report.disabled.title': 'Account Disabled',
    'report.disabled.message': 'Your access to MuniLens has been restricted by a system administrator. If you believe this is an error, please contact support.',
    'status.unauthorized.title': 'Access Denied',
    'status.unauthorized.message': 'You do not have the required permissions to view this page. This area is restricted to administrative personnel only.',
    'status.unauthorized.returnHome': 'Return Home',
    'status.suspended.title': 'Account Suspended',
    'status.suspended.message': 'Your account has been temporarily disabled by the municipal administrator. Please contact support if you believe this is an error.',
    'status.suspended.signOut': 'Sign Out',
    'status.suspended.backHome': 'Back to Home',
    'score.yourScore': 'Your Score',
    'score.totalPoints': 'Total Points',
    'score.clickCategory': 'Click a category to see your reports',
    'score.pointsKey': 'Critical=10 · High=5 · Medium=3 · Low=2 pts',
    'score.potholes': 'Potholes',
    'score.waterLeaks': 'Water Leaks',
    'score.electricalDamage': 'Electrical Damage',
    'score.other': 'Other',
    'score.yourReports': 'Your Reports',
    'score.categoryTotal': 'Category Total',
    'score.pts': 'pts',
    'score.report': 'report',
    'score.reports': 'reports',
    'lang.en': 'English',
    'lang.af': 'Afrikaans',
    'lang.xh': 'IsiXhosa',
    'lang.zu': 'IsiZulu',
    // Dashboard
    'dash.municipalControl': 'Municipal Control',
    'dash.overview': 'Overview',
    'dash.mapView': 'Map View',
    'dash.leaderboard': 'Leaderboard',
    'dash.notifications': 'Notifications',
    'dash.userManagement': 'User Management',
    'dash.dashboardOverview': 'Dashboard Overview',
    'dash.systemOperational': 'SYSTEM_STATUS: OPERATIONAL',
    'dash.activeReports': 'ACTIVE_REPORTS',
    'dash.generateAiReport': 'Generate AI Insight Report',
    'dash.totalReports': 'Total Reports',
    'dash.activeIssues': 'Active Issues',
    'dash.resolved': 'Resolved',
    'dash.topCategory': 'Top Category',
    'dash.faultDistribution': 'Fault Distribution',
    'dash.statusBreakdown': 'Status Breakdown',
    'dash.importanceLevels': 'Importance Levels',
    'dash.aiOperationalBriefing': 'AI Operational Briefing',
    'dash.executiveSummary': 'Executive Summary',
    'dash.priorityActions': 'Priority Actions',
    'dash.trendInsights': 'Trend Insights',
    'dash.strategicRecommendations': 'Strategic Recommendations',
    'dash.exportPdf': 'Export PDF',
    'dash.recentReports': 'Recent Reports',
    'dash.liveFeed': 'LIVE_FEED',
    'dash.filterStatus': 'Status',
    'dash.filterImportance': 'Importance',
    'dash.filterType': 'Type',
    'dash.allStatuses': 'All Statuses',
    'dash.allImportance': 'All Importance',
    'dash.allTypes': 'All Types',
    'dash.colType': 'Type',
    'dash.colImportance': 'Importance',
    'dash.colStatus': 'Status',
    'dash.colLocation': 'Location',
    'dash.colDate': 'Date',
    'dash.colReporter': 'Reporter',
    'dash.colAction': 'Action',
    'dash.descriptionSnippet': 'Description Snippet',
    'dash.quickUpdate': 'Quick Update',
    'dash.open': 'Open',
    'dash.inProgress': 'In Progress',
    'dash.solved': 'Solved',
    'dash.updating': 'Updating...',
    'dash.updateStatus': 'Update Status',
    'dash.fullDetails': 'Full Details',
    'dash.close': 'Close',
    'dash.breakdown': 'Breakdown',
    'dash.noReports': 'No reports',
    'dash.locationData': 'Location Data',
    'dash.reporterInfo': 'Reporter Info',
    'dash.routedTo': 'Routed To',
    'dash.estimatedSolution': 'Estimated Solution',
    'dash.fieldDescription': 'Field Description',
    'dash.pendingAssignment': 'Pending Assignment',
    'dash.addressNotAvailable': 'Address not available',
    'dash.noDescriptionProvided': 'No description provided by the citizen.',
    'dash.generatingReport': 'Generating AI Report...',
    // UserManagement
    'users.title': 'User Management',
    'users.searchPlaceholder': 'Search users...',
    'users.colUser': 'User',
    'users.colContact': 'Contact',
    'users.colProvince': 'Province',
    'users.colRole': 'Role',
    'users.colStatus': 'Status',
    'users.colActions': 'Actions',
    'users.active': 'Active',
    'users.disabled': 'Disabled',
    'users.disable': 'Disable',
    'users.enable': 'Enable',
    'users.confirmAction': 'Confirm Action',
    'users.confirmQuestion': 'Are you sure you want to',
    'users.adminWarning': 'Warning: This will remove administrative privileges.',
    'users.cancel': 'Cancel',
    'users.confirm': 'Confirm',
    'users.anonymous': 'Anonymous',
    // Notifications
    'notif.title': 'Notifications',
    'notif.liveFeed': 'FEED: LIVE',
    'notif.total': 'TOTAL',
    'notif.unread': 'UNREAD',
    'notif.markAllRead': 'Mark all as read',
    'notif.criticalAlert': 'CRITICAL ALERT',
    'notif.highPriority': 'HIGH PRIORITY',
    'notif.newReport': 'NEW REPORT',
    'notif.emptyTitle': 'No notifications yet.',
    'notif.emptyDesc': 'New reports will appear here as they come in.',
    'notif.view': 'View',
    'notif.dismiss': 'Dismiss',
    // Leaderboard
    'lb.title': 'Leaderboard',
    'lb.scoringActive': 'SCORING_ENGINE: ACTIVE',
    'lb.reportersRanked': 'REPORTERS RANKED',
    'lb.fullRankings': 'Full Rankings',
    'lb.scoringKey': 'Critical=10 · High=5 · Medium=3 · Low=2 · click category count to drill down',
    'lb.noReportsYet': 'No reports yet. Be the first to earn points!',
    'lb.colRank': 'Rank',
    'lb.colUsername': 'Username',
    'lb.colTotalPoints': 'Total Points',
    'lb.colTotalReports': 'Total Reports',
    'lb.colPotholes': 'Potholes',
    'lb.colWaterLeaks': 'Water Leaks',
    'lb.colElectricalDamage': 'Electrical Damage',
    'lb.colOther': 'Other',
    'lb.categoryTotal': 'Category Total',
    'lb.pts': 'pts',
    'lb.report': 'report',
    'lb.reports': 'reports',
    'lb.potholes': 'Potholes',
    'lb.waterLeaks': 'Water Leaks',
    'lb.electricalDamage': 'Electrical Damage',
    'lb.otherReports': 'Other Reports',
    // Map
    'map.reports': 'Reports',
    'map.aggregate': 'Aggregate',
    'map.filters': 'Filters:',
    'map.inProgress': 'In Progress',
    'map.resolved': 'Resolved',
    'map.critical': 'Critical',
    'map.clear': 'Clear',
    'map.satellite': 'Satellite',
    'map.street': 'Street',
    'map.locate': 'Locate',
    'map.liveFaultMap': 'Live Fault Map',
    'map.aggregateView': 'Aggregate View',
    'map.results': 'results',
    'map.result': 'result',
    'map.high': 'High',
    'map.medium': 'Medium',
    'map.low': 'Low',
    'map.2d': '2D',
    'map.3d': '3D',
  },

  af: {
    'nav.report': 'Rapporteer',
    'nav.dashboard': 'Paneelbord',
    'nav.map': 'Kaart',
    'hero.titleBefore': 'Herstel jou stad met',
    'hero.titleHighlight': 'KI.',
    'hero.subtitle': 'MuniLens gebruik rekenaarvisie om munisipale foute onmiddellik te klassifiseer. Meld slaggatte, lekkasies en onderbrekings binne sekondes.',
    'hero.cta': 'Begin Nou Rapporteer',
    'hero.signInPrompt': 'Meld aan om te begin rapporteer',
    'feature.snap.title': "Maak 'n Foto",
    'feature.snap.desc': 'KI identifiseer die fouttipe onmiddellik met rekenaarvisie.',
    'feature.route.title': 'Outo-Roeteer',
    'feature.route.desc': 'Verslae gaan direk na die korrekte munisipale departement.',
    'feature.insights.title': 'Slim Insigte',
    'feature.insights.desc': "Bestuurders kry KI-geskrewe opsommings om herstelwerk te prioritiseer.",
    'footer.hackathon': 'MICT SETA 2026 Hackathon Inskrywing',
    'footer.copyright': '© 2026 MuniLens. Gebou vir Suid-Afrikaanse Munisipaliteite.',
    'auth.signIn': 'Meld Aan',
    'auth.signUp': 'Registreer',
    'auth.signOut': 'Meld Af',
    'auth.email': 'E-posadres',
    'auth.password': 'Wagwoord',
    'auth.firstName': 'Voornaam',
    'auth.lastName': 'Van',
    'auth.phone': 'Telefoonnommer',
    'auth.province': 'Provinsie',
    'auth.selectProvince': 'Kies Provinsie',
    'auth.googleContinue': 'Gaan voort met Google',
    'auth.or': 'of',
    'auth.haveAccount': "Het jy reeds 'n rekening?",
    'auth.noAccount': "Het jy nie 'n rekening nie?",
    'auth.welcomeBack': 'Welkom Terug',
    'auth.createAccount': 'Skep Rekening',
    'report.fieldUnit': 'Veldeenheid v1.0',
    'report.gpsLocked': 'GPS_GESLUIT',
    'report.gpsSearching': 'GPS_SOEK',
    'report.offline': 'VANLYN_MODUS: Verslae sal outomaties sinkroniseer.',
    'report.lowAccuracy': 'LAE_GPS_AKKURAATHEID: Beweeg na oop area.',
    'report.capturing': 'Neem...',
    'report.capture': 'Maak Foto',
    'report.retake': 'Herneem',
    'report.analyzing': 'KI Analiseer...',
    'report.description': 'Beskrywing (opsioneel)',
    'report.descPlaceholder': 'Beskryf die probleem kortliks...',
    'report.submit': 'Stuur Verslag',
    'report.submitting': 'Stuur...',
    'report.category': 'Kategorie',
    'report.urgency': 'Dringendheid',
    'report.routedTo': 'Gestuur Na',
    'report.estimatedSolution': 'Geskatte Oplossing',
    'report.success.title': 'Verslag Ingedien!',
    'report.success.message': 'Dankie dat jy help om ons stad te verbeter. Jou verslag is suksesvol gestuur.',
    'report.success.reportAnother': "Rapporteer Nog 'n Probleem",
    'report.success.officialFeedback': 'Amptelike Terugvoer',
    'report.disabled.title': 'Rekening Gedeaktiveer',
    'report.disabled.message': "Jou toegang tot MuniLens is deur 'n stelseladministrateur beperk. As jy dink dit is 'n fout, kontak asseblief ondersteuning.",
    'status.unauthorized.title': 'Toegang Geweier',
    'status.unauthorized.message': 'U het nie die nodige toestemmings om hierdie bladsy te bekyk nie. Hierdie area is beperk tot administratiewe personeel.',
    'status.unauthorized.returnHome': 'Terug na Tuis',
    'status.suspended.title': 'Rekening Opgeskort',
    'status.suspended.message': "Jou rekening is tydelik deur die munisipale administrateur gedeaktiveer. Kontak asseblief ondersteuning as jy dink dit is 'n fout.",
    'status.suspended.signOut': 'Meld Af',
    'status.suspended.backHome': 'Terug na Tuis',
    'score.yourScore': 'Jou Telling',
    'score.totalPoints': 'Totale Punte',
    'score.clickCategory': 'Klik op \u2019n kategorie om jou verslae te sien',
    'score.pointsKey': 'Kritiek=10 · Hoog=5 · Medium=3 · Laag=2 pte',
    'score.potholes': 'Slaggatte',
    'score.waterLeaks': 'Waterlekkasies',
    'score.electricalDamage': 'Elektriese Skade',
    'score.other': 'Ander',
    'score.yourReports': 'Jou Verslae',
    'score.categoryTotal': 'Kategorie Totaal',
    'score.pts': 'pte',
    'score.report': 'verslag',
    'score.reports': 'verslae',
    'lang.en': 'English',
    'lang.af': 'Afrikaans',
    'lang.xh': 'IsiXhosa',
    'lang.zu': 'IsiZulu',
    // Dashboard
    'dash.municipalControl': 'Munisipale Beheer',
    'dash.overview': 'Oorsig',
    'dash.mapView': 'Kaartaansig',
    'dash.leaderboard': 'Ranglys',
    'dash.notifications': 'Kennisgewings',
    'dash.userManagement': 'Gebruikerbestuur',
    'dash.dashboardOverview': 'Paneelbord Oorsig',
    'dash.systemOperational': 'STELSEL_STATUS: OPERASIONEEL',
    'dash.activeReports': 'AKTIEWE_VERSLAE',
    'dash.generateAiReport': 'Genereer KI Insigsverslag',
    'dash.totalReports': 'Totale Verslae',
    'dash.activeIssues': 'Aktiewe Kwessies',
    'dash.resolved': 'Opgelos',
    'dash.topCategory': 'Top Kategorie',
    'dash.faultDistribution': 'Foutverspreiding',
    'dash.statusBreakdown': 'Statusopsomming',
    'dash.importanceLevels': 'Belangrikheidsvlakke',
    'dash.aiOperationalBriefing': 'KI Operasionele Berig',
    'dash.executiveSummary': 'Uitvoerende Opsomming',
    'dash.priorityActions': 'Prioriteitsaksies',
    'dash.trendInsights': 'Neiging Insigte',
    'dash.strategicRecommendations': 'Strategiese Aanbevelings',
    'dash.exportPdf': 'Uitvoer PDF',
    'dash.recentReports': 'Onlangse Verslae',
    'dash.liveFeed': 'REGSTREEKS_VOER',
    'dash.filterStatus': 'Status',
    'dash.filterImportance': 'Belangrikheid',
    'dash.filterType': 'Tipe',
    'dash.allStatuses': 'Alle Statusse',
    'dash.allImportance': 'Alle Belangrikheid',
    'dash.allTypes': 'Alle Tipes',
    'dash.colType': 'Tipe',
    'dash.colImportance': 'Belangrikheid',
    'dash.colStatus': 'Status',
    'dash.colLocation': 'Ligging',
    'dash.colDate': 'Datum',
    'dash.colReporter': 'Verslaggewer',
    'dash.colAction': 'Aksie',
    'dash.descriptionSnippet': 'Beskrywingstuk',
    'dash.quickUpdate': 'Vinnige Opdatering',
    'dash.open': 'Oop',
    'dash.inProgress': 'In Uitvoering',
    'dash.solved': 'Opgelos',
    'dash.updating': 'Opdateer...',
    'dash.updateStatus': 'Dateer Status Op',
    'dash.fullDetails': 'Volle Besonderhede',
    'dash.close': 'Sluit',
    'dash.breakdown': 'Uiteensetting',
    'dash.noReports': 'Geen verslae nie',
    'dash.locationData': 'Liggingsdata',
    'dash.reporterInfo': 'Verslaggewer Inligting',
    'dash.routedTo': 'Gestuur Na',
    'dash.estimatedSolution': 'Geskatte Oplossing',
    'dash.fieldDescription': 'Veldbeskrywing',
    'dash.pendingAssignment': 'Toekenning Hangende',
    'dash.addressNotAvailable': 'Adres nie beskikbaar nie',
    'dash.noDescriptionProvided': 'Geen beskrywing deur die burger verskaf nie.',
    'dash.generatingReport': 'Genereer KI Verslag...',
    // UserManagement
    'users.title': 'Gebruikerbestuur',
    'users.searchPlaceholder': 'Soek gebruikers...',
    'users.colUser': 'Gebruiker',
    'users.colContact': 'Kontak',
    'users.colProvince': 'Provinsie',
    'users.colRole': 'Rol',
    'users.colStatus': 'Status',
    'users.colActions': 'Aksies',
    'users.active': 'Aktief',
    'users.disabled': 'Gedeaktiveer',
    'users.disable': 'Deaktiveer',
    'users.enable': 'Aktiveer',
    'users.confirmAction': 'Bevestig Aksie',
    'users.confirmQuestion': 'Is jy seker jy wil',
    'users.adminWarning': 'Waarskuwing: Dit sal administratiewe voorregte verwyder.',
    'users.cancel': 'Kanselleer',
    'users.confirm': 'Bevestig',
    'users.anonymous': 'Anoniem',
    // Notifications
    'notif.title': 'Kennisgewings',
    'notif.liveFeed': 'VOER: REGSTREEKS',
    'notif.total': 'TOTAAL',
    'notif.unread': 'ONGELEES',
    'notif.markAllRead': 'Merk alles as gelees',
    'notif.criticalAlert': 'KRITIESE WAARSKUWING',
    'notif.highPriority': 'HOë PRIORITEIT',
    'notif.newReport': 'NUWE VERSLAG',
    'notif.emptyTitle': 'Nog geen kennisgewings nie.',
    'notif.emptyDesc': 'Nuwe verslae sal hier verskyn soos hulle inkom.',
    'notif.view': 'Bekyk',
    'notif.dismiss': 'Verwerp',
    // Leaderboard
    'lb.title': 'Ranglys',
    'lb.scoringActive': 'PUNTEENJIN: AKTIEF',
    'lb.reportersRanked': 'VERSLAGGEWER GERANGEER',
    'lb.fullRankings': 'Volle Ranglyste',
    'lb.scoringKey': 'Kritiek=10 · Hoog=5 · Medium=3 · Laag=2 · klik kategorie om neer te boor',
    'lb.noReportsYet': 'Nog geen verslae nie. Wees die eerste om punte te verdien!',
    'lb.colRank': 'Rang',
    'lb.colUsername': 'Gebruikersnaam',
    'lb.colTotalPoints': 'Totale Punte',
    'lb.colTotalReports': 'Totale Verslae',
    'lb.colPotholes': 'Slaggatte',
    'lb.colWaterLeaks': 'Waterlekkasies',
    'lb.colElectricalDamage': 'Elektriese Skade',
    'lb.colOther': 'Ander',
    'lb.categoryTotal': 'Kategorie Totaal',
    'lb.pts': 'pte',
    'lb.report': 'verslag',
    'lb.reports': 'verslae',
    'lb.potholes': 'Slaggatte',
    'lb.waterLeaks': 'Waterlekkasies',
    'lb.electricalDamage': 'Elektriese Skade',
    'lb.otherReports': 'Ander Verslae',
    // Map
    'map.reports': 'Verslae',
    'map.aggregate': 'Agregaat',
    'map.filters': 'Filters:',
    'map.inProgress': 'In Uitvoering',
    'map.resolved': 'Opgelos',
    'map.critical': 'Kritiek',
    'map.clear': 'Vee Uit',
    'map.satellite': 'Satelliet',
    'map.street': 'Straat',
    'map.locate': 'Bepaal Ligging',
    'map.liveFaultMap': 'Regstreekse Foutkaart',
    'map.aggregateView': 'Agregatuitsig',
    'map.results': 'resultate',
    'map.result': 'resultaat',
    'map.high': 'Hoog',
    'map.medium': 'Medium',
    'map.low': 'Laag',
    'map.2d': '2D',
    'map.3d': '3D',
  },

  xh: {
    'nav.report': 'Xela',
    'nav.dashboard': 'Iphaneli',
    'nav.map': 'Imephu',
    'hero.titleBefore': 'Lungisa idolophu yakho nge-',
    'hero.titleHighlight': 'AI.',
    'hero.subtitle': 'I-MuniLens isebenzisa ukubona kwekhompyuter ukuhlola iimpazamo zamasipala ngokukhawuleza. Xela iimfohfo, ukuvuza, neziphazamiso ngamasekhondi.',
    'hero.cta': 'Qala Ukuxela Ngoku',
    'hero.signInPrompt': 'Ngena ukuze uqale ukuxela',
    'feature.snap.title': 'Tsala Umfanekiso',
    'feature.snap.desc': 'I-AI ibona uhlobo lwempazamo ngokukhawuleza.',
    'feature.route.title': 'Thumela Ngokuzenzekelayo',
    'feature.route.desc': 'Iingxelo ziya ngqo kwidepathi elungileyo yemasipala.',
    'feature.insights.title': 'Ingcamango Ezikrelekrele',
    'feature.insights.desc': 'Abaphathi bafumana izishwankathelo ezibhalwe yi-AI.',
    'footer.hackathon': 'MICT SETA 2026 Hackathon Ukusebenza',
    'footer.copyright': '© 2026 MuniLens. Yakhiwe ngeeMasipala zaseMzantsi Afrika.',
    'auth.signIn': 'Ngena',
    'auth.signUp': 'Bhalisa',
    'auth.signOut': 'Phuma',
    'auth.email': 'Idilesi ye-Imeyile',
    'auth.password': 'Iphasiwedi',
    'auth.firstName': 'Igama lokuqala',
    'auth.lastName': 'Ifani',
    'auth.phone': 'Inombolo yomnxeba',
    'auth.province': 'IPhondo',
    'auth.selectProvince': 'Khetha IPhondo',
    'auth.googleContinue': 'Qhubeka nge-Google',
    'auth.or': 'okanye',
    'auth.haveAccount': 'Unayo i-akhawunti?',
    'auth.noAccount': 'Awunayo i-akhawunti?',
    'auth.welcomeBack': 'Wamkelekile Kwakhona',
    'auth.createAccount': 'Yenza I-Akhawunti',
    'report.fieldUnit': 'Isigaba Sasendle v1.0',
    'report.gpsLocked': 'I-GPS_IVALELWE',
    'report.gpsSearching': 'I-GPS_ISAKHANGELA',
    'report.offline': 'IMODI_ENGELNA_NTENGO: Iingxelo ziya kuvumelaniswa ngokuzenzekelayo.',
    'report.lowAccuracy': 'I-GPS_EPHANSI: Hamba kwindawo evulekileyo.',
    'report.capturing': 'Ukufota...',
    'report.capture': 'Tsala Umfanekiso',
    'report.retake': 'Tsala Kwakhona',
    'report.analyzing': 'I-AI Iyahlola...',
    'report.description': 'Inkcazelo (iyakhethwa)',
    'report.descPlaceholder': 'Cacisa ngokukhawuleza ingxaki...',
    'report.submit': 'Thumela Ingxelo',
    'report.submitting': 'Uthumela...',
    'report.category': 'Udidi',
    'report.urgency': 'Ubuzaza',
    'report.routedTo': 'Ithunyelwe Ku',
    'report.estimatedSolution': 'Isixazululo Esilinganisiweyo',
    'report.success.title': 'Ingxelo Inikeziwe!',
    'report.success.message': 'Enkosi ngokunceda ukuphucula idolophu yethu. Ingxelo yakho ithunyelwe ngempumelelo.',
    'report.success.reportAnother': 'Xela Ingxaki Enye',
    'report.success.officialFeedback': 'Impendulo YeSiseko',
    'report.disabled.title': 'I-Akhawunti Ivaliwe',
    'report.disabled.message': 'Ukufikelela kwakho kwi-MuniLens kukhawulelwe ngumphathi wenkqubo. Ukuba ucinga le yimpazamo, qhagamshelana nenkxaso.',
    'status.unauthorized.title': 'Ukungena Kwenqatshiwe',
    'status.unauthorized.message': 'Awunazo izimvume ezicelekayo zokubona le phepha. Le ndawo ikhawulelwe kubasebenzi bokungena kuphela.',
    'status.unauthorized.returnHome': 'Buyela Ekhaya',
    'status.suspended.title': 'I-Akhawunti Imisiwe',
    'status.suspended.message': 'I-akhawunti yakho ivalelwe okwexeshana ngumphathi wemasipala. Qhagamshelana nenkxaso ukuba ucinga le yimpazamo.',
    'status.suspended.signOut': 'Phuma',
    'status.suspended.backHome': 'Buyela Ekhaya',
    'score.yourScore': 'Amanqaku Akho',
    'score.totalPoints': 'Amanqaku Aphelele',
    'score.clickCategory': 'Cofa udidi ukuze ubone iingxelo zakho',
    'score.pointsKey': 'Phezulu=10 · Ephezulu=5 · Phakathi=3 · Phantsi=2 pts',
    'score.potholes': 'Iimfohfo',
    'score.waterLeaks': 'Ukuvuza Kwamanzi',
    'score.electricalDamage': 'Umonakalo wombane',
    'score.other': 'Ezinye',
    'score.yourReports': 'Iingxelo Zakho',
    'score.categoryTotal': 'Isishwankathelo Sodidi',
    'score.pts': 'pts',
    'score.report': 'ingxelo',
    'score.reports': 'iingxelo',
    'lang.en': 'English',
    'lang.af': 'Afrikaans',
    'lang.xh': 'IsiXhosa',
    'lang.zu': 'IsiZulu',
    // Dashboard
    'dash.municipalControl': 'Ulawulo lweNgingqi',
    'dash.overview': 'Isishwankathelo',
    'dash.mapView': 'Umbono weMap',
    'dash.leaderboard': 'Itafile yabaKhaphi',
    'dash.notifications': 'Izaziso',
    'dash.userManagement': 'Ulawulo lwaBaSebenzi',
    'dash.dashboardOverview': 'Isishwankathelo sePhaneli',
    'dash.systemOperational': 'ISIMO_SENKQUBO: ISEBENZA',
    'dash.activeReports': 'IINGXELO_EZISEBENZAYO',
    'dash.generateAiReport': 'Yenza Ingxelo ye-AI',
    'dash.totalReports': 'Iingxelo Ezipheleleyo',
    'dash.activeIssues': 'Iingxaki Ezisebenzayo',
    'dash.resolved': 'Zixazululiwe',
    'dash.topCategory': 'Udidi oluPhambili',
    'dash.faultDistribution': 'Ukusasazwa kweeMpazamo',
    'dash.statusBreakdown': 'Ukwahlulwa kweStatus',
    'dash.importanceLevels': 'Amanqanaba obuBuhe',
    'dash.aiOperationalBriefing': 'Ingxelo ye-AI Yokusebenza',
    'dash.executiveSummary': 'Isishwankathelo seZiphathimandla',
    'dash.priorityActions': 'Izenzo eziNgokokuQala',
    'dash.trendInsights': 'Ingcamango yeeMikhwa',
    'dash.strategicRecommendations': 'Iingcebiso zeziMvo',
    'dash.exportPdf': 'Khipha PDF',
    'dash.recentReports': 'Iingxelo zaKutsha Nje',
    'dash.liveFeed': 'INGXELO_EPHILAYO',
    'dash.filterStatus': 'Isimo',
    'dash.filterImportance': 'Ububaluleka',
    'dash.filterType': 'Uhlobo',
    'dash.allStatuses': 'Yonke Imeko',
    'dash.allImportance': 'Ububaluleka Bonke',
    'dash.allTypes': 'Yonke Iindidi',
    'dash.colType': 'Uhlobo',
    'dash.colImportance': 'Ububaluleka',
    'dash.colStatus': 'Isimo',
    'dash.colLocation': 'Indawo',
    'dash.colDate': 'Umhla',
    'dash.colReporter': 'Umxeli',
    'dash.colAction': 'Isenzo',
    'dash.descriptionSnippet': 'Icandelo leNkcazelo',
    'dash.quickUpdate': 'Uhlaziyo oluNgoko',
    'dash.open': 'Ivuliwe',
    'dash.inProgress': 'Iyaqhubeleka',
    'dash.solved': 'Ixazululiwe',
    'dash.updating': 'Iyahlaziywa...',
    'dash.updateStatus': 'Hlaziya Isimo',
    'dash.fullDetails': 'Iinkcukacha Ezipheleleyo',
    'dash.close': 'Vala',
    'dash.breakdown': 'Ukwahlulwa',
    'dash.noReports': 'Azikho iingxelo',
    'dash.locationData': 'Idatha yeNdawo',
    'dash.reporterInfo': 'Ulwazi loMxeli',
    'dash.routedTo': 'Ithunyelwe Ku',
    'dash.estimatedSolution': 'Isixazululo Esilinganisiweyo',
    'dash.fieldDescription': 'Inkcazelo eNtabeni',
    'dash.pendingAssignment': 'Ulindeleke Ukuqeshwa',
    'dash.addressNotAvailable': 'Idilesi ayifumaneki',
    'dash.noDescriptionProvided': 'Akukho nkcazelo efakelwe ngumseti.',
    'dash.generatingReport': 'Yenza Ingxelo ye-AI...',
    // UserManagement
    'users.title': 'Ulawulo lwaBaSebenzi',
    'users.searchPlaceholder': 'Khangela abasebenzi...',
    'users.colUser': 'UMsebenzi',
    'users.colContact': 'Unxibelelwano',
    'users.colProvince': 'IPhondo',
    'users.colRole': 'Indima',
    'users.colStatus': 'Isimo',
    'users.colActions': 'Izenzo',
    'users.active': 'Iyasebenza',
    'users.disabled': 'Ivalelwe',
    'users.disable': 'Vala',
    'users.enable': 'Vula',
    'users.confirmAction': 'Qinisekisa Isenzo',
    'users.confirmQuestion': 'Uqinisekile ukuba ufuna',
    'users.adminWarning': 'Isilumkiso: Oku kuya kususa amalungelo okulawula.',
    'users.cancel': 'Rhoxisa',
    'users.confirm': 'Qinisekisa',
    'users.anonymous': 'Akaziwanga',
    // Notifications
    'notif.title': 'Izaziso',
    'notif.liveFeed': 'UNXIBELELWANO: LUPHILA',
    'notif.total': 'ISISHWANKATHELO',
    'notif.unread': 'AZIFUNDWANGA',
    'notif.markAllRead': 'Maka yonke njengefundiweyo',
    'notif.criticalAlert': 'ISAZISO ESIPHAMBILI',
    'notif.highPriority': 'EPHAMBILI KAKHULU',
    'notif.newReport': 'INGXELO ENTSHA',
    'notif.emptyTitle': 'Azikho izaziso.',
    'notif.emptyDesc': 'Iingxelo ezintsha ziya kubonakala apha njengoko zifika.',
    'notif.view': 'Jonga',
    'notif.dismiss': 'Susa',
    // Leaderboard
    'lb.title': 'Itafile yabaKhaphi',
    'lb.scoringActive': 'INJINI_YAMANQAKU: IYASEBENZA',
    'lb.reportersRanked': 'ABAXELI BALANDELELANA',
    'lb.fullRankings': 'Ulandelelwano Olupheleleyo',
    'lb.scoringKey': 'Phambili=10 · Ephezulu=5 · Phakathi=3 · Phantsi=2 · cofa inombolo ukuhlola',
    'lb.noReportsYet': 'Azikho iingxelo. Yiba wokuqala ukuphumelela amanqaku!',
    'lb.colRank': 'Ukuhlela',
    'lb.colUsername': 'Igama loMsebenzi',
    'lb.colTotalPoints': 'Amanqaku Apheleleyo',
    'lb.colTotalReports': 'Iingxelo Epheleleyo',
    'lb.colPotholes': 'Iimfohfo',
    'lb.colWaterLeaks': 'Ukuvuza Kwamanzi',
    'lb.colElectricalDamage': 'Umonakalo kaMbane',
    'lb.colOther': 'Ezinye',
    'lb.categoryTotal': 'Isishwankathelo Sodidi',
    'lb.pts': 'pts',
    'lb.report': 'ingxelo',
    'lb.reports': 'iingxelo',
    'lb.potholes': 'Iimfohfo',
    'lb.waterLeaks': 'Ukuvuza Kwamanzi',
    'lb.electricalDamage': 'Umonakalo kaMbane',
    'lb.otherReports': 'Ezinye Iingxelo',
    // Map
    'map.reports': 'Iingxelo',
    'map.aggregate': 'Ixubeneyo',
    'map.filters': 'Izihluzi:',
    'map.inProgress': 'Iyaqhubeleka',
    'map.resolved': 'Ixazululiwe',
    'map.critical': 'Ephambili',
    'map.clear': 'Sula',
    'map.satellite': 'Isathelayithi',
    'map.street': 'Isitalato',
    'map.locate': 'Fumana Indawo',
    'map.liveFaultMap': 'Imap yeeMpazamo',
    'map.aggregateView': 'Umbono Oxubeneyo',
    'map.results': 'iziphumo',
    'map.result': 'isiphumo',
    'map.high': 'Phezulu',
    'map.medium': 'Phakathi',
    'map.low': 'Phantsi',
    'map.2d': '2D',
    'map.3d': '3D',
  },

  zu: {
    'nav.report': 'Bika',
    'nav.dashboard': 'Idashubhodi',
    'nav.map': 'Imephu',
    'hero.titleBefore': 'Lungisa idolobha lakho nge-',
    'hero.titleHighlight': 'AI.',
    'hero.subtitle': 'I-MuniLens isebenzisa ukubona kwekhompyutha ukuhlukanisa amaphutha kamasipala ngokushesha. Bika izindlwabu, ukuvuza, nezinkinga ngamasekhondi.',
    'hero.cta': 'Qala Ukubika Manje',
    'hero.signInPrompt': 'Ngena ukuze uqale ukubika',
    'feature.snap.title': 'Thwebula Isithombe',
    'feature.snap.desc': 'I-AI ibona uhlobo lwephutha ngokushesha.',
    'feature.route.title': 'Thumela Ngokuzenzakalela',
    'feature.route.desc': 'Imibiko iya ngqo emnyangweni ofanele kamasipala.',
    'feature.insights.title': 'Izingqiqo Ezihlakanipha',
    'feature.insights.desc': 'Abaphathi bathola izifinyezo ezibhalwe yi-AI.',
    'footer.hackathon': 'MICT SETA 2026 Ukufakwa kwe-Hackathon',
    'footer.copyright': '© 2026 MuniLens. Yakhiwe ngeeMasipala zaseNingizimu Afrika.',
    'auth.signIn': 'Ngena',
    'auth.signUp': 'Bhalisa',
    'auth.signOut': 'Phuma',
    'auth.email': 'Ikheli le-Imeyili',
    'auth.password': 'Iphasiwedi',
    'auth.firstName': 'Igama lokuqala',
    'auth.lastName': 'Isibongo',
    'auth.phone': 'Inombolo yocingo',
    'auth.province': 'IPhrovhinsi',
    'auth.selectProvince': 'Khetha IPhrovhinsi',
    'auth.googleContinue': 'Qhubeka nge-Google',
    'auth.or': 'noma',
    'auth.haveAccount': 'Usuneakhawunti?',
    'auth.noAccount': 'Awuneakhawunti?',
    'auth.welcomeBack': 'Wamukelekile Futhi',
    'auth.createAccount': 'Dala I-Akhawunti',
    'report.fieldUnit': 'Iyunithi Yensimu v1.0',
    'report.gpsLocked': 'I-GPS_IVALELWE',
    'report.gpsSearching': 'I-GPS_IYASESHA',
    'report.offline': 'IMODI_ENGAXHUNYIWE: Imibiko iyavumelaniswa ngokuzenzakalela.',
    'report.lowAccuracy': 'I-GPS_EPHANSI: Hamba endaweni evulekile.',
    'report.capturing': 'Ithwebula...',
    'report.capture': 'Thwebula Isithombe',
    'report.retake': 'Thwebula Futhi',
    'report.analyzing': 'I-AI Iyahlolwa...',
    'report.description': 'Incazelo (ikhethwa)',
    'report.descPlaceholder': 'Chaza kabanzi inkinga...',
    'report.submit': 'Thumela Umbiko',
    'report.submitting': 'Ithuma...',
    'report.category': 'Isigaba',
    'report.urgency': 'Ubushushu',
    'report.routedTo': 'Ithunyelwe Ku',
    'report.estimatedSolution': 'Isisombululo Esilinganiselwa',
    'report.success.title': 'Umbiko Wathunyelwa!',
    'report.success.message': 'Siyabonga ngokusiza ukuthuthukisa idolobha lethu. Umbiko wakho uthunyelwe ngempumelelo.',
    'report.success.reportAnother': 'Bika Inkinga Enye',
    'report.success.officialFeedback': 'Impendulo Esemthethweni',
    'report.disabled.title': 'I-Akhawunti Ivaliwe',
    'report.disabled.message': 'Ukufinyelela kwakho kwi-MuniLens kwakhawulelwa ngumphathi wesistimu. Uma ucabanga ukuthi leli yiphutha, xhumana nosekela.',
    'status.unauthorized.title': 'Ukungena Kwenqatshwa',
    'status.unauthorized.message': 'Awunazo izimvume ezidingekayo zokubuka leli khasi. Lesi sifunda sivimbelwe kubasebenzi bokulawula kuphela.',
    'status.unauthorized.returnHome': 'Buyela Ekhaya',
    'status.suspended.title': 'I-Akhawunti Imisiwe',
    'status.suspended.message': 'I-akhawunti yakho ivimbelwe okwesikhashana ngumphathi kamasipala. Xhumana nosekela uma ucabanga ukuthi leli yiphutha.',
    'status.suspended.signOut': 'Phuma',
    'status.suspended.backHome': 'Buyela Ekhaya',
    'score.yourScore': 'Amanqaku Akho',
    'score.totalPoints': 'Amanqaku Aphelele',
    'score.clickCategory': 'Chofoza inhlangano ukuze ubone imibiko yakho',
    'score.pointsKey': 'Okubalulekile=10 · Okuphezulu=5 · Phakathi=3 · Okuphansi=2 pts',
    'score.potholes': 'Izindlwabu',
    'score.waterLeaks': 'Ukuvuza Kwamanzi',
    'score.electricalDamage': 'Umonakalo wogesi',
    'score.other': 'Okunye',
    'score.yourReports': 'Imibiko Yakho',
    'score.categoryTotal': 'Isishwankathelo Senhlangano',
    'score.pts': 'pts',
    'score.report': 'umbiko',
    'score.reports': 'imibiko',
    'lang.en': 'English',
    'lang.af': 'Afrikaans',
    'lang.xh': 'IsiXhosa',
    'lang.zu': 'IsiZulu',
    // Dashboard
    'dash.municipalControl': 'Ulawulo lukaMasipala',
    'dash.overview': 'Ukubuka Konke',
    'dash.mapView': 'Umbono weMap',
    'dash.leaderboard': 'Ibhodi Labaholi',
    'dash.notifications': 'Izaziso',
    'dash.userManagement': 'Ukuphathwa Kwabasebenzisi',
    'dash.dashboardOverview': 'Ukubuka KweDashubhodi',
    'dash.systemOperational': 'ISIMO_SESISTIMU: ISEBENZA',
    'dash.activeReports': 'IMIBIKO_ESEBENZAYO',
    'dash.generateAiReport': 'Yenza Umbiko we-AI',
    'dash.totalReports': 'Imibiko Yonke',
    'dash.activeIssues': 'Izinkinga Ezisebenzayo',
    'dash.resolved': 'Ixazululiwe',
    'dash.topCategory': 'Isigaba Esiphezulu',
    'dash.faultDistribution': 'Ukusabalalisa Amaphutha',
    'dash.statusBreakdown': 'Ukwahlulwa Kwesimo',
    'dash.importanceLevels': 'Amazinga Abalulekile',
    'dash.aiOperationalBriefing': 'Ingxelo ye-AI Yokusebenza',
    'dash.executiveSummary': 'Isifinyezo Sezikhulu',
    'dash.priorityActions': 'Izenzo Ezihamba Phambili',
    'dash.trendInsights': 'Izingqiqo Zezikhomba',
    'dash.strategicRecommendations': 'Izincomo Zomkhakaso',
    'dash.exportPdf': 'Thumela PDF',
    'dash.recentReports': 'Imibiko Yakamuva Nje',
    'dash.liveFeed': 'UKUPHILA_KWEMIBIKO',
    'dash.filterStatus': 'Isimo',
    'dash.filterImportance': 'Ukubaluleka',
    'dash.filterType': 'Uhlobo',
    'dash.allStatuses': 'Zonke Izimo',
    'dash.allImportance': 'Ukubaluleka Konke',
    'dash.allTypes': 'Zonke Izinhlobo',
    'dash.colType': 'Uhlobo',
    'dash.colImportance': 'Ukubaluleka',
    'dash.colStatus': 'Isimo',
    'dash.colLocation': 'Indawo',
    'dash.colDate': 'Usuku',
    'dash.colReporter': 'Umxoxi',
    'dash.colAction': 'Isenzo',
    'dash.descriptionSnippet': 'Ingxenye Yencazelo',
    'dash.quickUpdate': 'Ukubukezelwa Okukhawuleza',
    'dash.open': 'Kuvuliwe',
    'dash.inProgress': 'Kuqhubeka',
    'dash.solved': 'Ixazululiwe',
    'dash.updating': 'Kuyabuyekezwa...',
    'dash.updateStatus': 'Buyekeza Isimo',
    'dash.fullDetails': 'Imininingwane Ephelele',
    'dash.close': 'Vala',
    'dash.breakdown': 'Ukwahlulwa',
    'dash.noReports': 'Ayikho imibiko',
    'dash.locationData': 'Idatha Yendawo',
    'dash.reporterInfo': 'Ulwazi lwoMxoxi',
    'dash.routedTo': 'Ithunyelwe Ku',
    'dash.estimatedSolution': 'Isisombululo Esilinganiselwa',
    'dash.fieldDescription': 'Incazelo Yensimu',
    'dash.pendingAssignment': 'Kulindwe Ukuqashwa',
    'dash.addressNotAvailable': 'Ikheli alikho',
    'dash.noDescriptionProvided': 'Akukho ncazelo eyanikezwa umuntu.',
    'dash.generatingReport': 'Yenza Umbiko we-AI...',
    // UserManagement
    'users.title': 'Ukuphathwa Kwabasebenzisi',
    'users.searchPlaceholder': 'Sesha abasebenzisi...',
    'users.colUser': 'Umsebenzi',
    'users.colContact': 'Oxhumana Naye',
    'users.colProvince': 'IPhrovhinsi',
    'users.colRole': 'Indima',
    'users.colStatus': 'Isimo',
    'users.colActions': 'Izenzo',
    'users.active': 'Isebenza',
    'users.disabled': 'Ivimbelwe',
    'users.disable': 'Vimba',
    'users.enable': 'Vula',
    'users.confirmAction': 'Qinisekisa Isenzo',
    'users.confirmQuestion': 'Uqinisekile ukuthi ufuna',
    'users.adminWarning': 'Isexwayiso: Lokhu kuzokhipha amandla okulawula.',
    'users.cancel': 'Khansela',
    'users.confirm': 'Qinisekisa',
    'users.anonymous': 'Akaziwa',
    // Notifications
    'notif.title': 'Izaziso',
    'notif.liveFeed': 'UKUDLULISWA: KUPHILA',
    'notif.total': 'ISISHWANKATHELO',
    'notif.unread': 'OKUNGAFUNDWANGA',
    'notif.markAllRead': 'Maka konke njengokufundiwe',
    'notif.criticalAlert': 'ISEXWAYISO ESIPHUTHUMAYO',
    'notif.highPriority': 'KUBALULEKILE KAKHULU',
    'notif.newReport': 'UMBIKO OMUTSHA',
    'notif.emptyTitle': 'Azikho izaziso.',
    'notif.emptyDesc': 'Imibiko emisha izovela lapha njengoba iqhubeka.',
    'notif.view': 'Buka',
    'notif.dismiss': 'Susa',
    // Leaderboard
    'lb.title': 'Ibhodi Labaholi',
    'lb.scoringActive': 'INJINI_YAMANQAKU: IYASEBENZA',
    'lb.reportersRanked': 'ABAXOXI BALANDELANA',
    'lb.fullRankings': 'Ukuhlela Okuphelele',
    'lb.scoringKey': 'Okubalulekile=10 · Okuphezulu=5 · Phakathi=3 · Phansi=2 · chofoza i-khethini ukuhlola',
    'lb.noReportsYet': 'Ayikho imibiko. Yiba wokuqala ukuwina amanqaku!',
    'lb.colRank': 'Isikhundla',
    'lb.colUsername': 'Igama Lomsebenzi',
    'lb.colTotalPoints': 'Amanqaku Aphelele',
    'lb.colTotalReports': 'Imibiko Ephelele',
    'lb.colPotholes': 'Izindlwabu',
    'lb.colWaterLeaks': 'Ukuvuza Kwamanzi',
    'lb.colElectricalDamage': 'Umonakalo kagesi',
    'lb.colOther': 'Okunye',
    'lb.categoryTotal': 'Isishwankathelo Senhlangano',
    'lb.pts': 'pts',
    'lb.report': 'umbiko',
    'lb.reports': 'imibiko',
    'lb.potholes': 'Izindlwabu',
    'lb.waterLeaks': 'Ukuvuza Kwamanzi',
    'lb.electricalDamage': 'Umonakalo kagesi',
    'lb.otherReports': 'Imibiko Emingaphandle',
    // Map
    'map.reports': 'Imibiko',
    'map.aggregate': 'Okuhlangene',
    'map.filters': 'Izihlungi:',
    'map.inProgress': 'Kuqhubeka',
    'map.resolved': 'Ixazululiwe',
    'map.critical': 'Okubalulekile',
    'map.clear': 'Sula',
    'map.satellite': 'Isathelayithi',
    'map.street': 'Umgwaqo',
    'map.locate': 'Thola Indawo',
    'map.liveFaultMap': 'Imap Yamaphutha Aphilayo',
    'map.aggregateView': 'Umbono Ohlangene',
    'map.results': 'iziphumo',
    'map.result': 'isiphumo',
    'map.high': 'Phezulu',
    'map.medium': 'Phakathi',
    'map.low': 'Phansi',
    'map.2d': '2D',
    'map.3d': '3D',
  },
};
