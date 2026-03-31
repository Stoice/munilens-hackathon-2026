import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { Report, Importance } from '../types';
import { Trophy, X, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useLanguage } from '../i18n/LanguageContext';

const POINTS: Record<Importance, number> = { Critical: 10, High: 5, Medium: 3, Low: 2 };

function getPoints(importance: string | undefined) {
  return POINTS[(importance as Importance) ?? 'Medium'] ?? 3;
}

function categorize(type: string): 'pothole' | 'waterLeak' | 'electrical' | 'other' {
  const t = type.toLowerCase();
  if (t.includes('pothole')) return 'pothole';
  if (t.includes('water')) return 'waterLeak';
  if (t.includes('electrical') || t.includes('electric')) return 'electrical';
  return 'other';
}

const IMPORTANCE_COLORS: Record<string, string> = {
  Critical: 'bg-red-100 text-red-700 border border-red-200',
  High:     'bg-orange-100 text-orange-700 border border-orange-200',
  Medium:   'bg-blue-100 text-blue-700 border border-blue-200',
  Low:      'bg-gray-100 text-gray-600 border border-gray-200',
};

interface CategoryTileProps {
  label: string;
  reports: Report[];
  bg: string;
  textColor: string;
  onClick: (label: string, reports: Report[]) => void;
}

function CategoryTile({ label, reports, bg, textColor, onClick }: CategoryTileProps) {
  const { t } = useLanguage();
  const pts = reports.reduce((s, r) => s + getPoints(r.importance), 0);
  return (
    <button
      onClick={() => reports.length > 0 && onClick(label, reports)}
      className={`${bg} rounded-xl p-4 text-left w-full transition-all border border-transparent ${
        reports.length > 0 ? 'hover:border-gray-200 hover:shadow-sm cursor-pointer' : 'opacity-50 cursor-default'
      }`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className={`text-xl font-black ${textColor}`}>{reports.length}</p>
          <p className="text-[8px] text-gray-400 uppercase tracking-wider font-bold mt-0.5">{label}</p>
        </div>
        <div className="text-right">
          <p className={`text-sm font-black ${textColor}`}>{pts} {t('score.pts')}</p>
          {reports.length > 0 && <ChevronRight className="w-3 h-3 text-gray-300 ml-auto mt-0.5" />}
        </div>
      </div>
    </button>
  );
}

interface DrawerProps {
  label: string;
  reports: Report[];
  onClose: () => void;
}

function ReportDrawer({ label, reports, onClose }: DrawerProps) {
  const { t } = useLanguage();
  const total = reports.reduce((s, r) => s + getPoints(r.importance), 0);
  return (
    <div className="fixed inset-0 z-[200] flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
      <motion.aside
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', stiffness: 320, damping: 32 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md bg-white shadow-2xl flex flex-col h-full"
      >
        {/* Header */}
        <div className="p-6 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <div>
            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{t('score.yourReports')}</p>
            <h3 className="text-lg font-black text-gray-900 mt-0.5">{label}</h3>
            <p className="text-[10px] font-mono text-gray-400 mt-0.5">
              {reports.length} {reports.length !== 1 ? t('score.reports') : t('score.report')} · <span className="font-black text-blue-600">{total} {t('score.pts')}</span>
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Report list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {reports
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
                    <p className="text-[8px] text-gray-400 font-bold">pts</p>
                  </div>
                </div>
              );
            })}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 flex items-center justify-between bg-gray-50 flex-shrink-0">
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{t('score.categoryTotal')}</span>
          <span className="text-2xl font-black text-blue-600">{total} {t('score.pts')}</span>
        </div>
      </motion.aside>
    </div>
  );
}

export default function CitizenScoreCard() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawer, setDrawer] = useState<{ label: string; reports: Report[] } | null>(null);
  const { t } = useLanguage();

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) { setLoading(false); return; }
    const q = query(collection(db, 'reports'), where('reporterUid', '==', uid));
    getDocs(q)
      .then(snap => {
        setReports(snap.docs.map(d => ({ id: d.id, ...d.data() } as Report)));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading || reports.length === 0) return null;

  const totalPoints = reports.reduce((sum, r) => sum + getPoints(r.importance), 0);

  const categorized = {
    pothole:    reports.filter(r => categorize(r.type) === 'pothole'),
    waterLeak:  reports.filter(r => categorize(r.type) === 'waterLeak'),
    electrical: reports.filter(r => categorize(r.type) === 'electrical'),
    other:      reports.filter(r => categorize(r.type) === 'other'),
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white/60 backdrop-blur-md rounded-2xl shadow-sm border border-white/30 p-6 max-w-xs mx-auto text-center space-y-4"
      >
        <div className="flex items-center justify-center gap-2">
          <Trophy className="w-4 h-4 text-yellow-500" />
          <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{t('score.yourScore')}</h3>
        </div>

        <div>
          <p className="text-5xl font-black text-blue-600">{totalPoints}</p>
          <p className="text-xs text-gray-400 font-semibold mt-1">{t('score.totalPoints')}</p>
        </div>

        <p className="text-[9px] text-gray-400 font-mono">{t('score.clickCategory')}</p>

        <div className="grid grid-cols-2 gap-2 text-left">
          <CategoryTile label={t('score.potholes')}          reports={categorized.pothole}    bg="bg-orange-50" textColor="text-orange-600" onClick={(l, r) => setDrawer({ label: l, reports: r })} />
          <CategoryTile label={t('score.waterLeaks')}        reports={categorized.waterLeak}  bg="bg-blue-50"   textColor="text-blue-600"   onClick={(l, r) => setDrawer({ label: l, reports: r })} />
          <CategoryTile label={t('score.electricalDamage')}  reports={categorized.electrical} bg="bg-yellow-50" textColor="text-yellow-600" onClick={(l, r) => setDrawer({ label: l, reports: r })} />
          <CategoryTile label={t('score.other')}              reports={categorized.other}      bg="bg-purple-50" textColor="text-purple-600" onClick={(l, r) => setDrawer({ label: l, reports: r })} />
        </div>

        <p className="text-[9px] text-gray-300 font-mono">{t('score.pointsKey')}</p>
      </motion.div>

      <AnimatePresence>
        {drawer && (
          <ReportDrawer
            label={drawer.label}
            reports={drawer.reports}
            onClose={() => setDrawer(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
