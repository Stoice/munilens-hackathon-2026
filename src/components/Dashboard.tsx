import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { db, auth } from '../firebase';
import { collection, query, orderBy, onSnapshot, limit, doc, getDoc, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { generateWeeklyReport } from '../services/gemini';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Report, UserProfile } from '../types';
import {
  FileText, Map as MapIcon, AlertTriangle, CheckCircle, Clock, Loader2, Download,
  Users as UsersIcon, LayoutDashboard, X, Eye, MapPin,
  Bell, ShieldAlert, Search, Filter, ChevronUp, ChevronDown, ChevronRight,
  Trophy, Sparkles, TrendingUp, Lightbulb, Camera
} from 'lucide-react';
import { toast } from 'sonner';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';
import UserManagement from './UserManagement';
import Leaderboard from './Leaderboard';
import NotificationsPanel, { Notification as AppNotification } from './NotificationsPanel';
import jsPDF from 'jspdf';
import { Viewer, Entity, PointGraphics, EntityDescription } from 'resium';
import { Cartesian3, Color } from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import { motion, AnimatePresence } from 'motion/react';
import { useLanguage } from '../i18n/LanguageContext';

// Colors for charts
const COLORS = ['#3b82f6', '#ef4444', '#f59e0b', '#10b981', '#8b5cf6', '#6b7280'];

const getImportanceColor = (importance: string) => {
  switch (importance) {
    case 'Critical': return 'bg-red-100 text-red-700 border border-red-200';
    case 'High': return 'bg-orange-100 text-orange-700 border border-orange-200';
    case 'Medium': return 'bg-blue-100 text-blue-700 border border-blue-200';
    case 'Low': return 'bg-gray-100 text-gray-700 border border-gray-200';
    default: return 'bg-blue-100 text-blue-700 border border-blue-200';
  }
};

interface AiReportData {
  headline: string;
  executiveSummary: string;
  riskLevel: 'Critical' | 'High' | 'Medium' | 'Low';
  riskRationale: string;
  priorityActions: Array<{
    priority: number;
    title: string;
    department: string;
    timeframe: string;
    description: string;
    importance: 'Critical' | 'High' | 'Medium' | 'Low';
  }>;
  trendInsights: Array<{ title: string; description: string }>;
  recommendations: string[];
}

const NOTIF_READ_KEY = 'munilens_read_report_ids';

// Module-level — survive Dashboard re-mounts so re-mounting never re-fires
// notifications for reports that were already known in this browser session.
let _seenReportIds  = new Set<string>();
let _initialLoadDone = false;

function getReadReportIds(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(NOTIF_READ_KEY) || '[]')); }
  catch { return new Set(); }
}
function persistReadReportId(reportId: string) {
  try {
    const ids = getReadReportIds();
    ids.add(reportId);
    localStorage.setItem(NOTIF_READ_KEY, JSON.stringify([...ids]));
  } catch {}
}
function persistAllReadReportIds(reportIds: string[]) {
  try {
    const ids = getReadReportIds();
    reportIds.forEach(id => ids.add(id));
    localStorage.setItem(NOTIF_READ_KEY, JSON.stringify([...ids]));
  } catch {}
}

