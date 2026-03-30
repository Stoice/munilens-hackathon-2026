import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import ReportForm from './components/ReportForm';
import Dashboard from './components/Dashboard';
import Auth from './components/Auth';
import ErrorBoundary from './components/ErrorBoundary';
import ProtectedRoute from './components/ProtectedRoute';
import { Unauthorized, Suspended } from './components/StatusPages';
import CommunityLeaderboard from './components/CommunityLeaderboard';
import LeaderboardPage from './components/LeaderboardPage';
import { UserProfile } from './types';
import { Layout, Camera, BarChart3, Info, Loader2 } from 'lucide-react';
import { auth, db, onAuthStateChanged } from './firebase';
import { doc, getDoc, setDoc, collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from './utils/firestoreErrorHandler';

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const path = `users/${firebaseUser.uid}`;
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            const profile = userDoc.data() as UserProfile;
            setUser(profile);
            
            // Global redirection for suspended users
            if (profile.enabled === false && location.pathname !== '/suspended') {
              navigate('/suspended', { replace: true });
            }
          } else {
            // Create default profile for Google login if it doesn't exist
            const isAdmin = firebaseUser.email === 'willselepe21@gmail.com';
            const newProfile: UserProfile = {
              uid: firebaseUser.uid,
              email: firebaseUser.email!,
              role: isAdmin ? 'admin' : 'citizen',
              displayName: firebaseUser.displayName || undefined,
              firstName: firebaseUser.displayName?.split(' ')[0] || '',
              lastName: firebaseUser.displayName?.split(' ').slice(1).join(' ') || '',
              enabled: true
            };
            await setDoc(doc(db, 'users', firebaseUser.uid), newProfile);
            setUser(newProfile);
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, path);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [navigate, location.pathname]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin" style={{color: '#1a6fa8'}} />
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <Toaster position="top-right" richColors />
      <div className="min-h-screen bg-gray-50 flex flex-col">
        {/* Navigation */}
        <nav className="bg-white border-b px-4 py-3 sticky top-0 z-50" style={{borderColor: '#d9c9a8'}}>
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <Link to="/" className="flex items-center space-x-2">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg" style={{backgroundColor: '#1a6fa8', boxShadow: '0 0 20px rgba(26, 111, 168, 0.3)'}}>
                <Layout className="text-white w-6 h-6" />
              </div>
              <span className="text-xl font-black tracking-tight" style={{color: '#1a2e5a'}}>MuniLens</span>
            </Link>

            <div className="flex items-center space-x-6">
              {user && (
                <div className="p-1 rounded-lg" style={{backgroundColor: '#f0f0f0'}}>
                  <Link 
                    to="/report"
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${location.pathname === '/report' ? 'bg-white shadow-sm' : 'hover:opacity-80'}`}
                    style={{color: location.pathname === '/report' ? '#1a6fa8' : '#9e9e9e'}}
                  >
                    <Camera className="w-4 h-4 inline-block mr-1" />
                    Report
                  </Link>
                  {user.role === 'admin' && (
                    <Link 
                      to="/dashboard"
                      className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${location.pathname === '/dashboard' ? 'bg-white shadow-sm' : 'hover:opacity-80'}`}
                      style={{color: location.pathname === '/dashboard' ? '#1a6fa8' : '#9e9e9e'}}
                    >
                      <BarChart3 className="w-4 h-4 inline-block mr-1" />
                      Dashboard
                    </Link>
                  )}
                </div>
              )}
              <Auth user={user} loading={loading} />
            </div>
          </div>
        </nav>

        {/* Main Content */}
        <main className="flex-grow">
          <Routes>
            <Route path="/" element={<Home user={user} navigate={navigate} />} />
            <Route path="/leaderboard" element={<LeaderboardPage currentUserId={user?.uid} />} />
            <Route path="/unauthorized" element={<Unauthorized />} />
            <Route path="/suspended" element={<Suspended />} />
            <Route 
              path="/report" 
              element={
                <ProtectedRoute user={user} loading={loading}>
                  <ReportForm />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/dashboard" 
              element={
                <ProtectedRoute user={user} loading={loading} requiredRole="admin">
                  <Dashboard />
                </ProtectedRoute>
              } 
            />
          </Routes>
        </main>

        {/* Footer */}
        <footer className="bg-white py-8 px-4" style={{borderTopColor: '#d9c9a8', borderTopWidth: '1px'}}>
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center space-x-2" style={{color: '#9e9e9e'}}>
              <Info className="w-4 h-4" />
              <span className="text-sm">MICT SETA 2026 Hackathon Submission</span>
            </div>
            <p className="text-sm" style={{color: '#9e9e9e'}}>© 2026 MuniLens. Built for South African Municipalities.</p>
          </div>
        </footer>
      </div>
    </ErrorBoundary>
  );
}

