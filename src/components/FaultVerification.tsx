import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import {
  collection, query, where, onSnapshot,
  addDoc, doc, serverTimestamp, Timestamp,
} from 'firebase/firestore';
import { ShieldCheck, AlertTriangle, Loader2, MapPin, Zap } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────
interface FaultDoc {
  id: string;
  fault_type: string;
  confidence: number;
  gps: { lat: number; lng: number };
  verified: boolean;
  severity: number;
  timestamp: Timestamp;
  image_url?: string;
}

// ── Per-card component ────────────────────────────────────────────
function FaultCard({ fault }: { fault: FaultDoc }) {
  const [disabled, setDisabled]         = useState(false);
  const [dispatched, setDispatched]     = useState(false);
  const [statusMsg, setStatusMsg]       = useState('');
  const [newDocId, setNewDocId]         = useState<string | null>(null);
  const [verifiedData, setVerifiedData] = useState<FaultDoc | null>(null);

  // Real-time listener on the newly created verification document
  useEffect(() => {
    if (!newDocId) return;
    const unsubscribe = onSnapshot(
      doc(db, 'faults', newDocId),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as Omit<FaultDoc, 'id'>;
          if (data.verified) {
            setVerifiedData({ id: snap.id, ...data });
            setDispatched(false); // stop showing the spinner message
          }
        }
      },
      (err) => console.error('[MuniLens] Verification listener error:', err),
    );
    return () => unsubscribe();
  }, [newDocId]);

  const handleDispatch = async () => {
    setDisabled(true);
    try {
      const docRef = await addDoc(collection(db, 'faults'), {
        verified: false,
        gps: { lat: fault.gps.lat, lng: fault.gps.lng },
        fault_type: '',
        severity: fault.severity,
        timestamp: serverTimestamp(),
      });
      setNewDocId(docRef.id);
      setDispatched(true);
      setStatusMsg('IoT unit dispatched — awaiting verification');
    } catch (err) {
      console.error('[MuniLens] Dispatch error:', err);
      setStatusMsg('Failed to dispatch — please retry');
      setDisabled(false);
    }
  };

  const borderColor =
    fault.severity >= 9 ? 'border-red-500' :
    fault.severity >= 7 ? 'border-orange-400' :
                          'border-yellow-400';

  const formattedTime = fault.timestamp?.toDate?.().toLocaleString() ?? 'Unknown';

  return (
    <div className={`bg-white rounded-2xl shadow-sm border-l-4 ${borderColor} p-5 space-y-4`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">
            {verifiedData
              ? verifiedData.fault_type || 'Fault'
              : fault.fault_type     || 'Unclassified Fault'}
          </p>
          <p className="text-lg font-bold text-gray-800">Severity {fault.severity}/10</p>
        </div>

        {verifiedData ? (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full border border-green-200 shrink-0">
            <ShieldCheck className="w-3.5 h-3.5" />
            Verified
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-orange-100 text-orange-700 text-xs font-bold rounded-full border border-orange-200 shrink-0">
            <AlertTriangle className="w-3.5 h-3.5" />
            Unverified
          </span>
        )}
      </div>

      {/* GPS */}
      <div className="flex items-center gap-1.5 text-sm text-gray-500">
        <MapPin className="w-3.5 h-3.5 shrink-0" />
        <span>{fault.gps.lat.toFixed(6)}, {fault.gps.lng.toFixed(6)}</span>
      </div>

      {/* Timestamp */}
      <p className="text-xs text-gray-400">{formattedTime}</p>

      {/* Verified result section */}
      {verifiedData ? (
        <div className="space-y-3">
          {verifiedData.image_url && (
            <img
              src={verifiedData.image_url}
              alt="Verified fault"
              className="w-full h-48 object-cover rounded-xl"
            />
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-400 mb-1">AI Classification</p>
              <p className="text-sm font-semibold text-gray-800">
                {verifiedData.fault_type || '—'}
              </p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-400 mb-1">Confidence</p>
              <p className="text-sm font-semibold text-gray-800">
                {verifiedData.confidence != null
                  ? `${(verifiedData.confidence * 100).toFixed(1)}%`
                  : '—'}
              </p>
            </div>
          </div>
        </div>
      ) : (
        /* Pre-verification action area */
        dispatched ? (
          <div className="flex items-center gap-2 text-sm text-blue-600 bg-blue-50 rounded-xl px-4 py-3 font-medium">
            <Loader2 className="w-4 h-4 animate-spin shrink-0" />
            {statusMsg}
          </div>
        ) : (
          <div className="space-y-2">
            <button
              onClick={handleDispatch}
              disabled={disabled}
              className="w-full flex items-center justify-center gap-2 bg-gray-900 hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
            >
              <Zap className="w-4 h-4" />
              Verify with IoT
            </button>
            {statusMsg && (
              <p className="text-xs text-red-500 text-center">{statusMsg}</p>
            )}
          </div>
        )
      )}
    </div>
  );
}

// ── Main page component ───────────────────────────────────────────
export default function FaultVerification() {
  const [faults, setFaults]   = useState<FaultDoc[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Composite query: severity >= 7 AND verified == false
    // Firestore requires a composite index on (severity ASC, verified ASC) —
    // the console will print a direct link to create it on first run if missing.
    const q = query(
      collection(db, 'faults'),
      where('severity', '>=', 7),
      where('verified', '==', false),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as FaultDoc));
        // Sort client-side descending by severity so most critical appear first
        data.sort((a, b) => b.severity - a.severity);
        setFaults(data);
        setLoading(false);
      },
      (error) => {
        console.error('[MuniLens] FaultVerification query error:', error);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h2 className="text-2xl font-black text-gray-900">Critical Fault Verification</h2>
        <p className="text-sm text-gray-500 mt-1">
          Unverified faults with severity ≥ 7 &mdash; {faults.length} pending
        </p>
      </div>

      {faults.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center">
          <ShieldCheck className="w-12 h-12 text-green-400 mx-auto mb-3" />
          <p className="text-gray-600 font-semibold">No critical unverified faults</p>
          <p className="text-sm text-gray-400 mt-1">All high-severity reports have been handled.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {faults.map(fault => (
            <FaultCard key={fault.id} fault={fault} />
          ))}
        </div>
      )}
    </div>
  );
}
