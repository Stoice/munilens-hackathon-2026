import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, UserX, Home, LogOut } from 'lucide-react';
import { signOut, auth } from '../firebase';

export function Unauthorized() {
  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 text-center space-y-6 animate-in zoom-in duration-300">
        <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto">
          <ShieldAlert className="w-10 h-10 text-red-600" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-black text-gray-900 uppercase tracking-tight italic font-serif">Access Denied</h2>
          <p className="text-gray-500 text-sm">
            You do not have the required permissions to view this page. This area is restricted to administrative personnel only.
          </p>
        </div>
        <div className="pt-4">
          <Link 
            to="/" 
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-black uppercase tracking-widest text-xs hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
          >
            <Home className="w-4 h-4" />
            Return Home
          </Link>
        </div>
      </div>
    </div>
  );
}

export function Suspended() {
  const handleLogout = () => signOut(auth);

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 text-center space-y-6 animate-in zoom-in duration-300">
        <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mx-auto">
          <UserX className="w-10 h-10 text-amber-600" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-black text-gray-900 uppercase tracking-tight italic font-serif">Account Suspended</h2>
          <p className="text-gray-500 text-sm">
            Your account has been temporarily disabled by the municipal administrator. Please contact support if you believe this is an error.
          </p>
        </div>
        <div className="pt-4 flex flex-col gap-3">
          <button 
            onClick={handleLogout}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-black uppercase tracking-widest text-xs hover:bg-gray-200 transition-all"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
          <Link 
            to="/" 
            className="text-xs text-blue-600 font-bold hover:underline"
          >
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