function Home({ user, navigate }: { user: UserProfile | null; navigate: ReturnType<typeof useNavigate> }) {
  const location = useLocation();
  const [reports, setReports] = useState<any[]>([]);
  const [loadingReports, setLoadingReports] = useState(true);

  const fetchReports = async () => {
    setLoadingReports(true);
    try {
      // Try fetching without orderBy first to check if data exists
      let reportsQuery;
      try {
        // Try with reportedAt first (what reports actually use)
        reportsQuery = query(
          collection(db, 'reports'),
          orderBy('reportedAt', 'desc'),
          limit(1000)
        );
      } catch (err) {
        console.warn('[Leaderboard] reportedAt ordering failed, trying without order:', err);
        // Fallback: fetch without ordering
        reportsQuery = query(
          collection(db, 'reports'),
          limit(1000)
        );
      }

      const snapshot = await getDocs(reportsQuery);
      const allReports = snapshot.docs.map(doc => {
        const data = doc.data() as any;
        return {
          id: doc.id,
          ...data,
        };
      });
      console.log(`[Leaderboard] Fetched ${allReports.length} reports from Firestore`);
      if (allReports.length > 0) {
        console.log('[Leaderboard] Sample report structure:', JSON.stringify(allReports[0], null, 2));
      }
      setReports(allReports);
    } catch (error) {
      console.error('[Leaderboard] Fetch error:', error);
      handleFirestoreError(error, OperationType.GET, 'reports');
    } finally {
      setLoadingReports(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [location.pathname]); // Refetch when navigating to home

  return (
    <div className="max-w-4xl mx-auto px-4 py-20 space-y-12 animate-in fade-in duration-500">
      {/* Hero Section */}
      <div className="text-center space-y-8">
        <h1 className="text-5xl md:text-7xl font-black leading-tight" style={{color: '#1a2e5a'}}>
          Fix your city with <span style={{color: '#1a6fa8'}}>AI.</span>
        </h1>
        <p className="text-xl max-w-2xl mx-auto" style={{color: '#9e9e9e'}}>
          MuniLens uses computer vision to instantly classify municipal faults. 
          Report potholes, leaks, and outages in seconds.
        </p>
        
        {user ? (
          <div className="pt-8">
            <Link 
              to="/report" 
              className="px-8 py-4 text-white rounded-2xl font-black uppercase tracking-widest text-sm transition-all shadow-xl hover:opacity-90" style={{backgroundColor: '#1a6fa8', boxShadow: '0 0 30px rgba(26, 111, 168, 0.3)'}}
            >
              Start Reporting Now
            </Link>
          </div>
        ) : (
          <p className="text-sm font-bold uppercase tracking-widest" style={{color: '#9e9e9e'}}>Sign in to start reporting</p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <Feature icon={<Camera className="w-8 h-8" style={{color: '#1a6fa8'}} />} title="Snap a Photo" desc="AI identifies the fault type instantly using computer vision." />
        <Feature icon={<Layout className="w-8 h-8" style={{color: '#00b4a6'}} />} title="Auto-Route" desc="Reports go directly to the correct municipal department." />
        <Feature icon={<BarChart3 className="w-8 h-8" style={{color: '#4caf50'}} />} title="Smart Insights" desc="Managers get AI-written summaries to prioritize repairs." />
      </div>

      {/* Community Leaderboard Widget */}
      {user && (
        <div className="pt-8">
          <div className="max-w-full">
            <CommunityLeaderboard 
              reports={reports} 
              currentUserId={user.uid}
              onRefresh={fetchReports}
              isRefreshing={loadingReports}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function Feature({ icon, title, desc }: { icon: React.ReactNode, title: string, desc: string }) {
  return (
    <div className="p-6 bg-white rounded-2xl shadow-sm text-center space-y-4" style={{borderColor: '#d9c9a8', borderWidth: '1px'}}>
      <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto" style={{backgroundColor: '#f0f0f0'}}>
        {icon}
      </div>
      <h3 className="text-lg font-bold" style={{color: '#1a2e5a'}}>{title}</h3>
      <p className="text-sm" style={{color: '#9e9e9e'}}>{desc}</p>
    </div>
  );
}
