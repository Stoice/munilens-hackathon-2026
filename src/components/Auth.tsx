import React, { useState } from 'react';
import { auth, db, createUserWithEmailAndPassword, signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, signOut } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';
import { UserProfile, Province } from '../types';
import { LogIn, LogOut, User as UserIcon, Shield, Mail, Lock, UserPlus, X, MapPin } from 'lucide-react';

const PROVINCES: Province[] = [
  'Eastern Cape', 'Free State', 'Gauteng', 'KwaZulu-Natal', 'Limpopo', 
  'Mpumalanga', 'Northern Cape', 'North West', 'Western Cape'
];

interface AuthProps {
  user: UserProfile | null;
  loading: boolean;
}

export default function Auth({ user, loading }: AuthProps) {
  const [showModal, setShowModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  
  // Form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [province, setProvince] = useState<Province | ''>('');
  const [error, setError] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      setShowModal(false);
    } catch (err) {
      setError("Google login failed");
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      if (authMode === 'signup') {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const isAdmin = email === 'willselepe21@gmail.com';
        const newProfile: UserProfile = {
          uid: userCredential.user.uid,
          email,
          role: isAdmin ? 'admin' : 'citizen',
          displayName: `${firstName} ${lastName}`.trim(),
          firstName,
          lastName,
          phoneNumber,
          province: province as Province,
          enabled: true
        };
        await setDoc(doc(db, 'users', userCredential.user.uid), newProfile);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      setShowModal(false);
      resetForm();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setFirstName('');
    setLastName('');
    setPhoneNumber('');
    setProvince('');
    setError(null);
  };

  const logout = () => signOut(auth);

  if (loading) return null;

  return (
    <div className="flex items-center space-x-4">
      {user ? (
        <div className="flex items-center space-x-3">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-bold text-gray-900">{user.displayName || user.email}</p>
            <p className="text-xs text-gray-500 capitalize flex items-center justify-end">
              {user.role === 'admin' && <Shield className="w-3 h-3 mr-1 text-blue-500" />}
              {user.role}
            </p>
          </div>
          <button 
            onClick={logout}
            className="p-2 text-gray-500 hover:text-red-600 transition-colors"
            title="Sign Out"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      ) : (
        <button 
          onClick={() => setShowModal(true)}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
        >
          <LogIn className="w-4 h-4" />
          <span>Sign In</span>
        </button>
      )}

      {/* Auth Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-300 flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50 flex-shrink-0">
              <h2 className="text-xl font-black text-gray-900">
                {authMode === 'login' ? 'Welcome Back' : 'Create Account'}
              </h2>
              <button 
                onClick={() => { setShowModal(false); resetForm(); }}
                className="p-2 hover:bg-white rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <form onSubmit={handleEmailAuth} className="p-6 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
              {error && (
                <div className="p-3 bg-red-50 text-red-600 text-xs font-bold rounded-lg border border-red-100">
                  {error}
                </div>
              )}

              {authMode === 'signup' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">First Name</label>
                    <div className="relative">
                      <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input 
                        required
                        type="text"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="John"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Last Name</label>
                    <div className="relative">
                      <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input 
                        required
                        type="text"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="Doe"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input 
                    required
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="name@example.com"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input 
                    required
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              {authMode === 'signup' && (
                <>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Phone Number</label>
                    <input 
                      required
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="+27 12 345 6789"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Province</label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <select
                        required
                        value={province}
                        onChange={(e) => setProvince(e.target.value as Province)}
                        className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none appearance-none"
                      >
                        <option value="" disabled>Select Province</option>
                        {PROVINCES.map(p => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </>
              )}

              <button 
                type="submit"
                className="w-full py-3 bg-blue-600 text-white rounded-xl font-black uppercase tracking-widest text-xs hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
              >
                {authMode === 'login' ? 'Sign In' : 'Create Account'}
              </button>

              <div className="relative py-4">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-100"></div></div>
                <div className="relative flex justify-center text-[10px] uppercase font-black tracking-widest text-gray-400">
                  <span className="bg-white px-2">Or continue with</span>
                </div>
              </div>

              <button 
                type="button"
                onClick={handleGoogleLogin}
                className="w-full py-3 bg-white border border-gray-200 text-gray-700 rounded-xl font-black uppercase tracking-widest text-xs hover:bg-gray-50 transition-all flex items-center justify-center space-x-2"
              >
                <img src="https://www.google.com/favicon.ico" className="w-4 h-4" alt="Google" />
                <span>Google</span>
              </button>

              <p className="text-center text-xs text-gray-500 pt-4">
                {authMode === 'login' ? "Don't have an account? " : "Already have an account? "}
                <button 
                  type="button"
                  onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}
                  className="text-blue-600 font-bold hover:underline"
                >
                  {authMode === 'login' ? 'Sign Up' : 'Log In'}
                </button>
              </p>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
