import React, { useMemo, useState } from 'react';
import { Report, Importance } from '../types';
import { Trophy, Medal, Award, TrendingUp, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useLanguage } from '../i18n/LanguageContext';

interface LeaderboardProps {
  reports: Report[];
}

interface CategoryBreakdown {
  count: number;
  reports: Report[];
}

interface LeaderboardEntry {
  rank: number;
  uid: string;
  username: string;
  totalPoints: number;
  totalReports: number;
  potholes: CategoryBreakdown;
  waterLeaks: CategoryBreakdown;
  electricalDamage: CategoryBreakdown;
  other: CategoryBreakdown;
}

function emptyCategory(): CategoryBreakdown {
  return { count: 0, reports: [] };
}

const IMPORTANCE_COLORS: Record<string, string> = {
  Critical: 'bg-red-100 text-red-700 border border-red-200',
  High:     'bg-orange-100 text-orange-700 border border-orange-200',
  Medium:   'bg-blue-100 text-blue-700 border border-blue-200',
  Low:      'bg-gray-100 text-gray-600 border border-gray-200',
};

const POINTS: Record<Importance, number> = { Critical: 10, High: 5, Medium: 3, Low: 2 };
function getPoints(importance: string | undefined): number {
  return POINTS[(importance as Importance) ?? 'Medium'] ?? 3;
}

interface DrawerProps {
  label: string;
  username: string;
  breakdown: CategoryBreakdown;
  color: string;
  onClose: () => void;
}

