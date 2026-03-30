import { Timestamp } from 'firebase/firestore';

export interface UserLeaderboardStats {
  userId: string;
  displayName: string;
  email: string;
  totalPoints: number;
  reportsCount: number;
  thisMonthPoints: number;
  thisWeekPoints: number;
  rank: number;
  badge: string;
  breakdown: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}

export interface LeaderboardData {
  allTime: UserLeaderboardStats[];
  thisMonth: UserLeaderboardStats[];
  thisWeek: UserLeaderboardStats[];
  lastUpdated: number;
}

const POINT_VALUES = {
  Critical: 10,
  High: 5,
  Medium: 3,
  Low: 2,
};

const BADGES = {
  0: '',
  10: '🥇 Bronze Reporter',
  50: '🥈 Silver Guardian',
  100: '🥉 Gold Protector',
  250: '💎 Platinum Champion',
  500: '👑 Legendary',
};

function getBadge(points: number): string {
  const badges = Object.entries(BADGES)
    .filter(([threshold]) => Number(threshold) <= points)
    .sort((a, b) => Number(b[0]) - Number(a[0]));
  
  return badges[0]?.[1] || '';
}

function getImportancePoints(importance: string): number {
  return (POINT_VALUES as Record<string, number>)[importance] || 0;
}

function isWithinPeriod(timestamp: Timestamp | number | string, days: number): boolean {
  const now = Date.now();
  let reportTime: number;

  if (timestamp instanceof Timestamp) {
    reportTime = timestamp.toDate().getTime();
  } else if (typeof timestamp === 'string') {
    reportTime = new Date(timestamp).getTime();
  } else {
    reportTime = timestamp;
  }

  const periodMs = days * 24 * 60 * 60 * 1000;
  return (now - reportTime) <= periodMs;
}

export function calculateLeaderboard(reports: any[]): LeaderboardData {
  const userStatsMap = new Map<string, UserLeaderboardStats>();

  // Process each report
  reports.forEach((report, idx) => {
    // Handle both old and new report structures
    const userId = report.userId || report.reporterUid;
    const displayName = report.displayName || report.userDisplayName || report.reporterName || 'Anonymous';
    const email = report.email || report.userEmail || 'unknown@munilens.local';
    
    // Handle both nested and flat importance structures
    const importance = report.importance || report.classification?.importance || 'Low';
    const points = getImportancePoints(importance);
    
    // Handle createdAt, reportedAt, or timestamp
    const timestamp = report.createdAt || report.reportedAt || report.timestamp || Date.now();

    if (idx < 3) {
      console.log(`[Leaderboard] Report ${idx}:`, { userId, displayName, importance, points, timestamp });
    }

    if (!userId) {
      console.warn('[Leaderboard] Skipping report with no userId:', report);
      return; // Skip if no user ID
    }

    if (!userStatsMap.has(userId)) {
      userStatsMap.set(userId, {
        userId,
        displayName,
        email,
        totalPoints: 0,
        reportsCount: 0,
        thisMonthPoints: 0,
        thisWeekPoints: 0,
        rank: 0,
        badge: '',
        breakdown: { critical: 0, high: 0, medium: 0, low: 0 },
      });
    }

    const stats = userStatsMap.get(userId)!;
    stats.totalPoints += points;
    stats.reportsCount += 1;

    // Track by time period
    if (isWithinPeriod(timestamp, 7)) {
      stats.thisWeekPoints += points;
    }
    if (isWithinPeriod(timestamp, 30)) {
      stats.thisMonthPoints += points;
    }

    // Track breakdown by importance
    const importanceLower = importance.toLowerCase() as keyof typeof stats.breakdown;
    if (importanceLower in stats.breakdown) {
      (stats.breakdown[importanceLower] as number) += 1;
    }
  });

  // Convert to array and sort
  const allStats = Array.from(userStatsMap.values());

  console.log('[Leaderboard] Final rankings:', allStats); // Debug output

  // Assign ranks and badges
  const sortedByAllTime = [...allStats].sort((a, b) => b.totalPoints - a.totalPoints);
  sortedByAllTime.forEach((stat, index) => {
    stat.rank = index + 1;
    stat.badge = getBadge(stat.totalPoints);
  });

  return {
    allTime: sortedByAllTime,
    thisMonth: [...allStats].sort((a, b) => b.thisMonthPoints - a.thisMonthPoints),
    thisWeek: [...allStats].sort((a, b) => b.thisWeekPoints - a.thisWeekPoints),
    lastUpdated: Date.now(),
  };
}

export function getUserStats(leaderboard: LeaderboardData, userId: string): UserLeaderboardStats | undefined {
  return leaderboard.allTime.find((stat) => stat.userId === userId);
}

export function getTopUsers(leaderboard: LeaderboardData, limit: number = 10): UserLeaderboardStats[] {
  return leaderboard.allTime.slice(0, limit);
}
