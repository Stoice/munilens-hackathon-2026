import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, doc, updateDoc, query, orderBy } from 'firebase/firestore';
import { UserProfile } from '../types';
import { Users, Shield, ShieldAlert, UserCheck, UserX, Search, Loader2, AlertCircle, X } from 'lucide-react';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';
import { motion, AnimatePresence } from 'motion/react';

export default function UserManagement() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState<{
    show: boolean;
    type: 'role' | 'status';
    user: UserProfile | null;
  }>({ show: false, type: 'role', user: null });

  useEffect(() => {
    const path = 'users';
    const q = query(collection(db, path), orderBy('email', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data() } as UserProfile));
      setUsers(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });
    return () => unsubscribe();
  }, []);

  const handleConfirmAction = async () => {
    if (!confirmModal.user) return;
    
    const user = confirmModal.user;
    const path = `users/${user.uid}`;
    
    try {
      if (confirmModal.type === 'status') {
        await updateDoc(doc(db, 'users', user.uid), {
          enabled: !user.enabled
        });
      } else {
        const newRole = user.role === 'admin' ? 'citizen' : 'admin';
        await updateDoc(doc(db, 'users', user.uid), {
          role: newRole
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    } finally {
      setConfirmModal({ show: false, type: 'role', user: null });
    }
  };

  const filteredUsers = users.filter(u => 
    u.email.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.displayName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin" style={{color: '#1a6fa8'}} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h2 className="text-2xl font-bold flex items-center gap-2" style={{color: '#1a2e5a'}}>
          <Users className="w-6 h-6" style={{color: '#1a6fa8'}} />
          User Management
        </h2>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input 
            type="text" 
            placeholder="Search users..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none w-full md:w-64"
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4 font-semibold">User</th>
                <th className="px-6 py-4 font-semibold">Contact</th>
                <th className="px-6 py-4 font-semibold">Province</th>
                <th className="px-6 py-4 font-semibold">Role</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              <AnimatePresence>
                {filteredUsers.map((user, index) => (
                  <motion.tr 
                    key={user.uid}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.02 }}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-serif italic text-gray-900 font-bold">{user.displayName || 'Anonymous'}</span>
                        <span className="text-[10px] font-mono text-gray-400 uppercase tracking-widest">UID: {user.uid.slice(0, 8)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-gray-900">{user.phoneNumber || 'N/A'}</span>
                        <span className="text-[10px] text-gray-400 uppercase tracking-widest">{user.email}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-medium text-gray-700">{user.province || 'N/A'}</span>
                    </td>
                    <td className="px-6 py-4">
                      <button 
                        onClick={() => setConfirmModal({ show: true, type: 'role', user })}
                        className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider transition-colors ${
                          user.role === 'admin' 
                            ? 'bg-purple-100 text-purple-700 hover:bg-purple-200' 
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {user.role === 'admin' ? <Shield className="w-3 h-3" /> : <Users className="w-3 h-3" />}
                        {user.role}
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider ${
                        user.enabled ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {user.enabled ? <UserCheck className="w-3 h-3" /> : <UserX className="w-3 h-3" />}
                        {user.enabled ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => setConfirmModal({ show: true, type: 'status', user })}
                        className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                          user.enabled 
                            ? 'text-red-600 hover:bg-red-50' 
                            : 'text-green-600 hover:bg-green-50'
                        }`}
                      >
                        {user.enabled ? 'Disable' : 'Enable'}
                      </button>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirmation Modal */}
      {confirmModal.show && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 p-8 space-y-6">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className={`p-4 rounded-full ${confirmModal.type === 'status' ? 'bg-red-50 text-red-600' : 'bg-purple-50 text-purple-600'}`}>
                <AlertCircle className="w-10 h-10" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-black text-gray-900 uppercase tracking-tight italic font-serif">Confirm Action</h3>
                <p className="text-sm text-gray-500 leading-relaxed">
                  Are you sure you want to {confirmModal.type === 'status' 
                    ? (confirmModal.user?.enabled ? 'disable' : 'enable') 
                    : `change the role of`} <b>{confirmModal.user?.displayName || confirmModal.user?.email}</b>?
                  {confirmModal.type === 'role' && confirmModal.user?.role === 'admin' && (
                    <span className="block mt-2 text-red-600 font-bold uppercase text-[10px] tracking-widest">Warning: This will remove administrative privileges.</span>
                  )}
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <button 
                onClick={() => setConfirmModal({ show: false, type: 'role', user: null })}
                className="flex-1 py-3 text-sm font-bold text-gray-500 hover:bg-gray-50 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleConfirmAction}
                className={`flex-1 py-3 text-sm font-black uppercase tracking-widest text-white rounded-xl shadow-lg transition-all active:scale-95 ${
                  confirmModal.type === 'status' ? 'bg-red-600 hover:bg-red-700 shadow-red-100' : 'bg-purple-600 hover:bg-purple-700 shadow-purple-100'
                }`}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