export default function Dashboard() {
  const { t } = useLanguage();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiReport, setAiReport] = useState<AiReportData | null>(null);
  const [generatingAi, setGeneratingAi] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'leaderboard' | 'notifications'>('overview');
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [miniReport, setMiniReport] = useState<Report | null>(null);
  const [statDrawer, setStatDrawer] = useState<{ label: string; reports: Report[]; accent: string } | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: keyof Report | 'location'; direction: 'asc' | 'desc' }>({ key: 'reportedAt', direction: 'desc' });
  const [filterConfig, setFilterConfig] = useState({ status: 'All', importance: 'All', type: 'All' });

  const aiReportRef = useRef<HTMLDivElement>(null);
  const isAdminRef = useRef(false);

  useEffect(() => {
    isAdminRef.current = userProfile?.role === 'admin';
  }, [userProfile]);

  useEffect(() => {
    const fetchProfile = async () => {
      if (auth.currentUser) {
        const docRef = doc(db, 'users', auth.currentUser.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setUserProfile(docSnap.data() as UserProfile);
        }
      }
    };
    fetchProfile();
  }, []);

  useEffect(() => {
    // Single stable subscription — admin status is read from isAdminRef (kept in sync
    // by the effect above) so this effect never needs to restart when userProfile loads.
    const path = 'reports';
    const q = query(collection(db, path), orderBy('reportedAt', 'desc'), limit(100));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Report));

      // Notification logic for new reports (real-time only, not initial load)
      if (_initialLoadDone && isAdminRef.current) {
        const readIds = getReadReportIds();
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added' && !_seenReportIds.has(change.doc.id)) {
            const newReport = { id: change.doc.id, ...change.doc.data() } as Report;
            setNotifications(prev => [{
              id: `${newReport.id}-${Date.now()}`,
              report: newReport,
              receivedAt: new Date().toISOString(),
              read: readIds.has(newReport.id ?? ''),
            }, ...prev]);

            // Fire a prominent alert for critical reports regardless of active tab
            if (newReport.importance === 'Critical') {
              toast.error(`CRITICAL ALERT — ${newReport.type}`, {
                description: `A critical infrastructure report has been submitted. Immediate action required.`,
                icon: <ShieldAlert className="w-5 h-5 text-red-500" />,
                duration: Infinity,
                action: {
                  label: 'View',
                  onClick: () => {
                    setSelectedReport(newReport);
                    setActiveTab('overview');
                  },
                },
              });
            } else {
              toast(`New Report — ${newReport.type}`, {
                description: `Importance: ${newReport.importance ?? 'Unknown'}`,
                icon: <Bell className="w-4 h-4 text-blue-500" />,
                duration: 6000,
              });
            }
          }
        });
      }

      // Track all known IDs so real-time adds are never confused with initial-load docs
      snapshot.docs.forEach(d => _seenReportIds.add(d.id));

      setReports(data);
      setLoading(false);
      _initialLoadDone = true;
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });
    return () => unsubscribe();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const getStats = () => {
    const total = reports.length;
    const typeCounts: Record<string, number> = {};
    const statusCounts: Record<string, number> = { 'Open': 0, 'In Progress': 0, 'Resolved': 0 };
    const importanceCounts: Record<string, number> = { 'Critical': 0, 'High': 0, 'Medium': 0, 'Low': 0 };
    let sumLat = 0;
    let sumLng = 0;

    reports.forEach(r => {
      typeCounts[r.type] = (typeCounts[r.type] || 0) + 1;
      statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;
      if (r.importance) {
        importanceCounts[r.importance] = (importanceCounts[r.importance] || 0) + 1;
      }
      sumLat += r.latitude;
      sumLng += r.longitude;
    });

    const topFault = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'None';

    return {
      total,
      topFault,
      avgLat: total ? sumLat / total : 0,
      avgLng: total ? sumLng / total : 0,
      typeData: Object.entries(typeCounts).map(([name, value]) => ({ name, value })),
      statusData: Object.entries(statusCounts).map(([name, value]) => ({ name, value })),
      importanceData: Object.entries(importanceCounts).map(([name, value]) => ({ name, value })),
      statusBreakdown: statusCounts,
      importanceBreakdown: importanceCounts
    };
  };

  const handleSort = (key: keyof Report | 'location') => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const filteredAndSortedReports = reports
    .filter(r => {
      const statusMatch = filterConfig.status === 'All' || r.status === filterConfig.status;
      const importanceMatch = filterConfig.importance === 'All' || r.importance === filterConfig.importance;
      const typeMatch = filterConfig.type === 'All' || r.type === filterConfig.type;
      return statusMatch && importanceMatch && typeMatch;
    })
    .sort((a, b) => {
      let valA: any = a[sortConfig.key as keyof Report];
      let valB: any = b[sortConfig.key as keyof Report];

      if (sortConfig.key === 'location') {
        valA = a.address || `${a.latitude},${a.longitude}`;
        valB = b.address || `${b.latitude},${b.longitude}`;
      }

      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

  const handleGenerateAiReport = async () => {
    setGeneratingAi(true);
    try {
      const stats = getStats();
      const result = await generateWeeklyReport(stats, reports, language);
      setAiReport(result);
    } catch (err) {
      console.error("AI Report failed", err);
    } finally {
      setGeneratingAi(false);
    }
  };

  const loadImageAsDataUrl = (src: string): Promise<string> =>
    new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        canvas.getContext('2d')!.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/jpeg'));
      };
      img.onerror = () => resolve('');
      img.src = src;
    });

  const exportToPdf = async () => {
    if (!aiReport) return;

    const logoDataUrl = await loadImageAsDataUrl('/app-icon.jpeg');

    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageW = pdf.internal.pageSize.getWidth();
    const marginL = 18;
    const marginR = 18;
    const contentW = pageW - marginL - marginR;
    const pageH = pdf.internal.pageSize.getHeight();
    let y = 20;

    const checkPageBreak = (needed = 10) => {
      if (y + needed > pageH - 16) {
        pdf.addPage();
        y = 20;
      }
    };

    const writeLine = (text: string, opts: { size?: number; bold?: boolean; color?: [number,number,number]; indent?: number } = {}) => {
      const { size = 10, bold = false, color = [30, 30, 30], indent = 0 } = opts;
      pdf.setFontSize(size);
      pdf.setFont('helvetica', bold ? 'bold' : 'normal');
      pdf.setTextColor(...color);
      const lines = pdf.splitTextToSize(text, contentW - indent);
      checkPageBreak(lines.length * (size * 0.4 + 1.5));
      pdf.text(lines, marginL + indent, y);
      y += lines.length * (size * 0.4 + 1.5);
    };

    const gap = (n = 4) => { y += n; };
    const rule = () => {
      checkPageBreak(4);
      pdf.setDrawColor(220, 220, 230);
      pdf.line(marginL, y, marginL + contentW, y);
      y += 4;
    };

    const riskColors: Record<string, [number,number,number]> = {
      Critical: [220, 38, 38],
      High:     [234, 88, 12],
      Medium:   [37, 99, 235],
      Low:      [107, 114, 128],
    };

    // ── Header block ──────────────────────────────────────────────
    const headerH = 18;
    pdf.setFillColor(37, 99, 235);
    pdf.rect(0, 0, pageW, headerH, 'F');

    // Logo in header
    const logoSize = 11;
    const logoPad = 3.5;
    if (logoDataUrl) {
      pdf.addImage(logoDataUrl, 'JPEG', logoPad, (headerH - logoSize) / 2, logoSize, logoSize, undefined, 'FAST');
    }
    const textX = logoDataUrl ? logoPad + logoSize + 3 : marginL;
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(255, 255, 255);
    pdf.text('MUNILENS · AI OPERATIONAL BRIEFING', textX, headerH / 2 + 1.5);
    const dateStr = new Date().toLocaleDateString('en-ZA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    pdf.setFont('helvetica', 'normal');
    pdf.text(dateStr, pageW - marginR, headerH / 2 + 1.5, { align: 'right' });
    y = headerH + 8;

    // Risk badge
    const rc = riskColors[aiReport.riskLevel] ?? [107, 114, 128];
    pdf.setFillColor(...rc);
    pdf.roundedRect(marginL, y - 4, 28, 6, 1, 1, 'F');
    pdf.setFontSize(7);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(255, 255, 255);
    pdf.text(`${aiReport.riskLevel.toUpperCase()} RISK`, marginL + 14, y, { align: 'center' });
    y += 5;

    writeLine(aiReport.headline, { size: 15, bold: true, color: [17, 24, 39] });
    gap(1);
    writeLine(aiReport.riskRationale, { size: 9, color: [107, 114, 128] });
    gap(4);
    rule();

    // ── Executive Summary ─────────────────────────────────────────
    writeLine('EXECUTIVE SUMMARY', { size: 8, bold: true, color: [107, 114, 128] });
    gap(2);
    writeLine(aiReport.executiveSummary, { size: 10, color: [31, 41, 55] });
    gap(5);
    rule();

    // ── Priority Actions ──────────────────────────────────────────
    writeLine('PRIORITY ACTIONS', { size: 8, bold: true, color: [107, 114, 128] });
    gap(2);
    aiReport.priorityActions.forEach((action) => {
      checkPageBreak(22);
      const ac = riskColors[action.importance] ?? [107, 114, 128];
      pdf.setFillColor(245, 247, 250);
      pdf.roundedRect(marginL, y - 1, contentW, 18, 2, 2, 'F');
      pdf.setFillColor(...ac);
      pdf.roundedRect(marginL, y - 1, 6, 18, 1, 1, 'F');
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(255, 255, 255);
      pdf.text(`${action.priority}`, marginL + 3, y + 7, { align: 'center' });
      const tx = marginL + 9;
      pdf.setTextColor(17, 24, 39);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(10);
      pdf.text(action.title, tx, y + 4);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      pdf.setTextColor(107, 114, 128);
      pdf.text(`${action.department}  ·  ${action.timeframe}`, tx, y + 9);
      const descLines = pdf.splitTextToSize(action.description, contentW - 12);
      pdf.setTextColor(55, 65, 81);
      pdf.setFontSize(8.5);
      pdf.text(descLines, tx, y + 14);
      y += 21;
      gap(2);
    });
    gap(1);
    rule();

    // ── Trend Insights ────────────────────────────────────────────
    writeLine('TREND INSIGHTS', { size: 8, bold: true, color: [107, 114, 128] });
    gap(2);
    aiReport.trendInsights.forEach((t) => {
      checkPageBreak(14);
      writeLine(t.title, { size: 10, bold: true, color: [17, 24, 39] });
      writeLine(t.description, { size: 9, color: [75, 85, 99], indent: 3 });
      gap(3);
    });
    rule();

    // ── Recommendations ───────────────────────────────────────────
    writeLine('STRATEGIC RECOMMENDATIONS', { size: 8, bold: true, color: [107, 114, 128] });
    gap(2);
    aiReport.recommendations.forEach((rec, i) => {
      checkPageBreak(10);
      writeLine(`${String(i + 1).padStart(2, '0')}  ${rec}`, { size: 9.5, color: [31, 41, 55], indent: 2 });
      gap(2);
    });

    // ── Footer ────────────────────────────────────────────────────
    const totalPages = (pdf as any).internal.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      pdf.setPage(p);
      // Logo watermark bottom-left
      if (logoDataUrl) {
        pdf.addImage(logoDataUrl, 'JPEG', marginL, pageH - 10, 6, 6, undefined, 'FAST');
      }
      pdf.setFontSize(7.5);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(180, 180, 180);
      pdf.text(`MuniLens Operational Briefing  ·  Generated ${new Date().toLocaleString()}  ·  Page ${p} of ${totalPages}`,
        pageW / 2, pageH - 6, { align: 'center' });
    }

    pdf.save(`MuniLens_Briefing_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [triggeringCamera, setTriggeringCamera] = useState(false);
  const [modalMapReady, setModalMapReady] = useState(false);

  useEffect(() => {
    if (selectedReport) {
      const timer = setTimeout(() => setModalMapReady(true), 500);
      return () => {
        clearTimeout(timer);
        setModalMapReady(false);
      };
    }
  }, [selectedReport]);

  const updateReportStatus = async (reportId: string, newStatus: Report['status']) => {
    const path = `reports/${reportId}`;
    setUpdatingStatus(true);
    try {
      await updateDoc(doc(db, 'reports', reportId), {
        status: newStatus
      });
      
      // Close modals and return to dashboard overview as requested
      setSelectedReport(null);
      setMiniReport(null);
      setActiveTab('overview');

      toast.success(`Status updated to ${newStatus === 'Resolved' ? 'Solved' : newStatus}`, {
        description: `Report ${reportId.slice(-8).toUpperCase()} has been updated successfully.`,
        icon: <CheckCircle className="w-4 h-4 text-green-500" />
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
      toast.error("Failed to update status");
    } finally {
      setUpdatingStatus(false);
    }
  };

  const triggerCamera = async (reportId: string) => {
    setTriggeringCamera(true);
    try {
      await addDoc(collection(db, 'piCommands'), {
        type:        'CAPTURE',
        reportId:    reportId,
        issuedBy:    auth.currentUser?.uid ?? 'admin',
        issuedAt:    serverTimestamp(),
        processed:   false,
      });
      toast.success('Camera Triggered', {
        description: `Raspberry Pi camera command sent for report ${reportId.slice(-8).toUpperCase()}.`,
        icon: <Camera className="w-4 h-4 text-blue-500" />,
        duration: 5000,
      });
    } catch (err) {
      toast.error('Camera trigger failed', { description: 'Could not send command to Raspberry Pi.' });
    } finally {
      setTriggeringCamera(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
      </div>
    );
  }

  const stats = getStats();
  const isAdmin = userProfile?.role === 'admin';

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white/60 backdrop-blur-md border-r border-white/30 flex flex-col hidden md:flex">
        <div className="p-6 border-b border-gray-100">
          <h1 className="text-xl font-black text-blue-600 tracking-tighter uppercase italic">MuniLens</h1>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">{t('dash.municipalControl')}</p>
        </div>
        
        <nav className="flex-1 p-4 space-y-1">
          <button 
            onClick={() => setActiveTab('overview')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
              activeTab === 'overview' ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            <LayoutDashboard className="w-5 h-5" />
            {t('dash.overview')}
          </button>
          <Link
            to="/map"
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all text-gray-500 hover:bg-gray-50"
          >
            <MapIcon className="w-5 h-5" />
            {t('dash.mapView')}
          </Link>
          <button 
            onClick={() => setActiveTab('leaderboard')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
              activeTab === 'leaderboard' ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            <Trophy className="w-5 h-5" />
            {t('dash.leaderboard')}
          </button>
          {isAdmin && (
            <button
              onClick={() => setActiveTab('notifications')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                activeTab === 'notifications' ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              <div className="relative">
                <Bell className="w-5 h-5" />
                {notifications.filter(n => !n.read).length > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white text-[8px] font-black rounded-full flex items-center justify-center">
                    {notifications.filter(n => !n.read).length > 9 ? '9+' : notifications.filter(n => !n.read).length}
                  </span>
                )}
              </div>
              {t('dash.notifications')}
            </button>
          )}
          {isAdmin && (
            <button 
              onClick={() => setActiveTab('users')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                activeTab === 'users' ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              <UsersIcon className="w-5 h-5" />
              {t('dash.userManagement')}
            </button>
          )}
        </nav>

        <div className="p-4 border-t border-gray-100">
          <div className="bg-gray-50 rounded-xl p-4 flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-xs">
              {userProfile?.displayName?.[0] || 'U'}
            </div>
            <div className="flex flex-col overflow-hidden">
              <span className="text-xs font-bold text-gray-900 truncate">{userProfile?.displayName || 'Admin User'}</span>
              <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">{userProfile?.role}</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
        <AnimatePresence mode="wait">
          {activeTab === 'overview' ? (
            <motion.div 
              key="overview"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="space-y-8"
            >
              <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-3xl font-bold text-gray-900 tracking-tight italic font-serif">{t('dash.dashboardOverview')}</h2>
                  <p className="text-sm text-gray-500 font-mono">{t('dash.systemOperational')} • {reports.length} {t('dash.activeReports')}</p>
                </div>
                {isAdmin && (
                  <button 
                    onClick={handleGenerateAiReport}
                    disabled={generatingAi}
                    className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg hover:bg-blue-700 transition-all disabled:opacity-50 active:scale-95"
                  >
                    {generatingAi ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileText className="w-5 h-5" />}
                    <span>{generatingAi ? t('dash.generatingReport') : t('dash.generateAiReport')}</span>
                  </button>
                )}
              </header>

              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard icon={<AlertTriangle className="text-red-500" />} label={t('dash.totalReports')} value={stats.total}
                  onClick={() => setStatDrawer({ label: t('dash.totalReports'), reports, accent: 'text-red-500' })} />
                <StatCard icon={<Clock className="text-amber-500" />} label={t('dash.activeIssues')} value={stats.statusBreakdown['Open'] + stats.statusBreakdown['In Progress']}
                  onClick={() => setStatDrawer({ label: t('dash.activeIssues'), reports: reports.filter(r => r.status === 'Open' || r.status === 'In Progress'), accent: 'text-amber-500' })} />
                <StatCard icon={<CheckCircle className="text-green-500" />} label={t('dash.resolved')} value={stats.statusBreakdown['Resolved']}
                  onClick={() => setStatDrawer({ label: t('dash.resolved'), reports: reports.filter(r => r.status === 'Resolved'), accent: 'text-green-500' })} />
                <StatCard icon={<MapIcon className="text-blue-500" />} label={t('dash.topCategory')} value={stats.topFault}
                  onClick={() => setStatDrawer({ label: `${t('dash.topCategory')}: ${stats.topFault}`, reports: reports.filter(r => r.type === stats.topFault), accent: 'text-blue-500' })} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {/* Charts */}
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.1 }}
                  className="bg-white/60 backdrop-blur-md p-6 rounded-2xl shadow-sm border border-white/30 space-y-6 flex flex-col h-[400px] hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center justify-between flex-shrink-0">
                    <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">{t('dash.faultDistribution')}</h3>
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                  </div>
                  <div className="flex-1 min-h-0">
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={stats.typeData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94A3B8'}} />
                        <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94A3B8'}} />
                        <Tooltip 
                          contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                        />
                        <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </motion.div>

                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.2 }}
                  className="bg-white/60 backdrop-blur-md p-6 rounded-2xl shadow-sm border border-white/30 space-y-6 flex flex-col h-[400px] hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center justify-between flex-shrink-0">
                    <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">{t('dash.statusBreakdown')}</h3>
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  </div>
                  <div className="flex-1 min-h-0">
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={stats.statusData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {stats.statusData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </motion.div>

                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.3 }}
                  className="bg-white/60 backdrop-blur-md p-6 rounded-2xl shadow-sm border border-white/30 space-y-6 flex flex-col h-[400px] hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center justify-between flex-shrink-0">
                    <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">{t('dash.importanceLevels')}</h3>
                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  </div>
                  <div className="flex-1 min-h-0">
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={stats.importanceData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F1F5F9" />
                        <XAxis type="number" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94A3B8'}} />
                        <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94A3B8'}} />
                        <Tooltip 
                          contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                        />
                        <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                          {stats.importanceData.map((entry, index) => (
                            <Cell 
                              key={`cell-${index}`} 
                              fill={
                                entry.name === 'Critical' ? '#ef4444' :
                                entry.name === 'High' ? '#f59e0b' :
                                entry.name === 'Medium' ? '#3b82f6' :
                                '#6b7280'
                              } 
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </motion.div>
              </div>

              {/* AI Report Briefing */}
              {aiReport && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-white/60 backdrop-blur-md rounded-2xl shadow-xl border border-white/30 overflow-hidden"
                >
                  {/* Briefing Header */}
                  <div className="px-8 py-6 border-b border-white/30 bg-gradient-to-r from-blue-500/10 via-indigo-500/5 to-transparent flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="flex items-center gap-1.5 text-[8px] font-black text-blue-500 uppercase tracking-widest">
                          <Sparkles className="w-3 h-3" />
                          {t('dash.aiOperationalBriefing')}
                        </span>
                        <span className={`px-2.5 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-wider ${getImportanceColor(aiReport.riskLevel)}`}>
                          {aiReport.riskLevel} Risk
                        </span>
                        <span className="text-[8px] font-mono text-gray-400">
                          {new Date().toLocaleDateString('en-ZA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                        </span>
                      </div>
                      <h2 className="text-2xl font-black text-gray-900 italic font-serif leading-tight">{aiReport.headline}</h2>
                      <p className="text-xs text-gray-500">{aiReport.riskRationale}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={exportToPdf}
                        className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white text-[9px] font-black uppercase tracking-widest rounded-xl hover:bg-blue-700 transition-all active:scale-95"
                      >
                        <Download className="w-3 h-3" />
                        {t('dash.exportPdf')}
                      </button>
                      <button className="p-2 hover:bg-gray-100/60 rounded-full text-gray-400 transition-colors" onClick={() => setAiReport(null)}>
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="p-8 space-y-8">
                    {/* Executive Summary */}
                    <div>
                      <h3 className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-3">{t('dash.executiveSummary')}</h3>
                      <p className="text-sm text-gray-700 leading-relaxed bg-white/50 rounded-xl p-5 border border-white/40">{aiReport.executiveSummary}</p>
                    </div>

                    {/* Priority Actions */}
                    <div>
                      <h3 className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-3">{t('dash.priorityActions')}</h3>
                      <div className="space-y-3">
                        {aiReport.priorityActions.map((action) => (
                          <div key={action.priority} className="flex gap-4 bg-white/50 rounded-xl p-4 border border-white/40 hover:bg-white/70 transition-colors">
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm flex-shrink-0 ${getImportanceColor(action.importance)}`}>
                              {action.priority}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <span className="text-sm font-black text-gray-900">{action.title}</span>
                                <span className={`px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-wider ${getImportanceColor(action.importance)}`}>
                                  {action.importance}
                                </span>
                              </div>
                              <div className="flex items-center gap-3 mb-1.5 flex-wrap">
                                <span className="text-[9px] font-mono text-gray-400">{action.department}</span>
                                <span className="text-[9px] font-mono text-blue-500 font-bold">⏱ {action.timeframe}</span>
                              </div>
                              <p className="text-xs text-gray-600 leading-relaxed">{action.description}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Trends + Recommendations */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h3 className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                          <TrendingUp className="w-3 h-3" />{t('dash.trendInsights')}
                        </h3>
                        <div className="space-y-2">
                          {aiReport.trendInsights.map((t, i) => (
                            <div key={i} className="bg-white/50 rounded-xl p-4 border border-white/40">
                              <p className="text-xs font-black text-gray-800 mb-1">{t.title}</p>
                              <p className="text-[11px] text-gray-500 leading-relaxed">{t.description}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <h3 className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                          <Lightbulb className="w-3 h-3" />{t('dash.strategicRecommendations')}
                        </h3>
                        <div className="space-y-2">
                          {aiReport.recommendations.map((rec, i) => (
                            <div key={i} className="flex gap-3 bg-white/50 rounded-xl p-3 border border-white/40">
                              <span className="text-[9px] font-black text-blue-500 flex-shrink-0 mt-0.5 font-mono">{String(i + 1).padStart(2, '0')}</span>
                              <p className="text-[11px] text-gray-600 leading-relaxed">{rec}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Recent Reports Table */}
              <div className="bg-white/60 backdrop-blur-md rounded-2xl shadow-sm border border-white/30 overflow-hidden">
                <div className="p-6 border-b border-white/30 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">{t('dash.recentReports')}</h3>
                    <span className="text-[10px] bg-gray-100 px-2 py-1 rounded font-bold text-gray-500 tracking-tighter">{t('dash.liveFeed')}</span>
                  </div>
                  
                  {/* Filters */}
                  <div className="flex flex-wrap gap-4 pt-2">
                    <div className="flex flex-col gap-1">
                      <label className="text-[8px] font-black text-gray-400 uppercase tracking-widest ml-1">{t('dash.filterStatus')}</label>
                      <select 
                        value={filterConfig.status}
                        onChange={(e) => setFilterConfig(prev => ({ ...prev, status: e.target.value }))}
                        className="px-3 py-1.5 bg-gray-50 border border-gray-100 rounded-lg text-[10px] font-bold text-gray-700 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                      >
                        <option value="All">{t('dash.allStatuses')}</option>
                        <option value="Open">{t('dash.open')}</option>
                        <option value="In Progress">{t('dash.inProgress')}</option>
                        <option value="Resolved">{t('dash.resolved')}</option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[8px] font-black text-gray-400 uppercase tracking-widest ml-1">{t('dash.filterImportance')}</label>
                      <select 
                        value={filterConfig.importance}
                        onChange={(e) => setFilterConfig(prev => ({ ...prev, importance: e.target.value }))}
                        className="px-3 py-1.5 bg-gray-50 border border-gray-100 rounded-lg text-[10px] font-bold text-gray-700 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                      >
                        <option value="All">{t('dash.allImportance')}</option>
                        <option value="Critical">Critical</option>
                        <option value="High">High</option>
                        <option value="Medium">Medium</option>
                        <option value="Low">Low</option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[8px] font-black text-gray-400 uppercase tracking-widest ml-1">{t('dash.filterType')}</label>
                      <select 
                        value={filterConfig.type}
                        onChange={(e) => setFilterConfig(prev => ({ ...prev, type: e.target.value }))}
                        className="px-3 py-1.5 bg-gray-50 border border-gray-100 rounded-lg text-[10px] font-bold text-gray-700 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                      >
                        <option value="All">{t('dash.allTypes')}</option>
                        {Array.from(new Set(reports.map(r => r.type))).map(type => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-gray-50 text-gray-500 text-[10px] uppercase tracking-widest">
                      <tr>
                        <th className="px-6 py-4 font-bold cursor-pointer hover:text-blue-600 transition-colors" onClick={() => handleSort('type')}>
                          <div className="flex items-center gap-1">
                            {t('dash.colType')}
                            {sortConfig.key === 'type' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                          </div>
                        </th>
                        <th className="px-6 py-4 font-bold cursor-pointer hover:text-blue-600 transition-colors" onClick={() => handleSort('importance')}>
                          <div className="flex items-center gap-1">
                            {t('dash.colImportance')}
                            {sortConfig.key === 'importance' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                          </div>
                        </th>
                        <th className="px-6 py-4 font-bold cursor-pointer hover:text-blue-600 transition-colors" onClick={() => handleSort('status')}>
                          <div className="flex items-center gap-1">
                            {t('dash.colStatus')}
                            {sortConfig.key === 'status' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                          </div>
                        </th>
                        <th className="px-6 py-4 font-bold cursor-pointer hover:text-blue-600 transition-colors" onClick={() => handleSort('location')}>
                          <div className="flex items-center gap-1">
                            {t('dash.colLocation')}
                            {sortConfig.key === 'location' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                          </div>
                        </th>
                        <th className="px-6 py-4 font-bold cursor-pointer hover:text-blue-600 transition-colors" onClick={() => handleSort('reportedAt')}>
                          <div className="flex items-center gap-1">
                            {t('dash.colDate')}
                            {sortConfig.key === 'reportedAt' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                          </div>
                        </th>
                        <th className="px-6 py-4 font-semibold">{t('dash.colReporter')}</th>
                        <th className="px-6 py-4 font-bold text-right">{t('dash.colAction')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      <AnimatePresence>
                        {filteredAndSortedReports.map((report, index) => (
                          <motion.tr 
                            key={report.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.03 }}
                            className="hover:bg-gray-50 transition-colors group"
                          >
                            <td className="px-6 py-4 font-serif italic text-gray-900">{report.type}</td>
                            <td className="px-6 py-4">
                              <span className={`px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-wider ${getImportanceColor(report.importance || 'Medium')}`}>
                                {report.importance || 'Medium'}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                report.status === 'Open' ? 'bg-red-100 text-red-700' :
                                report.status === 'In Progress' ? 'bg-amber-100 text-amber-700' :
                                'bg-green-100 text-green-700'
                              }`}>
                                {report.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-gray-500 text-[10px] font-mono max-w-[200px] truncate">
                              {report.address || `${report.latitude.toFixed(4)}, ${report.longitude.toFixed(4)}`}
                            </td>
                            <td className="px-6 py-4 text-gray-500 text-xs font-mono">
                              {new Date(report.reportedAt).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-xs font-bold text-gray-900">{report.reporterName || t('users.anonymous')}</span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <button 
                                onClick={() => setSelectedReport(report)}
                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                            </td>
                          </motion.tr>
                        ))}
                      </AnimatePresence>
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          ) : activeTab === 'leaderboard' ? (
            <motion.div
              key="leaderboard"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <Leaderboard reports={reports} />
            </motion.div>
          ) : activeTab === 'notifications' ? (
            <motion.div
              key="notifications"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <NotificationsPanel
                notifications={notifications}
                onView={(report) => { setSelectedReport(report); setActiveTab('overview'); }}
                onMarkAllRead={() => setNotifications(prev => {
                  persistAllReadReportIds(prev.map(n => n.report.id ?? ''));
                  return prev.map(n => ({ ...n, read: true }));
                })}
                onMarkRead={(id) => setNotifications(prev => prev.map(n => {
                  if (n.id === id) { persistReadReportId(n.report.id ?? ''); return { ...n, read: true }; }
                  return n;
                }))}
                onCriticalAutoOpen={(report) => {
                  persistReadReportId(report.id ?? '');
                  setNotifications(prev => prev.map(n => n.report.id === report.id ? { ...n, read: true } : n));
                  setSelectedReport(report);
                }}
              />
            </motion.div>
          ) : (
            <motion.div
              key="users"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <UserManagement />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Mini Report Modal (Map Triggered) */}
      {miniReport && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[2000] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-gray-900 italic font-serif leading-tight">{miniReport.type}</h3>
                <div className="flex gap-2">
                  <span className={`px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-wider ${getImportanceColor(miniReport.importance || 'Medium')}`}>
                    {miniReport.importance || 'Medium'}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider ${
                    miniReport.status === 'Open' ? 'bg-red-100 text-red-700' :
                    miniReport.status === 'In Progress' ? 'bg-amber-100 text-amber-700' :
                    'bg-green-100 text-green-700'
                  }`}>
                    {miniReport.status}
                  </span>
                </div>
              </div>
              <button 
                onClick={() => setMiniReport(null)}
                className="p-1 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>

            <div className="space-y-1">
              <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest">{t('dash.descriptionSnippet')}</span>
              <p className="text-[11px] text-gray-600 leading-relaxed italic">
                {miniReport.description ? (miniReport.description.length > 100 ? miniReport.description.slice(0, 100) + '...' : miniReport.description) : t('dash.noDescriptionProvided')}
              </p>
            </div>

            <div className="space-y-2">
              <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest">{t('dash.quickUpdate')}</span>
              <div className="flex gap-1">
                {(['Open', 'In Progress', 'Resolved'] as Report['status'][]).map((status) => (
                  <button
                    key={status}
                    onClick={() => updateReportStatus(miniReport.id!, status)}
                    className={`flex-1 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest border transition-all ${
                      miniReport.status === status 
                        ? 'bg-blue-600 text-white border-blue-600' 
                        : 'bg-white text-gray-400 border-gray-100 hover:border-gray-200'
                    }`}
                  >
                    {status === 'Resolved' ? t('dash.solved') : status === 'In Progress' ? t('dash.inProgress') : t('dash.open')}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-2 flex gap-2">
              <button 
                onClick={() => {
                  setSelectedReport(miniReport);
                  setMiniReport(null);
                }}
                className="flex-1 py-2 bg-gray-900 text-white text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-black transition-all active:scale-95"
              >
                {t('dash.fullDetails')}
              </button>
              <button 
                onClick={() => setMiniReport(null)}
                className="px-4 py-2 text-[10px] font-black text-gray-400 uppercase tracking-widest hover:bg-gray-50 rounded-lg transition-colors"
              >
                {t('dash.close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stat Card Drawer */}
      <AnimatePresence>
        {statDrawer && (
          <div className="fixed inset-0 z-[500] flex justify-end" onClick={() => setStatDrawer(null)}>
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-md bg-white/80 backdrop-blur-xl shadow-2xl flex flex-col h-full overflow-hidden border-l border-white/30"
            >
              {/* Drawer Header */}
              <div className="p-6 border-b border-gray-100/60 flex items-center justify-between flex-shrink-0 bg-white/60 backdrop-blur-md">
                <div>
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{t('dash.breakdown')}</p>
                  <h3 className="text-lg font-black text-gray-900 mt-0.5 italic font-serif">{statDrawer.label}</h3>
                  <p className="text-[10px] font-mono text-gray-400 mt-0.5">
                    {statDrawer.reports.length} {statDrawer.reports.length !== 1 ? t('lb.reports') : t('lb.report')}
                  </p>
                </div>
                <button
                  onClick={() => setStatDrawer(null)}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Report List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                {statDrawer.reports.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-40 text-gray-400">
                    <p className="text-sm font-bold">{t('dash.noReports')}</p>
                  </div>
                ) : (
                  statDrawer.reports
                    .slice()
                    .sort((a, b) => new Date(b.reportedAt).getTime() - new Date(a.reportedAt).getTime())
                    .map((report) => (
                      <motion.div
                        key={report.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        whileHover={{ scale: 1.01 }}
                        onClick={() => { setStatDrawer(null); setSelectedReport(report); }}
                        className="bg-white/70 backdrop-blur-md rounded-xl p-4 border border-white/30 flex items-start gap-4 cursor-pointer hover:shadow-md transition-all group"
                      >
                        <div className="flex-1 min-w-0 space-y-1.5">
                          <p className="text-sm font-bold text-gray-900 italic font-serif truncate group-hover:text-blue-700 transition-colors">{report.type}</p>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-wider ${getImportanceColor(report.importance || 'Medium')}`}>
                              {report.importance || 'Medium'}
                            </span>
                            <span className={`px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-wider ${
                              report.status === 'Resolved' ? 'bg-green-100 text-green-700 border border-green-200' :
                              report.status === 'In Progress' ? 'bg-blue-100 text-blue-700 border border-blue-200' :
                              'bg-amber-100 text-amber-700 border border-amber-200'
                            }`}>
                              {report.status}
                            </span>
                          </div>
                          {report.address && (
                            <p className="text-[9px] font-mono text-gray-400 truncate">{report.address}</p>
                          )}
                          <p className="text-[9px] font-mono text-gray-400">
                            {new Date(report.reportedAt).toLocaleString()}
                          </p>
                        </div>
                        <div className="flex-shrink-0 text-gray-300 group-hover:text-blue-400 transition-colors">
                          <ChevronRight className="w-4 h-4" />
                        </div>
                      </motion.div>
                    ))
                )}
              </div>
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      {/* Report Details Modal */}
      {selectedReport && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1000] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 max-h-[95vh] flex flex-col">
            <div className="relative aspect-video bg-gray-900 grid grid-cols-2 flex-shrink-0">
              <div className="relative h-full border-r border-white/10">
                {selectedReport.photoUrl ? (
                  <img src={selectedReport.photoUrl} alt="Fault" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-500">
                    <AlertTriangle className="w-12 h-12" />
                  </div>
                )}
              </div>
              <div className="relative h-full">
                {modalMapReady && (
                  <Viewer 
                    timeline={false}
                    animation={false}
                    baseLayerPicker={false}
                    geocoder={false}
                    homeButton={false}
                    infoBox={false}
                    selectionIndicator={false}
                    navigationHelpButton={false}
                    sceneModePicker={false}
                    style={{ height: '100%', width: '100%' }}
                  >
                    <Entity 
                      position={Cartesian3.fromDegrees(selectedReport.longitude, selectedReport.latitude)}
                    >
                      <PointGraphics pixelSize={15} color={Color.RED} outlineColor={Color.WHITE} outlineWidth={2} />
                    </Entity>
                  </Viewer>
                )}
              </div>
              <button 
                onClick={() => setSelectedReport(null)}
                className="absolute top-4 right-4 p-2 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors z-[1001]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-8 space-y-6 overflow-y-auto flex-1 custom-scrollbar">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <h3 className="text-2xl font-bold text-gray-900 tracking-tight italic font-serif">{selectedReport.type}</h3>
                    <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${getImportanceColor(selectedReport.importance || 'Medium')}`}>
                      {selectedReport.importance || 'Medium'}
                    </span>
                  </div>
                  <p className="text-xs font-mono text-gray-500 uppercase tracking-widest mt-1">
                    REPORT_ID: {selectedReport.id?.slice(-8).toUpperCase()} • {new Date(selectedReport.reportedAt).toLocaleString()}
                  </p>
                </div>
                <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                  selectedReport.status === 'Open' ? 'bg-red-100 text-red-700' :
                  selectedReport.status === 'In Progress' ? 'bg-amber-100 text-amber-700' :
                  'bg-green-100 text-green-700'
                }`}>
                  {selectedReport.status}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                <div className="space-y-2">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{t('dash.locationData')}</span>
                  <div className="flex items-start gap-2 text-xs font-mono text-gray-700 leading-tight">
                    <MapPin className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                    <div className="flex flex-col">
                      <span className="font-bold">{selectedReport.address || t('dash.addressNotAvailable')}</span>
                      <span className="text-[10px] text-gray-400">{selectedReport.latitude.toFixed(6)}, {selectedReport.longitude.toFixed(6)}</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{t('dash.reporterInfo')}</span>
                  <div className="flex items-center gap-2 text-sm font-bold text-gray-900">
                    <UsersIcon className="w-4 h-4 text-blue-500" />
                    <span>{selectedReport.reporterName || t('users.anonymous')}</span>
                  </div>
                  <p className="text-[10px] font-mono text-gray-400 truncate">UID: {selectedReport.reporterUid}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                <div className="space-y-2">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{t('dash.routedTo')}</span>
                  <div className="flex items-center gap-2 text-sm font-bold text-gray-900">
                    <ShieldAlert className="w-4 h-4 text-amber-500" />
                    <span>{selectedReport.routedTo || t('dash.pendingAssignment')}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{t('dash.estimatedSolution')}</span>
                  <div className="flex items-center gap-2 text-sm font-bold text-blue-600">
                    <Clock className="w-4 h-4" />
                    <span>{selectedReport.estimatedSolution || 'TBD'}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{t('dash.fieldDescription')}</span>
                <p className="text-gray-700 text-sm leading-relaxed bg-gray-50 p-4 rounded-xl border border-gray-100 italic">
                  {selectedReport.description || t('dash.noDescriptionProvided')}
                </p>
              </div>

              <div className="pt-4 border-t border-gray-100 flex justify-end gap-3 flex-shrink-0">
                <button 
                  onClick={() => setSelectedReport(null)}
                  className="px-6 py-2 text-sm font-bold text-gray-500 hover:bg-gray-50 rounded-xl transition-colors"
                >
                  {t('dash.close')}
                </button>
                {/* Raspberry Pi camera trigger — only shown to admins */}
                {isAdmin && (
                  <button
                    onClick={() => triggerCamera(selectedReport.id!)}
                    disabled={triggeringCamera}
                    className="px-6 py-2 bg-gray-900 text-white text-sm font-bold rounded-xl shadow-lg hover:bg-gray-700 transition-all active:scale-95 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {triggeringCamera
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <Camera className="w-4 h-4" />}
                    {triggeringCamera ? 'Sending...' : 'Trigger Pi Camera'}
                  </button>
                )}
                <div className="relative group/status">
                  <button 
                    disabled={updatingStatus}
                    className="px-6 py-2 bg-blue-600 text-white text-sm font-bold rounded-xl shadow-lg hover:bg-blue-700 transition-all active:scale-95 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {updatingStatus ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    {updatingStatus ? t('dash.updating') : t('dash.updateStatus')}
                  </button>
                  {!updatingStatus && (
                    <div className="absolute bottom-full right-0 mb-2 w-48 bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden hidden group-hover/status:block animate-in fade-in slide-in-from-bottom-2 duration-200">
                      {(['Open', 'In Progress', 'Resolved'] as Report['status'][]).map((status) => (
                        <button
                          key={status}
                          onClick={() => updateReportStatus(selectedReport.id!, status)}
                          className={`w-full px-4 py-3 text-left text-xs font-bold hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0 ${selectedReport.status === status ? 'text-blue-600 bg-blue-50' : 'text-gray-700'}`}
                        >
                          {status === 'Resolved' ? t('dash.solved') : status === 'In Progress' ? t('dash.inProgress') : t('dash.open')}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, onClick }: { icon: React.ReactNode, label: string, value: string | number, onClick?: () => void }) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -5, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`p-6 bg-white/60 backdrop-blur-md rounded-2xl shadow-sm border border-white/30 flex items-center space-x-4 hover:shadow-md transition-all ${onClick ? 'cursor-pointer hover:border-blue-200/60 hover:bg-white/75' : ''}`}
    >
      <div className="p-3 bg-[#F8F9FA] rounded-xl shadow-inner">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{label}</p>
        <p className="text-2xl font-bold text-gray-900 tracking-tight truncate">{value}</p>
      </div>
      {onClick && <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />}
    </motion.div>
  );
}