function ReportDrawer({ label, username, breakdown, color, onClose }: DrawerProps) {
  const { t } = useLanguage();
  const categoryTotal = breakdown.reports.reduce((s, r) => s + getPoints(r.importance), 0);

  return (
    <div
      className="fixed inset-0 z-[200] flex justify-end"
      onClick={onClose}
    >
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />

      <motion.aside
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', stiffness: 320, damping: 32 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md bg-white shadow-2xl flex flex-col h-full overflow-hidden"
      >
        {/* Header */}
        <div className="p-6 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <div>
            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{username}</p>
            <h3 className="text-lg font-black text-gray-900 mt-0.5">{label}</h3>
            <p className="text-[10px] font-mono text-gray-400 mt-0.5">
              {breakdown.count} {breakdown.count !== 1 ? t('lb.reports') : t('lb.report')} · <span className={`font-black ${color}`}>{categoryTotal} {t('lb.pts')}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Report list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {breakdown.reports
            .slice()
            .sort((a, b) => getPoints(b.importance) - getPoints(a.importance))
            .map((report) => {
              const pts = getPoints(report.importance);
              return (
                <div
                  key={report.id}
                  className="bg-gray-50 rounded-xl p-4 border border-gray-100 flex items-start justify-between gap-4"
                >
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <p className="text-sm font-bold text-gray-900 italic font-serif truncate">{report.type}</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-wider ${
                        IMPORTANCE_COLORS[report.importance ?? 'Medium'] ?? IMPORTANCE_COLORS.Medium
                      }`}>
                        {report.importance ?? 'Medium'}
                      </span>
                      <span className="text-[9px] font-mono text-gray-400">
                        {new Date(report.reportedAt).toLocaleDateString()}
                      </span>
                    </div>
                    {report.address && (
                      <p className="text-[9px] font-mono text-gray-400 truncate">{report.address}</p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xl font-black text-blue-600">{pts}</p>
                    <p className="text-[8px] text-gray-400 font-bold">{t('lb.pts')}</p>
                  </div>
                </div>
              );
            })}
        </div>

        {/* Footer total */}
        <div className="p-4 border-t border-gray-100 flex items-center justify-between bg-gray-50 flex-shrink-0">
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{t('lb.categoryTotal')}</span>
          <span className={`text-2xl font-black ${color}`}>{categoryTotal} pts</span>
        </div>
      </motion.aside>
    </div>
  );
}

function BreakdownCell({
  breakdown, label, username, color = 'text-blue-600',
}: {
  breakdown: CategoryBreakdown;
  label: string;
  username: string;
  color?: string;
}) {
  const [open, setOpen] = useState(false);

  if (breakdown.count === 0) {
    return <span className="text-sm font-bold text-gray-300">0</span>;
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-0.5 cursor-pointer hover:opacity-75 transition-opacity`}
      >
        <span className={`text-sm font-bold underline decoration-dotted underline-offset-2 ${color}`}>
          {breakdown.count}
        </span>
        <span className="text-[7px] text-gray-400">▾</span>
      </button>

      <AnimatePresence>
        {open && (
          <ReportDrawer
            label={label}
            username={username}
            breakdown={breakdown}
            color={color}
            onClose={() => setOpen(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

function categorize(type: string): 'pothole' | 'waterLeak' | 'electrical' | 'other' {
  const t = type.toLowerCase();
  if (t.includes('pothole')) return 'pothole';
  if (t.includes('water')) return 'waterLeak';
  if (t.includes('electrical') || t.includes('electric')) return 'electrical';
  return 'other';
}

export default function Leaderboard({ reports }: LeaderboardProps) {
  const { t } = useLanguage();
  const leaderboard = useMemo<LeaderboardEntry[]>(() => {
    const map = new Map<string, LeaderboardEntry>();

    for (const report of reports) {
      const uid = report.reporterUid;
      const username = report.reporterName || 'Anonymous';

      if (!map.has(uid)) {
        map.set(uid, {
          rank: 0,
          uid,
          username,
          totalPoints: 0,
          totalReports: 0,
          potholes: emptyCategory(),
          waterLeaks: emptyCategory(),
          electricalDamage: emptyCategory(),
          other: emptyCategory(),
        });
      }

      const entry = map.get(uid)!;
      // Keep most recent known name
      if (report.reporterName) entry.username = report.reporterName;

      entry.totalPoints += getPoints(report.importance);
      entry.totalReports += 1;

      const cat = categorize(report.type);
      if (cat === 'pothole') {
        entry.potholes.count += 1;
        entry.potholes.reports.push(report);
      } else if (cat === 'waterLeak') {
        entry.waterLeaks.count += 1;
        entry.waterLeaks.reports.push(report);
      } else if (cat === 'electrical') {
        entry.electricalDamage.count += 1;
        entry.electricalDamage.reports.push(report);
      } else {
        entry.other.count += 1;
        entry.other.reports.push(report);
      }
    }

    return Array.from(map.values())
      .sort((a, b) => {
        if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
        return a.username.localeCompare(b.username);
      })
      .map((entry, i) => ({ ...entry, rank: i + 1 }));
  }, [reports]);

  const RankIcon = ({ rank }: { rank: number }) => {
    if (rank === 1) return <Trophy className="w-5 h-5 text-yellow-500" />;
    if (rank === 2) return <Medal className="w-5 h-5 text-gray-400" />;
    if (rank === 3) return <Award className="w-5 h-5 text-amber-600" />;
    return <span className="text-sm font-black text-gray-400 tabular-nums w-5 text-center">{rank}</span>;
  };

  const rowBg = (rank: number) => {
    if (rank === 1) return 'bg-yellow-50/60 hover:bg-yellow-50';
    if (rank === 2) return 'bg-gray-50/80 hover:bg-gray-100';
    if (rank === 3) return 'bg-amber-50/60 hover:bg-amber-50';
    return 'hover:bg-gray-50';
  };

  const maxPoints = leaderboard[0]?.totalPoints || 1;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className="space-y-8"
    >
      {/* Header */}
      <header>
        <h2 className="text-3xl font-bold text-gray-900 tracking-tight italic font-serif">{t('lb.title')}</h2>
        <p className="text-sm text-gray-500 font-mono">
          {t('lb.scoringActive')} • {leaderboard.length} {t('lb.reportersRanked')}
        </p>
      </header>

      {/* Top 3 podium cards */}
      {leaderboard.length >= 1 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {leaderboard.slice(0, 3).map((entry) => (
            <motion.div
              key={entry.uid}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: entry.rank * 0.05 }}
              className={`bg-white/60 backdrop-blur-md rounded-2xl shadow-sm border p-6 flex flex-col gap-3 ${
                entry.rank === 1
                  ? 'border-yellow-200 shadow-yellow-100'
                  : entry.rank === 2
                  ? 'border-gray-200'
                  : 'border-amber-100 shadow-amber-50'
              }`}
            >
              <div className="flex items-center justify-between">
                <RankIcon rank={entry.rank} />
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  #{entry.rank}
                </span>
              </div>
              <div>
                <p className="font-bold text-gray-900 truncate">{entry.username}</p>
                <p className="text-[10px] font-mono text-gray-400 truncate">{entry.uid.slice(0, 12)}…</p>
              </div>
              <div className="flex items-end gap-2">
                <span className="text-3xl font-black text-blue-600">{entry.totalPoints}</span>
                <span className="text-xs text-gray-400 mb-1">{t('lb.pts')}</span>
              </div>
              {/* Progress bar vs top scorer */}
              <div className="w-full bg-gray-100 rounded-full h-1.5">
                <div
                  className="h-1.5 rounded-full bg-blue-500 transition-all"
                  style={{ width: `${(entry.totalPoints / maxPoints) * 100}%` }}
                />
              </div>
              <p className="text-[10px] text-gray-500">
                {entry.totalReports} {entry.totalReports !== 1 ? t('lb.reports') : t('lb.report')}
              </p>
            </motion.div>
          ))}
        </div>
      )}

      {/* Full table */}
      <div className="bg-white/60 backdrop-blur-md rounded-2xl shadow-sm border border-white/30 overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">{t('lb.fullRankings')}</h3>
          <div className="flex items-center gap-2 text-[10px] font-mono text-gray-400">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>{t('lb.scoringKey')}</span>
          </div>
        </div>

        {leaderboard.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <Trophy className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-semibold">{t('lb.noReportsYet')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50 text-gray-500 text-[10px] uppercase tracking-widest">
                <tr>
                  <th className="px-6 py-4 font-bold">{t('lb.colRank')}</th>
                  <th className="px-6 py-4 font-bold">{t('lb.colUsername')}</th>
                  <th className="px-6 py-4 font-bold text-right">{t('lb.colTotalPoints')}</th>
                  <th className="px-6 py-4 font-bold text-right">{t('lb.colTotalReports')}</th>
                  <th className="px-6 py-4 font-bold text-right">{t('lb.colPotholes')}</th>
                  <th className="px-6 py-4 font-bold text-right">{t('lb.colWaterLeaks')}</th>
                  <th className="px-6 py-4 font-bold text-right">{t('lb.colElectricalDamage')}</th>
                  <th className="px-6 py-4 font-bold text-right">{t('lb.colOther')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {leaderboard.map((entry, index) => (
                  <motion.tr
                    key={entry.uid}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.02 }}
                    className={`transition-colors ${rowBg(entry.rank)}`}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center w-7">
                        <RankIcon rank={entry.rank} />
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-bold text-gray-900 text-sm">{entry.username}</p>
                        <p className="text-[9px] font-mono text-gray-400">{entry.uid.slice(0, 16)}…</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-lg font-black text-blue-600">{entry.totalPoints}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-sm font-bold text-gray-700">{entry.totalReports}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <BreakdownCell breakdown={entry.potholes} label={t('lb.potholes')} username={entry.username} color="text-orange-600" />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <BreakdownCell breakdown={entry.waterLeaks} label={t('lb.waterLeaks')} username={entry.username} color="text-blue-600" />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <BreakdownCell breakdown={entry.electricalDamage} label={t('lb.electricalDamage')} username={entry.username} color="text-yellow-600" />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <BreakdownCell breakdown={entry.other} label={t('lb.otherReports')} username={entry.username} color="text-purple-600" />
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </motion.div>
  );
}
