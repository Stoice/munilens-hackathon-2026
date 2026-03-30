import React, { useMemo } from 'react';
import { Trophy, ArrowRight } from 'lucide-react';
import { calculateLeaderboard, getTopUsers } from '../utils/leaderboardCalculator';

interface LeaderboardWidgetProps {
  reports: any[];
  onViewFull?: () => void;
}

export default function LeaderboardWidget({ reports, onViewFull }: LeaderboardWidgetProps) {
  const topUsers = useMemo(() => {
    const leaderboard = calculateLeaderboard(reports);
    return getTopUsers(leaderboard, 5);
  }, [reports]);

  if (topUsers.length === 0) {
    return null;
  }

  return (
    <div
      className="rounded-2xl p-6 space-y-4 border-2"
      style={{ backgroundColor: '#fff', borderColor: '#d9c9a8' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="w-6 h-6" style={{ color: '#f97316' }} />
          <h3 className="font-black text-lg" style={{ color: '#1a2e5a' }}>
            Top Reporters
          </h3>
        </div>
        {onViewFull && (
          <button
            onClick={onViewFull}
            className="flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold transition-all hover:opacity-80"
            style={{ backgroundColor: '#f0f0f0', color: '#1a6fa8' }}
          >
            View Full
            <ArrowRight className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Rankings */}
      <div className="space-y-2">
        {topUsers.map((user, idx) => (
          <div
            key={user.userId}
            className="flex items-center justify-between p-3 rounded-lg"
            style={{ backgroundColor: '#f0f0f0' }}
          >
            <div className="flex items-center gap-3 flex-1">
              <div className="w-6 h-6 rounded-full flex items-center justify-center font-black text-sm" style={{ backgroundColor: '#1a6fa8', color: '#fff' }}>
                {idx + 1}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm truncate" style={{ color: '#1a2e5a' }}>
                  {user.displayName}
                </p>
                <p className="text-xs" style={{ color: '#9e9e9e' }}>
                  {user.reportsCount} report{user.reportsCount !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-black" style={{ color: '#1a6fa8' }}>
                {user.totalPoints}
              </p>
              <p className="text-xs" style={{ color: '#9e9e9e' }}>
                pts
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Point Info */}
      <div
        className="text-xs p-3 rounded-lg text-center space-y-1"
        style={{ backgroundColor: '#f0f0f0' }}
      >
        <p style={{ color: '#9e9e9e' }}>Critical (10) • High (5) • Medium (3) • Low (2)</p>
      </div>
    </div>
  );
}
