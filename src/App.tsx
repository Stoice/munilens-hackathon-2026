import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import ReportForm from './components/ReportForm';
import Dashboard from './components/Dashboard';
import MapPage from './components/MapPage';
import Auth from './components/Auth';
import ErrorBoundary from './components/ErrorBoundary';
import ProtectedRoute from './components/ProtectedRoute';
import { Unauthorized, Suspended } from './components/StatusPages';
import CitizenScoreCard from './components/CitizenScoreCard';
import FaultVerification from './components/FaultVerification';
import LanguageSelector from './components/LanguageSelector';
import { useLanguage } from './i18n/LanguageContext';
import { UserProfile } from './types';
import { Layout, Camera, BarChart3, Map as MapIcon, Info, Loader2, ShieldCheck } from 'lucide-react';
import { auth, db, onAuthStateChanged } from './firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from './utils/firestoreErrorHandler';

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useLanguage();

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
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <Toaster position="top-right" richColors />
      <div className="min-h-screen flex flex-col">
        {/* Navigation */}
        <nav className="bg-white/70 backdrop-blur-md border-b border-white/40 px-4 py-3 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <Link to="/" className="flex items-center space-x-2">
              <img src="/app-icon.jpeg" alt="MuniLens" className="w-10 h-10 rounded-xl shadow-lg object-cover" />
              <span className="text-xl font-black text-gray-900 tracking-tight">MuniLens</span>
            </Link>

            <div className="flex items-center space-x-3">
              {user && (
                <div className="flex bg-gray-100 p-1 rounded-lg">
                  <Link 
                    to="/report"
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${location.pathname === '/report' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    <Camera className="w-4 h-4 inline-block mr-1" />
                    {t('nav.report')}
                  </Link>
                  {user.role === 'admin' && (
                    <>
                      <Link 
                        to="/dashboard"
                        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${location.pathname === '/dashboard' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                      >
                        <BarChart3 className="w-4 h-4 inline-block mr-1" />
                        {t('nav.dashboard')}
                      </Link>
                      <Link 
                        to="/map"
                        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${location.pathname === '/map' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                      >
                        <MapIcon className="w-4 h-4 inline-block mr-1" />
                        {t('nav.map')}
                      </Link>
                      <Link 
                        to="/faults"
                        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${location.pathname === '/faults' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                      >
                        <ShieldCheck className="w-4 h-4 inline-block mr-1" />
                        Faults
                      </Link>
                    </>
                  )}
                </div>
              )}
              <LanguageSelector />
              <Auth user={user} loading={loading} />
            </div>
          </div>
        </nav>

        {/* Main Content */}
        <main className="flex-grow">
          <Routes>
            <Route path="/" element={<Home user={user} />} />
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
            <Route
              path="/map"
              element={
                <ProtectedRoute user={user} loading={loading} requiredRole="admin">
                  <MapPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/faults"
              element={
                <ProtectedRoute user={user} loading={loading} requiredRole="admin">
                  <FaultVerification />
                </ProtectedRoute>
              }
            />
          </Routes>
        </main>

        {/* Footer */}
        <footer className="bg-white/70 backdrop-blur-md border-t border-white/40 py-8 px-4">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center space-x-2 text-gray-400">
              <Info className="w-4 h-4" />
              <span className="text-sm">{t('footer.hackathon')}</span>
            </div>
            <p className="text-sm text-gray-500">{t('footer.copyright')}</p>
          </div>
        </footer>
      </div>
    </ErrorBoundary>
  );
}

function Home({ user }: { user: UserProfile | null }) {
  const { t } = useLanguage();
  return (
    <div className="max-w-4xl mx-auto px-4 py-20 text-center space-y-8 animate-in fade-in duration-500">
      <h1 className="text-5xl md:text-7xl font-black text-gray-900 leading-tight">
        {t('hero.titleBefore')} <span className="text-blue-600">{t('hero.titleHighlight')}</span>
      </h1>
      <p className="text-xl text-gray-600 max-w-2xl mx-auto">
        {t('hero.subtitle')}
      </p>
      
      {user ? (
        <div className="pt-8 space-y-6">
          <Link 
            to="/report" 
            className="px-8 py-4 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-sm hover:bg-blue-700 transition-all shadow-xl shadow-blue-200"
          >
            {t('hero.cta')}
          </Link>
          {user.role === 'citizen' && <CitizenScoreCard />}
        </div>
      ) : (
        <p className="text-sm text-gray-400 font-bold uppercase tracking-widest">{t('hero.signInPrompt')}</p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-12">
        <Feature icon={<Camera className="text-blue-500" />} title={t('feature.snap.title')} desc={t('feature.snap.desc')} />
        <Feature icon={<Layout className="text-purple-500" />} title={t('feature.route.title')} desc={t('feature.route.desc')} />
        <Feature icon={<BarChart3 className="text-green-500" />} title={t('feature.insights.title')} desc={t('feature.insights.desc')} />
      </div>
    </div>
  );
}

function Feature({ icon, title, desc }: { icon: React.ReactNode, title: string, desc: string }) {
  return (
    <div className="p-6 bg-white/60 backdrop-blur-md rounded-2xl shadow-sm border border-white/30 text-center space-y-4">
      <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center mx-auto">
        {icon}
      </div>
      <h3 className="text-lg font-bold text-gray-900">{title}</h3>
      <p className="text-sm text-gray-500">{desc}</p>
    </div>
  );
}
