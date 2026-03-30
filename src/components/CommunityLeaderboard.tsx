import React, { useState, useEffect } from 'react';
import { Trophy, TrendingUp, Zap, Target, RefreshCw } from 'lucide-react';
import { UserLeaderboardStats, LeaderboardData, calculateLeaderboard, getUserStats } from '../utils/leaderboardCalculator';

interface CommunityLeaderboardProps {
  reports: any[];
  currentUserId?: string;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

type LeaderboardTab = 'allTime' | 'thisMonth' | 'thisWeek';

export default function CommunityLeaderboard({ reports, currentUserId, onRefresh, isRefreshing }: CommunityLeaderboardProps) {
  const [leaderboard, setLeaderboard] = useState<LeaderboardData | null>(null);
  const [activeTab, setActiveTab] = useState<LeaderboardTab>('allTime');
  const [userStats, setUserStats] = useState<UserLeaderboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Calculate leaderboard from reports
    const data = calculateLeaderboard(reports);
    setLeaderboard(data);

    if (currentUserId) {
      const stats = getUserStats(data, currentUserId);
      setUserStats(stats || null);
    }

    setLoading(false);
  }, [reports, currentUserId]);

  if (loading || !leaderboard) {
    return (
      <div className="p-8 text-center" style={{ color: '#9e9e9e' }}>
        Loading leaderboard...
      </div>
    );
  }

  const currentData = leaderboard[activeTab];
  const topThree = currentData.slice(0, 3);

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-2">
          <Trophy className="w-8 h-8" style={{ color: '#1a6fa8' }} />
          <h1 className="text-3xl font-black" style={{ color: '#1a2e5a' }}>
            Community Leaderboard
          </h1>
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              className="ml-4 p-2 rounded-lg transition-all hover:opacity-80 disabled:opacity-50"
              style={{ backgroundColor: '#f0f0f0' }}
              title="Refresh rankings"
            >
              <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} style={{ color: '#1a6fa8' }} />
            </button>
          )}
        </div>
        <p style={{ color: '#9e9e9e' }} className="text-sm">
          Top reporters making a difference in our city
        </p>
      </div>

      {/* User's Personal Stats */}
      {userStats && (
        <div
          className="p-4 rounded-2xl border-2 space-y-3"
          style={{ backgroundColor: '#f0f0f0', borderColor: '#1a6fa8' }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-black uppercase" style={{ color: '#9e9e9e' }}>
                Your Ranking
              </p>
              <p className="text-2xl font-black" style={{ color: '#1a2e5a' }}>
                #{userStats.rank}
              </p>
            </div>
            <div className="text-right space-y-1">
              <p className="text-sm font-bold" style={{ color: '#9e9e9e' }}>
                {userStats.badge}
              </p>
              <p className="text-3xl font-black" style={{ color: '#1a6fa8' }}>
                {userStats.totalPoints}
              </p>
              <p className="text-xs" style={{ color: '#9e9e9e' }}>
                points
              </p>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2 text-center text-xs">
            <div>
              <p style={{ color: '#9e9e9e' }}>Critical</p>
              <p className="font-bold text-lg" style={{ color: '#dc2626' }}>
                {userStats.breakdown.critical}
              </p>
            </div>
            <div>
              <p style={{ color: '#9e9e9e' }}>High</p>
              <p className="font-bold text-lg" style={{ color: '#f97316' }}>
                {userStats.breakdown.high}
              </p>
            </div>
            <div>
              <p style={{ color: '#9e9e9e' }}>Medium</p>
              <p className="font-bold text-lg" style={{ color: '#1a6fa8' }}>
                {userStats.breakdown.medium}
              </p>
            </div>
            <div>
              <p style={{ color: '#9e9e9e' }}>Low</p>
              <p className="font-bold text-lg" style={{ color: '#9e9e9e' }}>
                {userStats.breakdown.low}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex gap-2">
        {(['allTime', 'thisMonth', 'thisWeek'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="px-4 py-2 rounded-lg font-bold transition-all text-sm"
            style={{
              backgroundColor: activeTab === tab ? '#1a6fa8' : '#f0f0f0',
              color: activeTab === tab ? '#fff' : '#9e9e9e',
            }}
          >
            {tab === 'allTime' && 'All Time'}
            {tab === 'thisMonth' && 'This Month'}
            {tab === 'thisWeek' && 'This Week'}
          </button>
        ))}
      </div>

      {/* Top 3 Podium */}
      {topThree.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Silver (2nd) - Left */}
          {topThree[1] && (
            <div
              className="rounded-2xl p-6 text-center space-y-3 border-2 transform md:translate-y-8"
              style={{ backgroundColor: '#f0f0f0', borderColor: '#c0c0c0' }}
            >
              <div className="text-4xl">🥈</div>
              <p className="font-black" style={{ color: '#1a2e5a' }}>
                #{topThree[1].rank}
              </p>
              <p className="text-sm font-bold truncate" style={{ color: '#1a2e5a' }}>
                {topThree[1].displayName}
              </p>
              <p className="text-2xl font-black" style={{ color: '#1a6fa8' }}>
                {topThree[1].totalPoints}
              </p>
              <p className="text-xs" style={{ color: '#9e9e9e' }}>
                {topThree[1].reportsCount} reports
              </p>
            </div>
          )}

          {/* Gold (1st) - Center */}
          {topThree[0] && (
            <div
              className="rounded-2xl p-6 text-center space-y-3 border-2 md:scale-110"
              style={{ backgroundColor: '#fef3c7', borderColor: '#fbbf24' }}
            >
              <div className="text-5xl">🥇</div>
              <p className="font-black text-lg" style={{ color: '#92400e' }}>
                #{topThree[0].rank}
              </p>
              <p className="text-sm font-black truncate" style={{ color: '#92400e' }}>
                {topThree[0].displayName}
              </p>
              <p className="text-3xl font-black" style={{ color: '#f97316' }}>
                {topThree[0].totalPoints}
              </p>
              <p className="text-xs" style={{ color: '#92400e' }}>
                {topThree[0].reportsCount} reports
              </p>
              {topThree[0].badge && <p className="font-bold">{topThree[0].badge}</p>}
            </div>
          )}

          {/* Bronze (3rd) - Right */}
          {topThree[2] && (
            <div
              className="rounded-2xl p-6 text-center space-y-3 border-2 transform md:translate-y-8"
              style={{ backgroundColor: '#f0f0f0', borderColor: '#b87333' }}
            >
              <div className="text-4xl">🥉</div>
              <p className="font-black" style={{ color: '#1a2e5a' }}>
                #{topThree[2].rank}
              </p>
              <p className="text-sm font-bold truncate" style={{ color: '#1a2e5a' }}>
                {topThree[2].displayName}
              </p>
              <p className="text-2xl font-black" style={{ color: '#1a6fa8' }}>
                {topThree[2].totalPoints}
              </p>
              <p className="text-xs" style={{ color: '#9e9e9e' }}>
                {topThree[2].reportsCount} reports
              </p>
            </div>
          )}
        </div>
      )}

      {/* Full Leaderboard Table */}
      <div className="rounded-2xl overflow-hidden border-2" style={{ borderColor: '#d9c9a8' }}>
        <div
          className="p-4 flex items-center gap-2 font-black text-sm"
          style={{ backgroundColor: '#f0f0f0', color: '#1a2e5a' }}
        >
          <TrendingUp className="w-5 h-5" style={{ color: '#1a6fa8' }} />
          RANKINGS
        </div>

        <div className="divide-y" style={{ borderColor: '#d9c9a8' } as React.CSSProperties}>
          {currentData.map((user, idx) => (
            <div
              key={user.userId}
              className="p-4 flex items-center justify-between hover:bg-opacity-50 transition-all border-b"
              style={{
                borderColor: '#d9c9a8',
                backgroundColor: user.userId === currentUserId ? '#e3f2fd' : '#fff',
              }}
            >
              <div className="flex items-center gap-4 flex-1">
                <div className="w-8 text-center font-black text-lg" style={{ color: '#1a6fa8' }}>
                  {idx === 0 && '🥇'}
                  {idx === 1 && '🥈'}
                  {idx === 2 && '🥉'}
                  {idx > 2 && `#${idx + 1}`}
                </div>

                <div className="flex-1">
                  <p className="font-bold" style={{ color: '#1a2e5a' }}>
                    {user.displayName}
                    {user.userId === currentUserId && <span style={{ color: '#4caf50' }}> (You)</span>}
                  </p>
                  <p className="text-xs" style={{ color: '#9e9e9e' }}>
                    {user.reportsCount} reports
                  </p>
                </div>
              </div>

              <div className="text-right space-y-1">
                <p className="font-black text-lg" style={{ color: '#1a6fa8' }}>
                  {user.totalPoints}
                </p>
                {user.badge && <p className="text-xs font-bold">{user.badge}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Info Box */}
      <div
        className="p-4 rounded-xl text-xs space-y-2"
        style={{ backgroundColor: '#f0f0f0', color: '#9e9e9e', borderLeft: '4px solid #1a6fa8' }}
      >
        <p className="font-bold flex items-center gap-2">
          <Zap className="w-4 h-4" style={{ color: '#1a6fa8' }} />
          HOW POINTS WORK
        </p>
        <ul className="space-y-1 ml-6">
          <li>🔴 Critical Issues: 10 points</li>
          <li>🟠 High Priority: 5 points</li>
          <li>🔵 Medium Issues: 3 points</li>
          <li>⚪ Low Priority: 2 points</li>
        </ul>
        <p className="mt-3 italic">
          Each verified report awards points based on its importance level. Compete with your community to
          become the top reporter!
        </p>
      </div>
    </div>
  );
}
