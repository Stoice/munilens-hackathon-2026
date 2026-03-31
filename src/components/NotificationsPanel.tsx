import React, { useEffect, useRef } from 'react';
import { Report } from '../types';
import { Bell, ShieldAlert, AlertTriangle, Info, CheckCheck, Eye } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useLanguage } from '../i18n/LanguageContext';

export interface Notification {
  id: string;
  report: Report;
  receivedAt: string; // ISO string
  read: boolean;
}

interface NotificationsPanelProps {
  notifications: Notification[];
  onView: (report: Report) => void;
  onMarkAllRead: () => void;
  onMarkRead: (id: string) => void;
  onCriticalAutoOpen: (report: Report) => void;
}

const IMPORTANCE_META: Record<string, { bg: string; border: string; badge: string; icon: React.ReactNode; label: string }> = {
  Critical: {
    bg: 'bg-red-50/70',
    border: 'border-red-200/60',
    badge: 'bg-red-100 text-red-700 border border-red-200',
    icon: <ShieldAlert className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />,
    label: 'CRITICAL ALERT',
  },
  High: {
    bg: 'bg-orange-50/70',
    border: 'border-orange-200/60',
    badge: 'bg-orange-100 text-orange-700 border border-orange-200',
    icon: <AlertTriangle className="w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5" />,
    label: 'HIGH PRIORITY',
  },
  Medium: {
    bg: 'bg-blue-50/70',
    border: 'border-blue-200/60',
    badge: 'bg-blue-100 text-blue-700 border border-blue-200',
    icon: <Bell className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />,
    label: 'NEW REPORT',
  },
  Low: {
    bg: 'bg-gray-50/70',
    border: 'border-gray-200/60',
    badge: 'bg-gray-100 text-gray-600 border border-gray-200',
    icon: <Info className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />,
    label: 'NEW REPORT',
  },
};

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(iso).toLocaleDateString();
}

export default function NotificationsPanel({
  notifications,
  onView,
  onMarkAllRead,
  onMarkRead,
  onCriticalAutoOpen,
}: NotificationsPanelProps) {
  const { t } = useLanguage();
  const unread = notifications.filter((n) => !n.read).length;
  const seenIds = useRef<Set<string>>(new Set());

  // Auto-open full report modal for any new Critical notification
  useEffect(() => {
    const latest = notifications[0];
    if (
      latest &&
      latest.report.importance === 'Critical' &&
      !latest.read &&
      !seenIds.current.has(latest.id)
    ) {
      seenIds.current.add(latest.id);
      onCriticalAutoOpen(latest.report);
    }
  }, [notifications]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 tracking-tight italic font-serif">{t('notif.title')}</h2>
          <p className="text-sm text-gray-500 font-mono">
            {t('notif.liveFeed')} • {notifications.length} {t('notif.total')} • {unread} {t('notif.unread')}
          </p>
        </div>
        {unread > 0 && (
          <button
            onClick={onMarkAllRead}
            className="flex items-center gap-2 px-4 py-2 bg-white/60 backdrop-blur-md border border-white/30 rounded-xl text-xs font-black text-gray-600 uppercase tracking-widest hover:bg-white/80 transition-all"
          >
            <CheckCheck className="w-4 h-4" />
            {t('notif.markAllRead')}
          </button>
        )}
      </header>

      {/* Feed */}
      <div className="bg-white/60 backdrop-blur-md rounded-2xl shadow-sm border border-white/30 overflow-hidden">
        {notifications.length === 0 ? (
          <div className="p-16 text-center text-gray-400 space-y-3">
            <Bell className="w-10 h-10 mx-auto opacity-30" />
            <p className="text-sm font-semibold">{t('notif.emptyTitle')}</p>
            <p className="text-xs text-gray-400">{t('notif.emptyDesc')}</p>
          </div>
        ) : (
          <ul className="divide-y divide-white/20">
            <AnimatePresence initial={false}>
              {notifications.map((n) => {
                const meta = IMPORTANCE_META[n.report.importance ?? 'Medium'] ?? IMPORTANCE_META.Medium;
                return (
                  <motion.li
                    key={n.id}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 12 }}
                    transition={{ duration: 0.2 }}
                    className={`relative flex items-start gap-4 px-6 py-5 backdrop-blur-sm transition-colors
                      ${meta.bg}
                      ${!n.read ? 'border-l-4 ' + meta.border : 'border-l-4 border-transparent'}
                    `}
                  >
                    {/* Corner borders - glass effect */}
                    <span className="pointer-events-none absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-white/60 rounded-tl-md" />
                    <span className="pointer-events-none absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-white/60 rounded-tr-md" />
                    <span className="pointer-events-none absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-white/60 rounded-bl-md" />
                    <span className="pointer-events-none absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-white/60 rounded-br-md" />
                    {/* Icon */}
                    {meta.icon}

                    {/* Body */}
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest">{n.report.importance === 'Critical' ? t('notif.criticalAlert') : n.report.importance === 'High' ? t('notif.highPriority') : t('notif.newReport')}</span>
                        <span className={`px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-wider ${meta.badge}`}>
                          {n.report.importance ?? 'Medium'}
                        </span>
                        {!n.read && (
                          <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
                        )}
                      </div>
                      <p className="text-sm font-bold text-gray-900 italic font-serif truncate">{n.report.type}</p>
                      {n.report.address && (
                        <p className="text-[10px] font-mono text-gray-500 truncate">{n.report.address}</p>
                      )}
                      {n.report.description && (
                        <p className="text-[11px] text-gray-500 line-clamp-2">{n.report.description}</p>
                      )}
                      <p className="text-[9px] font-mono text-gray-400">{timeAgo(n.receivedAt)}</p>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      <button
                        onClick={() => { onMarkRead(n.id); onView(n.report); }}
                        className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-[9px] font-black uppercase tracking-widest rounded-lg hover:bg-blue-700 transition-all active:scale-95"
                      >
                        <Eye className="w-3 h-3" />
                        {t('notif.view')}
                      </button>
                      {!n.read && (
                        <button
                          onClick={() => onMarkRead(n.id)}
                          className="text-[8px] font-bold text-gray-400 hover:text-gray-600 transition-colors uppercase tracking-wider"
                        >
                          {t('notif.dismiss')}
                        </button>
                      )}
                    </div>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        )}
      </div>
    </motion.div>
  );
}
