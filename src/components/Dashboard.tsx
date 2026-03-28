import React, { useState, useEffect, useRef } from 'react';
import { db, auth } from '../firebase';
import { collection, query, orderBy, onSnapshot, limit, doc, getDoc, updateDoc } from 'firebase/firestore';
import { generateWeeklyReport } from '../services/gemini';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Report, UserProfile } from '../types';
import { FileText, Map as MapIcon, AlertTriangle, CheckCircle, Clock, Loader2, Download, Users as UsersIcon, LayoutDashboard, Settings, X, Eye, MapPin, Navigation, Bell, ShieldAlert } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { toast } from 'sonner';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';
import UserManagement from './UserManagement';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
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
    case 'Medium': return 'bg-blue-100 text-blue-700 border border-blue-200';
    case 'Low': return 'bg-gray-100 text-gray-700 border border-gray-200';
    default: return 'bg-blue-100 text-blue-700 border border-blue-200';
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
    const q = query(collection(db, path), orderBy('reportedAt', 'desc'), limit(100));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Report));
      
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
    
    const canvas = await html2canvas(aiReportRef.current);
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const imgProps = pdf.getImageProperties(imgData);
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
    
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    pdf.save(`MuniLens_Insight_Report_${new Date().toISOString().split('T')[0]}.pdf`);
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
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
      </div>
    );
  }

  const stats = getStats();
  const isAdmin = userProfile?.role === 'admin';

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col hidden md:flex">
        <div className="p-6 border-b border-gray-100">
          <h1 className="text-xl font-black text-blue-600 tracking-tighter uppercase italic">MuniLens</h1>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Municipal Control</p>
        </div>
        
        <nav className="flex-1 p-4 space-y-1">
          <button 
            onClick={() => setActiveTab('overview')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
              activeTab === 'overview' ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            <LayoutDashboard className="w-5 h-5" />
            Overview
          </button>
          <button 
            onClick={() => setActiveTab('map')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
              activeTab === 'map' ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            <MapIcon className="w-5 h-5" />
            Map View
          </button>
          {isAdmin && (
            <button 
              onClick={() => setActiveTab('users')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                activeTab === 'users' ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              <UsersIcon className="w-5 h-5" />
              User Management
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
                  <h2 className="text-3xl font-bold text-gray-900 tracking-tight italic font-serif">Dashboard Overview</h2>
                  <p className="text-sm text-gray-500 font-mono">SYSTEM_STATUS: OPERATIONAL • {reports.length} ACTIVE_REPORTS</p>
                </div>
                {isAdmin && (
                  <button 
                    onClick={handleGenerateAiReport}
                    disabled={generatingAi}
                    className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg hover:bg-blue-700 transition-all disabled:opacity-50 active:scale-95"
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
                <StatCard icon={<CheckCircle className="text-green-500" />} label="Resolved" value={stats.statusBreakdown['Resolved']} />
                <StatCard icon={<MapIcon className="text-blue-500" />} label="Top Category" value={stats.topFault} />
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
                    <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">Fault Distribution</h3>
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                  </div>
                  <div className="flex-1 min-h-0">
                    <ResponsiveContainer width="100%" height="100%">
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
                  className="bg-white p-8 rounded-2xl shadow-xl border-2 border-blue-100"
                >
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-blue-900 flex items-center space-x-2">
                      <FileText className="w-8 h-8" />
                      <span>AI Weekly Insight Briefing</span>
                    </h2>
                    <button className="p-2 hover:bg-gray-100 rounded-full text-gray-400" onClick={() => setAiReport(null)}>
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="prose prose-blue max-w-none">
                    <ReactMarkdown>{aiReport}</ReactMarkdown>
                  </div>
                  <button 
                    onClick={exportToPdf}
                    className="mt-8 flex items-center space-x-2 px-4 py-2 text-blue-600 font-medium hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    <span>Export as PDF</span>
                  </button>
                </motion.div>
              )}

              {/* Recent Reports Table */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-6 border-b border-gray-100 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">Recent Reports</h3>
                    <span className="text-[10px] bg-gray-100 px-2 py-1 rounded font-bold text-gray-500 tracking-tighter">LIVE_FEED</span>
                  </div>
                  
                  {/* Filters */}
                  <div className="flex flex-wrap gap-4 pt-2">
                    <div className="flex flex-col gap-1">
                      <label className="text-[8px] font-black text-gray-400 uppercase tracking-widest ml-1">Status</label>
                      <select 
                        value={filterConfig.status}
                        onChange={(e) => setFilterConfig(prev => ({ ...prev, status: e.target.value }))}
                        className="px-3 py-1.5 bg-gray-50 border border-gray-100 rounded-lg text-[10px] font-bold text-gray-700 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                      >
                        <option value="All">All Statuses</option>
                        <option value="Open">Open</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Resolved">Resolved</option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[8px] font-black text-gray-400 uppercase tracking-widest ml-1">Importance</label>
                      <select 
                        value={filterConfig.importance}
                        onChange={(e) => setFilterConfig(prev => ({ ...prev, importance: e.target.value }))}
                        className="px-3 py-1.5 bg-gray-50 border border-gray-100 rounded-lg text-[10px] font-bold text-gray-700 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                      >
                        <option value="All">All Importance</option>
                        <option value="Critical">Critical</option>
                        <option value="High">High</option>
                        <option value="Medium">Medium</option>
                        <option value="Low">Low</option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[8px] font-black text-gray-400 uppercase tracking-widest ml-1">Type</label>
                      <select 
                        value={filterConfig.type}
                        onChange={(e) => setFilterConfig(prev => ({ ...prev, type: e.target.value }))}
                        className="px-3 py-1.5 bg-gray-50 border border-gray-100 rounded-lg text-[10px] font-bold text-gray-700 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
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
                    <thead className="bg-gray-50 text-gray-500 text-[10px] uppercase tracking-widest">
                      <tr>
                        <th className="px-6 py-4 font-bold cursor-pointer hover:text-blue-600 transition-colors" onClick={() => handleSort('type')}>
                          <div className="flex items-center gap-1">
                            Type
                            {sortConfig.key === 'type' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                          </div>
                        </th>
                        <th className="px-6 py-4 font-bold cursor-pointer hover:text-blue-600 transition-colors" onClick={() => handleSort('importance')}>
                          <div className="flex items-center gap-1">
                            Importance
                            {sortConfig.key === 'importance' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                          </div>
                        </th>
                        <th className="px-6 py-4 font-bold cursor-pointer hover:text-blue-600 transition-colors" onClick={() => handleSort('status')}>
                          <div className="flex items-center gap-1">
                            Status
                            {sortConfig.key === 'status' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                          </div>
                        </th>
                        <th className="px-6 py-4 font-bold cursor-pointer hover:text-blue-600 transition-colors" onClick={() => handleSort('location')}>
                          <div className="flex items-center gap-1">
                            Location
                            {sortConfig.key === 'location' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                          </div>
                        </th>
                        <th className="px-6 py-4 font-bold cursor-pointer hover:text-blue-600 transition-colors" onClick={() => handleSort('reportedAt')}>
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
              <div className="absolute top-6 left-6 z-[400] bg-white/90 backdrop-blur px-4 py-2 rounded-xl shadow-lg border border-gray-100">
                <h3 className="text-xs font-black text-gray-900 uppercase tracking-widest flex items-center gap-2">
                  <Navigation className="w-4 h-4 text-blue-600" />
                  Live Fault Map
                </h3>
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
                {reports.map((report) => (
                  <Marker 
                    key={report.id} 
                    position={[report.latitude, report.longitude] as [number, number]}
                  >
                    <LeafletTooltip direction="top" offset={[0, -32]} opacity={1} permanent={false}>
                      <div className="p-2 space-y-1 min-w-[120px] bg-white rounded-lg shadow-sm border border-gray-100">
                        <h4 className="text-[10px] font-serif italic font-bold text-gray-900 leading-tight">{report.type}</h4>
                        <div className="flex gap-1">
                          <span className={`px-1.5 py-0.5 rounded-full text-[7px] font-black uppercase tracking-wider ${
                            report.status === 'Open' ? 'bg-red-100 text-red-700' :
                            report.status === 'In Progress' ? 'bg-amber-100 text-amber-700' :
                            'bg-green-100 text-green-700'
                          }`}>
                            {report.status}
                          </span>
                          <span className={`px-1.5 py-0.5 rounded-lg text-[7px] font-black uppercase tracking-wider ${getImportanceColor(report.importance || 'Medium')}`}>
                            {report.importance || 'Medium'}
                          </span>
                        </div>
                      </div>
                    </LeafletTooltip>
                    <Popup className="custom-popup">
                      <div className="p-2 space-y-2 min-w-[180px]">
                        <h4 className="font-serif italic font-bold text-gray-900">{report.type}</h4>
                        <p className="text-[10px] text-gray-500 line-clamp-2">{report.description || 'No description provided.'}</p>
                        <button 
                          onClick={() => setSelectedReport(report)}
                          className="w-full mt-2 py-1.5 bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          View Full Details
                        </button>
                      </div>
                    </Popup>
                  </Marker>
                ))}
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
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode, label: string, value: string | number }) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -5 }}
      className="p-6 bg-white rounded-2xl shadow-sm border border-gray-100 flex items-center space-x-4 hover:shadow-md transition-all"
    >
      <div className="p-3 bg-[#F8F9FA] rounded-xl shadow-inner">
        {icon}
      </div>
      <div>
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{label}</p>
        <p className="text-2xl font-bold text-gray-900 tracking-tight">{value}</p>
      </div>
    </motion.div>
  );
}
