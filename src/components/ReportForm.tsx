import React, { useState, useRef, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, addDoc, doc, getDoc } from 'firebase/firestore';
import { classifyFault } from '../services/gemini';
import { Camera, MapPin, CheckCircle, Loader2, AlertCircle, ShieldAlert, AlertTriangle, Info } from 'lucide-react';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';
import { UserProfile, Importance } from '../types';
import { Viewer, Entity, PointGraphics } from 'resium';
import { Cartesian3, Color } from 'cesium';
import { toast } from 'sonner';
import { useLanguage } from '../i18n/LanguageContext';
import 'cesium/Build/Cesium/Widgets/widgets.css';

export default function ReportForm() {
  const [step, setStep] = useState<'camera' | 'review' | 'success'>('camera');
  const [photo, setPhoto] = useState<string | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [classification, setClassification] = useState<{ category: string; importance: Importance; routedTo: string; estimatedSolution: string } | null>(null);
  const [description, setDescription] = useState('');
  const [submittedReportId, setSubmittedReportId] = useState<string | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const { t } = useLanguage();

  useEffect(() => {
    if (step === 'review') {
      const timer = setTimeout(() => setMapReady(true), 500);
      return () => {
        clearTimeout(timer);
        setMapReady(false);
      };
    }
  }, [step]);

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
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (step === 'camera' && userProfile?.enabled !== false) {
      startCamera();
      getLocation();
    }
  }, [step, userProfile]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      setError("Camera access denied. Please enable camera permissions.");
    }
  };

  const getLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setLocation({ lat, lng });
          setAccuracy(pos.coords.accuracy);

          // Reverse Geocoding
          try {
            const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`);
            const data = await response.json();
            setAddress(data.display_name || "Address not found");
          } catch (err) {
            console.error("Reverse geocoding failed", err);
            setAddress("Address lookup failed");
          }
        },
        (err) => {
          setError("Location access denied. Please enable GPS.");
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    }
  };

  const capture = async () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      if (context) {
        context.drawImage(videoRef.current, 0, 0, 640, 480);
        const dataUrl = canvasRef.current.toDataURL('image/jpeg');
        setPhoto(dataUrl);
        setStep('review');
        
        // Stop camera
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());

        // Start AI classification
        setLoading(true);
        try {
          const base64 = dataUrl.split(',')[1];
          const result = await classifyFault(base64);
          setClassification(result);
        } catch (err) {
          console.error("Classification failed", err);
          setClassification({ 
            category: "Other", 
            importance: "Medium", 
            routedTo: "General Maintenance", 
            estimatedSolution: "TBD" 
          });
        } finally {
          setLoading(false);
        }
      }
    }
  };

  const submitReport = async () => {
    if (!auth.currentUser) {
      setError("Please sign in to submit a report.");
      toast.error("Authentication Required", { description: "Please sign in to submit a report." });
      return;
    }
    if (userProfile?.enabled === false) {
      setError("Your account has been disabled. Please contact an administrator.");
      toast.error("Access Denied", { description: "Your account has been disabled." });
      return;
    }
    
    if (!location) {
      toast.error("GPS Lock Required", { description: "Please wait for a GPS lock before transmitting." });
      return;
    }

    if (!classification || !photo) {
      toast.error("Data Missing", { description: "AI analysis or photo is missing. Please retake." });
      return;
    }

    setLoading(true);
    const path = 'reports';
    try {
      const docRef = await addDoc(collection(db, path), {
        type: classification.category,
        importance: classification.importance,
        description: description,
        latitude: location.lat,
        longitude: location.lng,
        address: address,
        photoUrl: photo, // In a real app, upload to Storage first
        status: 'Open',
        reportedAt: new Date().toISOString(),
        reporterUid: auth.currentUser.uid,
        reporterName: userProfile?.displayName || auth.currentUser.email || 'Anonymous',
        routedTo: classification.routedTo,
        estimatedSolution: classification.estimatedSolution,
      });
      setSubmittedReportId(docRef.id);
      setStep('success');
      toast.success("Report Transmitted", {
        description: `Fault ${classification.category} has been logged successfully.`,
        icon: <CheckCircle className="w-4 h-4 text-green-500" />
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
      toast.error("Transmission failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const getImportanceColor = (imp: Importance) => {
    switch (imp) {
      case 'Critical': return 'bg-red-100 text-red-700 border border-red-200';
      case 'High': return 'bg-orange-100 text-orange-700 border border-orange-200';
      case 'Medium': return 'bg-blue-100 text-blue-700 border border-blue-200';
      case 'Low': return 'bg-gray-100 text-gray-700 border border-gray-200';
      default: return 'bg-blue-100 text-blue-700 border border-blue-200';
    }
  };

  if (userProfile?.enabled === false) {
    return (
      <div className="max-w-md mx-auto p-8 text-center space-y-6">
        <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto">
          <ShieldAlert className="w-12 h-12 text-red-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 tracking-tight">{t('report.disabled.title')}</h2>
        <p className="text-gray-500 text-sm leading-relaxed">
          {t('report.disabled.message')}
        </p>
      </div>
    );
  }

  if (step === 'success') {
    return (
      <div className="max-w-md mx-auto p-4 space-y-6 animate-in fade-in zoom-in duration-300">
        <div className="flex flex-col items-center justify-center p-8 text-center space-y-4">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center shadow-inner">
            <CheckCircle className="w-12 h-12 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight italic font-serif">{t('report.success.title')}</h2>
          <p className="text-gray-500 text-sm">{t('report.success.message')}</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="bg-gray-50 px-4 py-2 border-b border-gray-100 flex justify-between items-center">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{t('report.success.officialFeedback')}</span>
            <span className="text-[10px] font-mono text-blue-600 font-bold">REF: {submittedReportId?.slice(-8).toUpperCase()}</span>
          </div>
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">{t('report.category')}</p>
                <p className="text-sm font-bold text-gray-900">{classification?.category}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">{t('report.urgency')}</p>
                <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${getImportanceColor(classification?.importance || 'Medium')}`}>
                  {classification?.importance}
                </span>
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">{t('report.routedTo')}</p>
              <p className="text-sm font-bold text-gray-900 flex items-center">
                <ShieldAlert className="w-3 h-3 mr-1.5 text-blue-500" />
                {classification?.routedTo}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">{t('report.estimatedSolution')}</p>
              <p className="text-sm font-bold text-blue-600 flex items-center">
                <Loader2 className="w-3 h-3 mr-1.5 animate-spin-slow" />
                {classification?.estimatedSolution}
              </p>
            </div>
          </div>
        </div>

        <button 
          onClick={() => {
            setStep('camera');
            setPhoto(null);
            setClassification(null);
            setDescription('');
            setSubmittedReportId(null);
          }}
          className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl hover:bg-blue-700 transition-all active:scale-95"
        >
          {t('report.success.reportAnother')}
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto p-4 space-y-6 overflow-y-auto max-h-[calc(100vh-120px)] custom-scrollbar">
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <h1 className="text-2xl font-black text-blue-600 tracking-tighter uppercase italic">MuniLens</h1>
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t('report.fieldUnit')}</span>
        </div>
        <div className="flex flex-col items-end space-y-1">
          <div className="flex items-center space-x-2 text-[10px] font-black uppercase tracking-widest text-gray-500">
            <MapPin className={`w-3 h-3 ${location ? (accuracy && accuracy < 50 ? 'text-green-500' : 'text-amber-500') : 'text-gray-300'}`} />
            <span>{location ? t('report.gpsLocked') : t('report.gpsSearching')}</span>
          </div>
          {accuracy !== null && (
            <div className="flex items-center space-x-1">
              <div className="h-1 w-16 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-500 ${accuracy < 20 ? 'w-full bg-green-500' : accuracy < 100 ? 'w-2/3 bg-amber-500' : 'w-1/3 bg-red-500'}`}
                />
              </div>
              <span className="text-[8px] font-mono text-gray-400">±{Math.round(accuracy)}M</span>
            </div>
          )}
        </div>
      </div>

      {isOffline && (
        <div className="bg-blue-50 border-l-4 border-blue-400 p-3 flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 text-blue-400 mt-0.5" />
          <p className="text-[10px] font-bold text-blue-700 uppercase tracking-wider">
            {t('report.offline')}
          </p>
        </div>
      )}

      {accuracy !== null && accuracy > 100 && (
        <div className="bg-amber-50 border-l-4 border-amber-400 p-3 flex items-start space-x-3 animate-pulse">
          <AlertCircle className="w-5 h-5 text-amber-400 mt-0.5" />
          <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">
            {t('report.lowAccuracy')}
          </p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4 flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 text-red-400 mt-0.5" />
          <p className="text-xs font-bold text-red-700 uppercase tracking-wider">{error}</p>
        </div>
      )}

      {step === 'camera' ? (
        <div className="relative aspect-[3/4] bg-black rounded-3xl overflow-hidden shadow-2xl border-4 border-gray-900">
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            className="w-full h-full object-cover opacity-80"
          />
          <canvas ref={canvasRef} width="640" height="480" className="hidden" />
          
          {/* Hardware Overlays */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-4 left-4 border-t-2 border-l-2 border-white/30 w-8 h-8" />
            <div className="absolute top-4 right-4 border-t-2 border-r-2 border-white/30 w-8 h-8" />
            <div className="absolute bottom-4 left-4 border-b-2 border-l-2 border-white/30 w-8 h-8" />
            <div className="absolute bottom-4 right-4 border-b-2 border-r-2 border-white/30 w-8 h-8" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-12 h-12 border border-white/20 rounded-full" />
            </div>
          </div>

          <button 
            onClick={capture}
            className="absolute bottom-8 left-1/2 -translate-x-1/2 w-20 h-20 bg-white rounded-full border-8 border-gray-900 flex items-center justify-center shadow-2xl active:scale-90 transition-transform"
          >
            <div className="w-12 h-12 bg-red-600 rounded-full flex items-center justify-center">
              <Camera className="w-6 h-6 text-white" />
            </div>
          </button>
        </div>
      ) : (
        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-300">
          <div className="grid grid-cols-2 gap-4">
            <div className="aspect-[3/4] rounded-2xl overflow-hidden shadow-lg border-2 border-gray-900">
              <img src={photo!} alt="Captured fault" className="w-full h-full object-cover" />
            </div>
            <div className="aspect-[3/4] rounded-2xl overflow-hidden shadow-lg border-2 border-gray-900 bg-gray-100 relative">
              {location && mapReady && (
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
                    position={Cartesian3.fromDegrees(location.lng, location.lat)}
                  >
                    <PointGraphics pixelSize={15} color={Color.RED} outlineColor={Color.WHITE} outlineWidth={2} />
                  </Entity>
                </Viewer>
              )}
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">AI_ANALYSIS</span>
              {loading && <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />}
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                Report Type
              </label>
              <div className="flex flex-wrap gap-2">
                {['Potholes', 'Water Leaks', 'Electrical Infrastructure Damage', 'Broken Streetlights', 'Illegal Dumping', 'Other'].map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setClassification(prev => prev ? { ...prev, category: cat } : null)}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider border-2 transition-all ${
                      classification?.category === cat 
                        ? 'bg-blue-600 text-white border-blue-600' 
                        : 'bg-white text-gray-400 border-gray-100 hover:border-gray-200'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                AI Detected Importance
              </label>
              <div className="p-4 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  {classification?.importance === 'Critical' && <ShieldAlert className="w-5 h-5 text-red-500" />}
                  {classification?.importance === 'High' && <AlertTriangle className="w-5 h-5 text-orange-500" />}
                  {classification?.importance === 'Medium' && <AlertCircle className="w-5 h-5 text-blue-500" />}
                  {classification?.importance === 'Low' && <Info className="w-5 h-5 text-gray-500" />}
                  <span className={`text-sm font-black uppercase tracking-widest ${
                    classification?.importance === 'Critical' ? 'text-red-600' :
                    classification?.importance === 'High' ? 'text-orange-600' :
                    classification?.importance === 'Medium' ? 'text-blue-600' :
                    'text-gray-600'
                  }`}>
                    {classification?.importance || 'Analyzing...'}
                  </span>
                </div>
                <span className="text-[8px] font-bold text-gray-400 uppercase tracking-tighter">Automatic Classification</span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                Detected Address
              </label>
              <div className="flex items-start gap-2 p-3 bg-gray-50 rounded-xl border border-gray-100">
                <MapPin className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                <p className="text-xs font-medium text-gray-700 leading-tight">
                  {address || "Locating..."}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="description" className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                Field Notes
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Enter additional details..."
                className="w-full p-4 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none min-h-[120px] resize-none font-medium"
              />
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <button 
              onClick={submitReport}
              disabled={loading || !classification}
              className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center space-x-3 active:scale-95"
            >
              {loading ? t('report.submitting') : t('report.submit')}
            </button>
            
            <button 
              onClick={() => setStep('camera')}
              className="w-full py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest hover:text-gray-600 transition-colors"
            >
              {t('report.retake')}
            </button>
          </div>
        </div>
      )}

      <div className="text-center text-[8px] font-black text-gray-300 uppercase tracking-[0.2em] pt-4">
        MuniLens • Secure Municipal Uplink
      </div>
    </div>
  );
}
