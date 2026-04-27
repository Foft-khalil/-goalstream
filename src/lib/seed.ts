import { db } from '@/lib/db';

const SAMPLE_MATCHES = [
  {
    homeTeam: 'PSG',
    awayTeam: 'Real Madrid',
    homeLogo: 'https://ui-avatars.com/api/?name=PSG&background=004170&color=fff&size=64',
    awayLogo: 'https://ui-avatars.com/api/?name=RMA&background=FEBE10&color=000&size=64',
    competition: 'UEFA Champions League',
    matchDate: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours from now
    status: 'live' as const,
    homeScore: 1,
    awayScore: 1,
  },
  {
    homeTeam: 'Barcelona',
    awayTeam: 'Manchester City',
    homeLogo: 'https://ui-avatars.com/api/?name=BAR&background=A50044&color=fff&size=64',
    awayLogo: 'https://ui-avatars.com/api/?name=MCI&background=6CABDD&color=fff&size=64',
    competition: 'UEFA Champions League',
    matchDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
    status: 'upcoming' as const,
  },
  {
    homeTeam: 'Morocco',
    awayTeam: 'Senegal',
    homeLogo: 'https://ui-avatars.com/api/?name=MAR&background=C1272D&color=fff&size=64',
    awayLogo: 'https://ui-avatars.com/api/?name=SEN&background=006A4E&color=fff&size=64',
    competition: 'International Friendly',
    matchDate: new Date(Date.now() + 48 * 60 * 60 * 1000), // Day after tomorrow
    status: 'upcoming' as const,
  },
  {
    homeTeam: 'Algeria',
    awayTeam: 'Tunisia',
    homeLogo: 'https://ui-avatars.com/api/?name=ALG&background=006633&color=fff&size=64',
    awayLogo: 'https://ui-avatars.com/api/?name=TUN&background=E70013&color=fff&size=64',
    competition: 'AFCON Qualifier',
    matchDate: new Date(Date.now() + 72 * 60 * 60 * 1000), // 3 days from now
    status: 'upcoming' as const,
  },
  {
    homeTeam: 'Liverpool',
    awayTeam: 'Arsenal',
    homeLogo: 'https://ui-avatars.com/api/?name=LIV&background=C8102E&color=fff&size=64',
    awayLogo: 'https://ui-avatars.com/api/?name=ARS&background=EF0107&color=fff&size=64',
    competition: 'Premier League',
    matchDate: new Date(Date.now() - 90 * 60 * 1000), // 1.5 hours ago (finished)
    status: 'finished' as const,
    homeScore: 2,
    awayScore: 3,
  },
];

export async function seedMatches() {
  try {
    const existingCount = await db.match.count();

    if (existingCount > 0) {
      console.log(`Matches already exist (${existingCount}), skipping seed.`);
      return;
    }

    console.log('Seeding sample matches...');

    for (const match of SAMPLE_MATCHES) {
      await db.match.create({
        data: {
          homeTeam: match.homeTeam,
          awayTeam: match.awayTeam,
          homeLogo: match.homeLogo,
          awayLogo: match.awayLogo,
          competition: match.competition,
          matchDate: match.matchDate,
          status: match.status,
          homeScore: match.homeScore ?? null,
          awayScore: match.awayScore ?? null,
        },
      });
    }

    console.log(`Seeded ${SAMPLE_MATCHES.length} sample matches.`);
  } catch (error) {
    console.error('Error seeding matches:', error);
  }
}
