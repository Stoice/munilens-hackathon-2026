import React, { useState, useEffect, useRef, useMemo } from 'react';
import { db, auth } from '../firebase';
import { collection, query, orderBy, onSnapshot, limit, doc, getDoc, updateDoc } from 'firebase/firestore';
import { generateWeeklyReport } from '../services/gemini';
import { filterValidReports, calculateBounds } from '../utils/coordinateValidator';
import { aggregateIncidentsByLocation, LocationPing, getLocationColor } from '../utils/incidentAggregation';
import LocationPingPopup from './LocationPingPopup';
import { exportHTMLElementToPDF, generateReportFilename } from '../utils/pdfGenerator';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Report, UserProfile } from '../types';
import { FileText, Map as MapIcon, AlertTriangle, CheckCircle, Clock, Loader2, Download, Users as UsersIcon, LayoutDashboard, Settings, X, Eye, MapPin, Navigation, Bell, ShieldAlert } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { toast } from 'sonner';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';
import UserManagement from './UserManagement';
import { MapContainer, TileLayer, Marker, Popup, Tooltip as LeafletTooltip } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Search, Filter, ChevronUp, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Fix Leaflet default icon issue using CDN URLs
let DefaultIcon = L.icon({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

const COLORS = ['#3b82f6', '#ef4444', '#f59e0b', '#10b981', '#8b5cf6', '#6b7280'];

const getImportanceColor = (importance: string) => {
  switch (importance) {
    case 'Critical': return 'bg-red-100 text-red-700 border border-red-200';
    case 'High': return 'bg-orange-100 text-orange-700 border border-orange-200';
    case 'Medium': return 'bg-primary-blue/10 text-primary-blue border border-primary-blue';
    case 'Low': return 'bg-neutral-grey/10 text-neutral-grey border border-neutral-grey';
    default: return 'bg-primary-blue/10 text-primary-blue border border-primary-blue';
  }
};

export default function Dashboard() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [generatingAi, setGeneratingAi] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'map'>('overview');
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [miniReport, setMiniReport] = useState<Report | null>(null);
  const [selectedLocationPing, setSelectedLocationPing] = useState<LocationPing | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: keyof Report | 'location'; direction: 'asc' | 'desc' }>({ key: 'reportedAt', direction: 'desc' });
  const [filterConfig, setFilterConfig] = useState({ status: 'All', importance: 'All', type: 'All' });
  const aiReportRef = useRef<HTMLDivElement>(null);
  const isInitialLoad = useRef(true);
  const prevReportIds = useRef<Set<string>>(new Set());

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
    const path = 'reports';
    const q = query(collection(db, path), orderBy('reportedAt', 'desc'), limit(500));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const rawData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Report));
      
      // Filter out reports with invalid coordinates
      const { validReports: data, stats: coordStats } = filterValidReports(rawData);
      
      // Log coordinate validation results for debugging
      if (coordStats.invalid > 0) {
        console.warn(`Coordinate validation: ${coordStats.valid}/${coordStats.total} reports have valid coordinates. ${coordStats.invalid} reports skipped.`);
      }
      
      // Notification logic for new critical reports
      if (!isInitialLoad.current && userProfile?.role === 'admin') {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const newReport = { id: change.doc.id, ...change.doc.data() } as Report;
            if (newReport.importance === 'Critical') {
              toast.error(`CRITICAL ALERT: New ${newReport.type} reported!`, {
                description: newReport.description?.slice(0, 60) + '...',
                duration: 10000,
                icon: <Bell className="w-4 h-4" />,
                action: {
                  label: 'View',
                  onClick: () => setSelectedReport(newReport)
                }
              });
            }
          }
        });
      }

      setReports(data);
      setLoading(false);
      isInitialLoad.current = false;
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });
    return () => unsubscribe();
  }, [userProfile]);

  // Aggregate incidents by location (groups multiple incidents at same coordinates)
  const locationPings = useMemo(() => {
    const validReports = reports.filter(r =>
      typeof r.latitude === 'number' &&
      typeof r.longitude === 'number' &&
      !isNaN(r.latitude) &&
      !isNaN(r.longitude) &&
      isFinite(r.latitude) &&
      isFinite(r.longitude) &&
      r.latitude >= -90 &&
      r.latitude <= 90 &&
      r.longitude >= -180 &&
      r.longitude <= 180
    );
    return aggregateIncidentsByLocation(validReports);
  }, [reports]);

  const getStats = () => {
    const total = reports.length;
    const typeCounts: Record<string, number> = {};
    const statusCounts: Record<string, number> = { 'Open': 0, 'In Progress': 0, 'Resolved': 0 };
    const importanceCounts: Record<string, number> = { 'Critical': 0, 'High': 0, 'Medium': 0, 'Low': 0 };
    
    // Use only valid coordinates for center calculation
    const bounds = calculateBounds(reports.map(r => ({ latitude: r.latitude, longitude: r.longitude })));

    reports.forEach(r => {
      typeCounts[r.type] = (typeCounts[r.type] || 0) + 1;
      statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;
      if (r.importance) {
        importanceCounts[r.importance] = (importanceCounts[r.importance] || 0) + 1;
      }
    });

    const topFault = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'None';

    return {
      total,
      topFault,
      avgLat: bounds.centerLat,
      avgLng: bounds.centerLng,
      validMapReports: bounds.validCount,
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
      const result = await generateWeeklyReport(stats);
      setAiReport(result);
    } catch (err) {
      console.error("AI Report failed", err);
    } finally {
      setGeneratingAi(false);
    }
  };

  const exportToPdf = async () => {
    if (!aiReportRef.current) return;
    
    try {
      const filename = generateReportFilename('MuniLens_Weekly_Insight_Report');
      await exportHTMLElementToPDF(aiReportRef.current, filename, {
        title: 'MuniLens - AI Weekly Insight Briefing',
        appIconUrl: '/App icon.jpeg'
      });
      
      toast.success('PDF exported successfully!', {
        description: filename,
        duration: 4000
      });
    } catch (err) {
      console.error('PDF export failed:', err);
      toast.error('Failed to export PDF', {
        description: 'Please try again',
        duration: 3000
      });
    }
  };

  const updateReportStatus = async (reportId: string, newStatus: Report['status']) => {
    const path = `reports/${reportId}`;
    try {
      await updateDoc(doc(db, 'reports', reportId), {
        status: newStatus
      });
      setSelectedReport(prev => prev ? { ...prev, status: newStatus } : null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen" style={{backgroundColor: '#f0f0f0'}}>
        <Loader2 className="w-12 h-12 animate-spin" style={{color: '#1a6fa8'}} />
      </div>
    );
  }

  const stats = getStats();
  const isAdmin = userProfile?.role === 'admin';

  return (
    <div className="min-h-screen flex" style={{backgroundColor: '#f0f0f0'}}>
      {/* Sidebar */}
      <aside className="w-64 bg-white flex flex-col hidden md:flex" style={{borderRightColor: '#d9c9a8', borderRightWidth: '1px'}}>
        <div className="p-6" style={{borderBottomColor: '#e8e8e8', borderBottomWidth: '1px'}}>
          <h1 className="text-xl font-black tracking-tighter uppercase italic" style={{color: '#1a6fa8'}}>MuniLens</h1>
          <p className="text-[10px] font-bold uppercase tracking-widest mt-1" style={{color: '#9e9e9e'}}>Municipal Control</p>
        </div>
        
        <nav className="flex-1 p-4 space-y-1">
          <button 
            onClick={() => setActiveTab('overview')}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all"
            style={activeTab === 'overview' ? {backgroundColor: '#d4e8f7', color: '#1a6fa8'} : {color: '#9e9e9e'}}
          >
            <LayoutDashboard className="w-5 h-5" />
            Overview
          </button>
          <button 
            onClick={() => setActiveTab('map')}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all"
            style={activeTab === 'map' ? {backgroundColor: '#d4e8f7', color: '#1a6fa8'} : {color: '#9e9e9e'}}
          >
            <MapIcon className="w-5 h-5" />
            Map View
          </button>
          {isAdmin && (
            <button 
              onClick={() => setActiveTab('users')}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all"
              style={activeTab === 'users' ? {backgroundColor: '#d4e8f7', color: '#1a6fa8'} : {color: '#9e9e9e'}}
            >
              <UsersIcon className="w-5 h-5" />
              User Management
            </button>
          )}
        </nav>

        <div className="p-4" style={{borderTopColor: '#e8e8e8', borderTopWidth: '1px'}}>
          <div className="rounded-xl p-4 flex items-center gap-3" style={{backgroundColor: '#f0f0f0'}}>
            <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs" style={{backgroundColor: '#d4e8f7', color: '#1a6fa8'}}>
              {userProfile?.displayName?.[0] || 'U'}
            </div>
            <div className="flex flex-col overflow-hidden">
              <span className="text-xs font-bold truncate" style={{color: '#1a2e5a'}}>{userProfile?.displayName || 'Admin User'}</span>
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
                  <h2 className="text-3xl font-bold text-gray-900 tracking-tight italic font-serif">Dashboard Overview</h2>
                  <p className="text-sm text-gray-500 font-mono">SYSTEM_STATUS: OPERATIONAL • {reports.length} ACTIVE_REPORTS</p>
                </div>
                {isAdmin && (
                  <button 
                    onClick={handleGenerateAiReport}
                    disabled={generatingAi}
                    className="flex items-center space-x-2 px-6 py-3 text-white rounded-xl font-bold shadow-lg transition-all disabled:opacity-50 active:scale-95" style={{backgroundColor: '#1a6fa8'}} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1a2e5a'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#1a6fa8'}
                  >
                    {generatingAi ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileText className="w-5 h-5" />}
                    <span>Generate AI Insight Report</span>
                  </button>
                )}
              </header>

              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard icon={<AlertTriangle className="text-red-500" />} label="Total Reports" value={stats.total} />
                <StatCard icon={<Clock className="text-amber-500" />} label="Active Issues" value={stats.statusBreakdown['Open'] + stats.statusBreakdown['In Progress']} />
                <StatCard icon={<CheckCircle style={{color: '#4caf50'}} />} label="Resolved" value={stats.statusBreakdown['Resolved']} />
                <StatCard icon={<MapIcon style={{color: '#1a6fa8'}} />} label="Top Category" value={stats.topFault} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {/* Charts */}
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.1 }}
                  className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-6 flex flex-col h-[400px] hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center justify-between flex-shrink-0">
                    <h3 className="text-xs font-black uppercase tracking-widest" style={{color: '#9e9e9e'}}>Fault Distribution</h3>
                    <div className="w-2 h-2 rounded-full animate-pulse" style={{backgroundColor: '#1a6fa8'}} />
                  </div>
                  <div className="flex-1 min-h-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats.typeData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e8e8e8" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#9e9e9e'}} />
                        <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#9e9e9e'}} />
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
                  className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-6 flex flex-col h-[400px] hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center justify-between flex-shrink-0">
                    <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">Status Breakdown</h3>
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  </div>
                  <div className="flex-1 min-h-0">
                    <ResponsiveContainer width="100%" height="100%">
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
                  className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-6 flex flex-col h-[400px] hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center justify-between flex-shrink-0">
                    <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">Importance Levels</h3>
                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  </div>
                  <div className="flex-1 min-h-0">
                    <ResponsiveContainer width="100%" height="100%">
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

              {/* AI Report Modal/Section */}
              {aiReport && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  ref={aiReportRef}
                  className="rounded-2xl shadow-xl print:p-0 print:shadow-none print:border-0 print:rounded-none relative"
                  style={{backgroundColor: '#4caf50', borderColor: '#2e7d32', borderWidth: '2px'}}
                >
                  {/* App Icon Branding - Top Right Corner */}
                  <div className="absolute top-6 right-6 flex items-center gap-2 z-10 print:hidden">
                    <img 
                      src="/App icon.jpeg" 
                      alt="MuniLens" 
                      className="w-10 h-10 object-contain"
                    />
                    <div className="text-white">
                      <p className="text-sm font-black tracking-tight uppercase">MuniLens</p>
                      <p className="text-[10px] font-bold opacity-90">Intelligence</p>
                    </div>
                  </div>

                  {/* Full Cover Page with App Icon */}
                  <div className="w-full h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100 page-break-after print:h-screen print:bg-gradient-to-br print:from-blue-50 print:to-blue-100 print:m-0 print:p-0">
                    <div className="flex flex-col items-center justify-center space-y-8">
                      <img 
                        src="/App icon.jpeg" 
                        alt="MuniLens App Icon" 
                        className="w-80 h-80 object-contain drop-shadow-2xl"
                      />
                      <div className="text-center space-y-3">
                        <h1 className="text-6xl font-black uppercase tracking-tight" style={{color: '#1a2e5a'}}>MuniLens</h1>
                        <p className="text-xl font-bold uppercase tracking-widest" style={{color: '#1a6fa8'}}>Municipal Services Intelligence</p>
                        <p className="text-lg font-semibold mt-4" style={{color: '#4caf50'}}>AI Weekly Insight Briefing</p>
                      </div>
                    </div>
                  </div>

                  {/* Page Break */}
                  <div className="page-break print:page-break-before"></div>

                  {/* Report Header */}
                  <div className="p-12 pb-8 print:p-8 print:pb-12 print:bg-white" style={{backgroundColor: '#ffffff', borderBottomColor: '#e8e8e8', borderBottomWidth: '1px'}}>
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 rounded-lg flex items-center justify-center" style={{backgroundColor: '#1a6fa8'}}>
                          <FileText className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <h1 className="text-3xl font-black uppercase tracking-tight" style={{color: '#1a2e5a'}}>MuniLens</h1>
                          <p className="text-xs font-bold uppercase tracking-widest mt-1" style={{color: '#9e9e9e'}}>Municipal Services Intelligence</p>
                        </div>
                      </div>
                    </div>
                    
                    <h2 className="text-2xl font-bold mb-4" style={{color: '#1a6fa8'}}>AI Weekly Insight Briefing</h2>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold uppercase tracking-widest" style={{color: '#9e9e9e'}}>Generated</p>
                        <p className="text-sm font-semibold" style={{color: '#1a2e5a'}}>{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold uppercase tracking-widest" style={{color: '#9e9e9e'}}>Report Period</p>
                        <p className="text-sm font-semibold" style={{color: '#1a2e5a'}}>Last 7 Days</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold uppercase tracking-widest" style={{color: '#9e9e9e'}}>Status</p>
                        <p className="text-sm font-semibold" style={{color: '#4caf50'}}>Active</p>
                      </div>
                    </div>
                  </div>

                  {/* Report Content */}
                  <div className="p-12 prose prose-blue max-w-none prose-headings:font-black prose-p:leading-relaxed print:p-8 print:bg-white" style={{backgroundColor: '#ffffff'}}>
                    <ReactMarkdown
                      components={{
                        h1: ({node, ...props}) => <h1 className="text-2xl font-black mt-8 mb-4 uppercase tracking-tight pb-3" style={{color: '#1a2e5a', borderBottomColor: '#1a6fa8', borderBottomWidth: '2px'}} {...props} />,
                        h2: ({node, ...props}) => <h2 className="text-xl font-bold mt-6 mb-3 uppercase tracking-wide" style={{color: '#1a6fa8'}} {...props} />,
                        h3: ({node, ...props}) => <h3 className="text-lg font-bold mt-4 mb-2" style={{color: '#00b4a6'}} {...props} />,
                        p: ({node, ...props}) => <p className="leading-relaxed mb-4" style={{color: '#2c2c2c'}} {...props} />,
                        ul: ({node, ...props}) => <ul className="space-y-2 my-4 list-disc list-inside" {...props} />,
                        ol: ({node, ...props}) => <ol className="space-y-2 my-4 list-decimal list-inside" {...props} />,
                        li: ({node, ...props}) => <li className="ml-2" style={{color: '#2c2c2c'}} {...props} />,
                        blockquote: ({node, ...props}) => <blockquote className="pl-4 py-2 italic my-4" style={{borderLeftColor: '#1a6fa8', borderLeftWidth: '4px', color: '#666'}} {...props} />,
                        table: ({node, ...props}) => <table className="w-full border-collapse my-4" style={{border: '1px solid #d9c9a8'}} {...props} />,
                        tr: ({node, ...props}) => <tr style={{borderColor: '#d9c9a8', borderWidth: '1px'}} {...props} />,
                        th: ({node, ...props}) => <th className="px-4 py-2 text-left font-bold" style={{backgroundColor: '#d4e8f7', borderColor: '#d9c9a8', borderWidth: '1px'}} {...props} />,
                        td: ({node, ...props}) => <td className="px-4 py-2" style={{borderColor: '#d9c9a8', borderWidth: '1px'}} {...props} />
                      }}
                    >
                      {aiReport}
                    </ReactMarkdown>
                  </div>

                  {/* Report Footer */}
                  <div className="pt-8 print:pt-12 mt-8 p-12 print:p-8 print:bg-white" style={{backgroundColor: '#ffffff', borderTopColor: '#e8e8e8', borderTopWidth: '1px'}}>
                    <div className="grid grid-cols-2 gap-8 text-xs">
                      <div>
                        <p className="font-bold mb-2" style={{color: '#1a2e5a'}}>Document Information</p>
                        <p style={{color: '#9e9e9e'}}>Report Type: Weekly Insight</p>
                        <p style={{color: '#9e9e9e'}}>Format: PDF</p>
                        <p style={{color: '#9e9e9e'}}>Version: 1.0</p>
                      </div>
                      <div>
                        <p className="font-bold mb-2" style={{color: '#1a2e5a'}}>Contact Information</p>
                        <p style={{color: '#9e9e9e'}}>© 2026 MuniLens</p>
                        <p style={{color: '#9e9e9e'}}>Municipal Infrastructure Intelligence</p>
                        <p style={{color: '#9e9e9e'}}>support@munilens.gov</p>
                      </div>
                    </div>
                    
                    <p className="text-[10px] text-center mt-6 pt-6" style={{color: '#9e9e9e', borderTopColor: '#e8e8e8', borderTopWidth: '1px'}}>
                      This document contains confidential information generated by MuniLens AI Analysis System. 
                      Generated on {new Date().toLocaleString('en-US')}
                    </p>
                  </div>
                </motion.div>
              )}

              {/* Export Button - Outside the ref for better UX */}
              {aiReport && !aiReportRef.current?.classList.contains('print:hidden') && (
                <div className="mt-4 flex gap-2">
                  <button 
                    onClick={exportToPdf}
                    className="flex items-center space-x-2 px-6 py-3 text-white font-bold rounded-xl transition-all shadow-lg hover:shadow-xl active:scale-95"
                    style={{backgroundColor: '#1a6fa8'}} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1a2e5a'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#1a6fa8'}
                  >
                    <Download className="w-4 h-4" />
                    <span>Export as PDF</span>
                  </button>
                  <button 
                    onClick={() => setAiReport(null)}
                    className="flex items-center space-x-2 px-6 py-3 font-bold rounded-xl transition-all"
                    style={{backgroundColor: '#9e9e9e', color: '#fff'}} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#7e7e7e'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#9e9e9e'}
                  >
                    <X className="w-4 h-4" />
                    <span>Close</span>
                  </button>
                </div>
              )}

              {/* Recent Reports Table */}
              <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{borderColor: '#d9c9a8', borderWidth: '1px'}}>
                <div className="p-6 space-y-4" style={{borderBottomColor: '#e8e8e8', borderBottomWidth: '1px'}}>
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-black uppercase tracking-widest" style={{color: '#9e9e9e'}}>Recent Reports</h3>
                    <span className="text-[10px] px-2 py-1 rounded font-bold tracking-tighter" style={{backgroundColor: '#e8e8e8', color: '#9e9e9e'}}>LIVE_FEED</span>
                  </div>
                  
                  {/* Filters */}
                  <div className="flex flex-wrap gap-4 pt-2">
                    <div className="flex flex-col gap-1">
                      <label className="text-[8px] font-black uppercase tracking-widest ml-1" style={{color: '#9e9e9e'}}>Status</label>
                      <select 
                        value={filterConfig.status}
                        onChange={(e) => setFilterConfig(prev => ({ ...prev, status: e.target.value }))}
                        className="px-3 py-1.5 border rounded-lg text-[10px] font-bold outline-none transition-all"
                        style={{backgroundColor: '#f0f0f0', borderColor: '#e8e8e8', color: '#1a2e5a'}} onFocus={(e) => e.target.style.boxShadow = '0 0 0 2px #1a6fa8'} onBlur={(e) => e.target.style.boxShadow = 'none'}
                      >
                        <option value="All">All Statuses</option>
                        <option value="Open">Open</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Resolved">Resolved</option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[8px] font-black uppercase tracking-widest ml-1" style={{color: '#9e9e9e'}}>Importance</label>
                      <select 
                        value={filterConfig.importance}
                        onChange={(e) => setFilterConfig(prev => ({ ...prev, importance: e.target.value }))}
                        className="px-3 py-1.5 border rounded-lg text-[10px] font-bold outline-none transition-all"
                        style={{backgroundColor: '#f0f0f0', borderColor: '#e8e8e8', color: '#1a2e5a'}} onFocus={(e) => e.target.style.boxShadow = '0 0 0 2px #1a6fa8'} onBlur={(e) => e.target.style.boxShadow = 'none'}
                      >
                        <option value="All">All Importance</option>
                        <option value="Critical">Critical</option>
                        <option value="High">High</option>
                        <option value="Medium">Medium</option>
                        <option value="Low">Low</option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[8px] font-black uppercase tracking-widest ml-1" style={{color: '#9e9e9e'}}>Type</label>
                      <select 
                        value={filterConfig.type}
                        onChange={(e) => setFilterConfig(prev => ({ ...prev, type: e.target.value }))}
                        className="px-3 py-1.5 border rounded-lg text-[10px] font-bold outline-none transition-all"
                        style={{backgroundColor: '#f0f0f0', borderColor: '#e8e8e8', color: '#1a2e5a'}} onFocus={(e) => e.target.style.boxShadow = '0 0 0 2px #1a6fa8'} onBlur={(e) => e.target.style.boxShadow = 'none'}
                      >
                        <option value="All">All Types</option>
                        {Array.from(new Set(reports.map(r => r.type))).map(type => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="text-[10px] uppercase tracking-widest" style={{backgroundColor: '#f0f0f0', color: '#9e9e9e'}}>
                      <tr>
                        <th className="px-6 py-4 font-bold cursor-pointer transition-colors" onClick={() => handleSort('type')} style={{color: '#9e9e9e'}} onMouseEnter={(e) => e.currentTarget.style.color = '#1a6fa8'} onMouseLeave={(e) => e.currentTarget.style.color = '#9e9e9e'}>
                          <div className="flex items-center gap-1">
                            Type
                            {sortConfig.key === 'type' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                          </div>
                        </th>
                        <th className="px-6 py-4 font-bold cursor-pointer transition-colors" onClick={() => handleSort('importance')} style={{color: '#9e9e9e'}} onMouseEnter={(e) => e.currentTarget.style.color = '#1a6fa8'} onMouseLeave={(e) => e.currentTarget.style.color = '#9e9e9e'}>
                          <div className="flex items-center gap-1">
                            Importance
                            {sortConfig.key === 'importance' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                          </div>
                        </th>
                        <th className="px-6 py-4 font-bold cursor-pointer transition-colors" onClick={() => handleSort('status')} style={{color: '#9e9e9e'}} onMouseEnter={(e) => e.currentTarget.style.color = '#1a6fa8'} onMouseLeave={(e) => e.currentTarget.style.color = '#9e9e9e'}>
                          <div className="flex items-center gap-1">
                            Status
                            {sortConfig.key === 'status' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                          </div>
                        </th>
                        <th className="px-6 py-4 font-bold cursor-pointer transition-colors" onClick={() => handleSort('location')} style={{color: '#9e9e9e'}} onMouseEnter={(e) => e.currentTarget.style.color = '#1a6fa8'} onMouseLeave={(e) => e.currentTarget.style.color = '#9e9e9e'}>
                          <div className="flex items-center gap-1">
                            Location
                            {sortConfig.key === 'location' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                          </div>
                        </th>
                        <th className="px-6 py-4 font-bold cursor-pointer transition-colors" onClick={() => handleSort('reportedAt')} style={{color: '#9e9e9e'}} onMouseEnter={(e) => e.currentTarget.style.color = '#1a6fa8'} onMouseLeave={(e) => e.currentTarget.style.color = '#9e9e9e'}>
                          <div className="flex items-center gap-1">
                            Date
                            {sortConfig.key === 'reportedAt' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                          </div>
                        </th>
                        <th className="px-6 py-4 font-semibold">Reporter</th>
                        <th className="px-6 py-4 font-bold text-right">Action</th>
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
                              <span className="text-xs font-bold text-gray-900">{report.reporterName || 'Anonymous'}</span>
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
          ) : activeTab === 'map' ? (
            <motion.div 
              key="map"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.3 }}
              className="h-[calc(100vh-160px)] bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden relative"
            >
              <div className="absolute top-6 left-6 z-[400] bg-white/90 backdrop-blur px-4 py-3 rounded-xl shadow-lg border border-gray-100 space-y-1.5">
                <h3 className="text-xs font-black text-gray-900 uppercase tracking-widest flex items-center gap-2">
                  <Navigation className="w-4 h-4 text-blue-600" />
                  Live Fault Map
                </h3>
                <div className="text-[10px] text-gray-600 space-y-0.5">
                  <p><span className="font-bold text-blue-600">{locationPings.length}</span> location ping{locationPings.length !== 1 ? 's' : ''}</p>
                  <p className="text-gray-500">{stats.validMapReports} incidents • {stats.total} total</p>
                </div>
              </div>
              <MapContainer 
                center={[stats.avgLat || -26.2041, stats.avgLng || 28.0473]} 
                zoom={12} 
                style={{ height: '100%', width: '100%' }}
              >
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                />
                {locationPings.map((ping) => {
                  const pingColor = getLocationColor(ping);
                  const customIcon = L.divIcon({
                    className: 'relative',
                    html: `
                      <div class="flex items-center justify-center">
                        <div class="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold shadow-lg" style="background-color: ${pingColor}; border: 2px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3);">
                          <span class="text-xs">${ping.count > 1 ? ping.count : '●'}</span>
                        </div>
                        ${ping.count > 1 ? `<div class="absolute -top-2 -right-2 bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold shadow-lg border border-white">${ping.count}</div>` : ''}
                      </div>
                    `,
                    iconSize: [40, 40],
                    iconAnchor: [20, 20]
                  });

                  return (
                    <Marker
                      key={`${ping.latitude}-${ping.longitude}`}
                      position={[ping.latitude, ping.longitude] as [number, number]}
                      icon={customIcon}
                      eventHandlers={{
                        click: () => {
                          if (ping.count === 1) {
                            setSelectedReport(ping.reports[0]);
                          } else {
                            setSelectedLocationPing(ping);
                          }
                        }
                      }}
                    >
                      <LeafletTooltip direction="top" offset={[0, -32]} opacity={1} permanent={false}>
                        <div className="p-2 space-y-1 min-w-[140px] bg-white rounded-lg shadow-sm border border-gray-100">
                          <h4 className="text-[10px] font-serif italic font-bold text-gray-900 leading-tight">
                            {ping.count > 1 ? `${ping.count} Incidents` : ping.reports[0].type}
                          </h4>
                          {ping.count > 1 && (
                            <p className="text-[9px] text-gray-600">
                              {Object.entries(ping.types)
                                .sort((a, b) => b[1] - a[1])
                                .slice(0, 2)
                                .map(([type, count]) => `${count}× ${type}`)
                                .join(', ')}
                            </p>
                          )}
                          <div className="flex gap-1">
                            <span className={`px-1.5 py-0.5 rounded-full text-[7px] font-black uppercase tracking-wider ${
                              ping.mostRecent.status === 'Open' ? 'bg-red-100 text-red-700' :
                              ping.mostRecent.status === 'In Progress' ? 'bg-amber-100 text-amber-700' :
                              'bg-green-100 text-green-700'
                            }`}>
                              {ping.mostRecent.status}
                            </span>
                            <span className={`px-1.5 py-0.5 rounded-lg text-[7px] font-black uppercase tracking-wider ${getImportanceColor(ping.mostCritical.importance || 'Medium')}`}>
                              {ping.count > 1 ? 'Multi' : (ping.mostCritical.importance || 'Medium')}
                            </span>
                          </div>
                        </div>
                      </LeafletTooltip>

                      {ping.count === 1 ? (
                        <Popup className="custom-popup">
                          <div className="p-2 space-y-2 min-w-[180px]">
                            <h4 className="font-serif italic font-bold text-gray-900">{ping.reports[0].type}</h4>
                            <p className="text-[10px] text-gray-500 line-clamp-2">{ping.reports[0].description || 'No description provided.'}</p>
                            <button 
                              onClick={() => setSelectedReport(ping.reports[0])}
                              className="w-full mt-2 py-1.5 bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-blue-700 transition-colors"
                            >
                              View Full Details
                            </button>
                          </div>
                        </Popup>
                      ) : (
                        <Popup className="custom-popup !p-0">
                          <LocationPingPopup
                            ping={ping}
                            onSelectReport={setSelectedReport}
                            onClose={() => {
                              // Popup will close automatically
                            }}
                          />
                        </Popup>
                      )}
                    </Marker>
                  );
                })}
              </MapContainer>
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
              <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Description Snippet</span>
              <p className="text-[11px] text-gray-600 leading-relaxed italic">
                {miniReport.description ? (miniReport.description.length > 100 ? miniReport.description.slice(0, 100) + '...' : miniReport.description) : "No description provided."}
              </p>
            </div>

            <div className="pt-2 flex gap-2">
              <button 
                onClick={() => {
                  setSelectedReport(miniReport);
                  setMiniReport(null);
                }}
                className="flex-1 py-2 bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-blue-700 transition-all active:scale-95"
              >
                Full Details
              </button>
              <button 
                onClick={() => setMiniReport(null)}
                className="px-4 py-2 text-[10px] font-black text-gray-400 uppercase tracking-widest hover:bg-gray-50 rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

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
                <MapContainer 
                  center={[selectedReport.latitude, selectedReport.longitude] as [number, number]} 
                  zoom={15} 
                  zoomControl={false}
                  dragging={false}
                  touchZoom={false}
                  doubleClickZoom={false}
                  scrollWheelZoom={false}
                  style={{ height: '100%', width: '100%' }}
                >
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <Marker position={[selectedReport.latitude, selectedReport.longitude] as [number, number]} />
                </MapContainer>
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
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Location Data</span>
                  <div className="flex items-start gap-2 text-xs font-mono text-gray-700 leading-tight">
                    <MapPin className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                    <div className="flex flex-col">
                      <span className="font-bold">{selectedReport.address || "Address not available"}</span>
                      <span className="text-[10px] text-gray-400">{selectedReport.latitude.toFixed(6)}, {selectedReport.longitude.toFixed(6)}</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Reporter Info</span>
                  <div className="flex items-center gap-2 text-sm font-bold text-gray-900">
                    <UsersIcon className="w-4 h-4 text-blue-500" />
                    <span>{selectedReport.reporterName || 'Anonymous'}</span>
                  </div>
                  <p className="text-[10px] font-mono text-gray-400 truncate">UID: {selectedReport.reporterUid}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                <div className="space-y-2">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Routed To</span>
                  <div className="flex items-center gap-2 text-sm font-bold text-gray-900">
                    <ShieldAlert className="w-4 h-4 text-amber-500" />
                    <span>{selectedReport.routedTo || 'Pending Assignment'}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Estimated Solution</span>
                  <div className="flex items-center gap-2 text-sm font-bold text-blue-600">
                    <Clock className="w-4 h-4" />
                    <span>{selectedReport.estimatedSolution || 'TBD'}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Field Description</span>
                <p className="text-gray-700 text-sm leading-relaxed bg-gray-50 p-4 rounded-xl border border-gray-100 italic">
                  {selectedReport.description || "No description provided by the citizen."}
                </p>
              </div>

              <div className="pt-4 border-t border-gray-100 flex justify-end gap-3 flex-shrink-0">
                <button 
                  onClick={() => setSelectedReport(null)}
                  className="px-6 py-2 text-sm font-bold text-gray-500 hover:bg-gray-50 rounded-xl transition-colors"
                >
                  Close
                </button>
                <div className="relative group/status">
                  <button className="px-6 py-2 bg-blue-600 text-white text-sm font-bold rounded-xl shadow-lg hover:bg-blue-700 transition-all active:scale-95 flex items-center gap-2">
                    Update Status
                  </button>
                  <div className="absolute bottom-full right-0 mb-2 w-48 bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden hidden group-hover/status:block animate-in fade-in slide-in-from-bottom-2 duration-200">
                    {(['Open', 'In Progress', 'Resolved'] as Report['status'][]).map((status) => (
                      <button
                        key={status}
                        onClick={() => updateReportStatus(selectedReport.id!, status)}
                        className="w-full px-4 py-3 text-left text-xs font-bold hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0"
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Location Ping Details Modal */}
      {selectedLocationPing && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1000] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 max-h-[95vh] flex flex-col">
            <button 
              onClick={() => setSelectedLocationPing(null)}
              className="absolute top-4 right-4 p-2 bg-gray-100 text-gray-600 rounded-full hover:bg-gray-200 transition-colors z-[1001]"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="p-6 flex-1 overflow-y-auto custom-scrollbar">
              <LocationPingPopup
                ping={selectedLocationPing}
                onSelectReport={(report) => {
                  setSelectedReport(report);
                  setSelectedLocationPing(null);
                }}
                onClose={() => setSelectedLocationPing(null)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode, label: string, value: string | number }) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -5 }}
      className="p-6 bg-white rounded-2xl shadow-sm flex items-center space-x-4 hover:shadow-md transition-all"
      style={{borderColor: '#d9c9a8', borderWidth: '1px'}}
    >
      <div className="p-3 rounded-xl shadow-inner" style={{backgroundColor: '#f0f0f0'}}>
        {icon}
      </div>
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest" style={{color: '#9e9e9e'}}>{label}</p>
        <p className="text-2xl font-bold tracking-tight" style={{color: '#1a2e5a'}}>{value}</p>
      </div>
    </motion.div>
  );
}
