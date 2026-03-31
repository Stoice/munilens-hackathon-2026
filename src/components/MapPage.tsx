import React, { useState, useEffect, useRef, useMemo } from 'react';
import { db } from '../firebase';
import { collection, query, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { Report } from '../types';
import {
  Navigation, Layers, LocateFixed, Plus, Minus,
  ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Globe, Map as MapFlatIcon,
} from 'lucide-react';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';
import { useLanguage } from '../i18n/LanguageContext';
import { Viewer, Entity, PointGraphics, EntityDescription, ImageryLayer, BillboardGraphics } from 'resium';
import { Cartesian3, Color, createWorldImageryAsync, IonWorldImageryStyle, VerticalOrigin } from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { toast } from 'sonner';

// ── Importance colour helper ─────────────────────────────────────────────────
const IMPORTANCE_HEX: Record<string, string> = {
  Critical: '#EF4444',
  High:     '#F59E0B',
  Medium:   '#3B82F6',
  Low:      '#6B7280',
};

const getImportanceColor = (importance: string) => {
  switch (importance) {
    case 'Critical': return 'bg-red-100 text-red-700 border border-red-200';
    case 'High':     return 'bg-orange-100 text-orange-700 border border-orange-200';
    case 'Medium':   return 'bg-blue-100 text-blue-700 border border-blue-200';
    case 'Low':      return 'bg-gray-100 text-gray-700 border border-gray-200';
    default:         return 'bg-blue-100 text-blue-700 border border-blue-200';
  }
};

// ── Cluster helpers ──────────────────────────────────────────────────────────
const CLUSTER_GRID = 0.03;
const CLUSTER_IMPORTANCE_RANK: Record<string, number> = { Critical: 4, High: 3, Medium: 2, Low: 1 };
const CLUSTER_COLORS: Record<string, { fill: string; ring: string }> = {
  Critical: { fill: '#EF4444', ring: 'rgba(239,68,68,0.22)' },
  High:     { fill: '#F59E0B', ring: 'rgba(245,158,11,0.22)' },
  Medium:   { fill: '#3B82F6', ring: 'rgba(59,130,246,0.22)' },
  Low:      { fill: '#6B7280', ring: 'rgba(107,114,128,0.22)' },
};

function buildClusterCanvas(count: number, importance: string): HTMLCanvasElement {
  const size = Math.min(88, Math.max(44, 38 + count * 2.5));
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const ctx = c.getContext('2d')!;
  const h = size / 2;
  const col = CLUSTER_COLORS[importance] ?? CLUSTER_COLORS.Medium;
  ctx.beginPath();
  ctx.arc(h, h, h - 1, 0, Math.PI * 2);
  ctx.fillStyle = col.ring;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(h, h, h * 0.68, 0, Math.PI * 2);
  ctx.fillStyle = col.fill;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(h, h, h * 0.68, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.65)';
  ctx.lineWidth = size * 0.045;
  ctx.stroke();
  const label = count > 99 ? '99+' : String(count);
  ctx.fillStyle = '#ffffff';
  ctx.font = `900 ${Math.round(size * 0.3)}px system-ui,sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, h, h);
  return c;
}

function computeClusters(reps: Report[]) {
  const cells: Record<string, Report[]> = {};
  reps.forEach(r => {
    const key = `${Math.floor(r.latitude / CLUSTER_GRID)},${Math.floor(r.longitude / CLUSTER_GRID)}`;
    if (!cells[key]) cells[key] = [];
    cells[key].push(r);
  });
  return Object.values(cells).map(group => {
    const lat = group.reduce((s, r) => s + r.latitude, 0) / group.length;
    const lng = group.reduce((s, r) => s + r.longitude, 0) / group.length;
    const topImportance = group.reduce((best, r) => {
      const rank = CLUSTER_IMPORTANCE_RANK[r.importance ?? 'Low'] ?? 1;
      return rank > (CLUSTER_IMPORTANCE_RANK[best] ?? 0) ? (r.importance ?? 'Low') : best;
    }, 'Low' as string);
    const open = group.filter(r => r.status !== 'Resolved').length;
    const size = Math.min(88, Math.max(44, 38 + group.length * 2.5));
    return { lat, lng, count: group.length, topImportance, open, size };
  });
}

// ── Leaflet locate helper ───────────────────────────────────────────────────
function LeafletLocateControl({ trigger }: { trigger: number }) {
  const map = useMap();
  useEffect(() => {
    if (trigger === 0) return;
    map.locate({ setView: true, maxZoom: 16 });
  }, [trigger, map]);
  return null;
}

// ── Component ────────────────────────────────────────────────────────────────
export default function MapPage() {
  const { t } = useLanguage();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  const [dimension, setDimension] = useState<'2d' | '3d'>('2d');
  const [mapView, setMapView]     = useState<'reports' | 'aggregate'>('reports');
  const [mapFilters, setMapFilters] = useState<string[]>([]);
  const [isSatellite, setIsSatellite] = useState(false);
  const [satelliteProvider, setSatelliteProvider] = useState<any>(null);
  const [cesiumReady, setCesiumReady] = useState(false);
  const [locateTrigger, setLocateTrigger] = useState(0);
  const viewerRef = useRef<any>(null);

  const toggleMapFilter = (f: string) =>
    setMapFilters(prev => prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f]);

  // Load reports
  useEffect(() => {
    const path = 'reports';
    const q = query(collection(db, path), orderBy('reportedAt', 'desc'), limit(100));
    const unsub = onSnapshot(q, snap => {
      setReports(snap.docs.map(d => ({ id: d.id, ...d.data() } as Report)));
      setLoading(false);
    }, err => handleFirestoreError(err, OperationType.LIST, path));
    return () => unsub();
  }, []);

  // Satellite provider
  useEffect(() => {
    createWorldImageryAsync({ style: IonWorldImageryStyle.AERIAL }).then(setSatelliteProvider);
  }, []);

  // Delay Cesium mount (only in 3D mode)
  useEffect(() => {
    if (dimension !== '3d') { setCesiumReady(false); return; }
    const t = setTimeout(() => setCesiumReady(true), 120);
    return () => clearTimeout(t);
  }, [dimension]);

  // Filtered reports
  const mapFilteredReports = useMemo(() => {
    if (mapFilters.length === 0) return reports;
    const statusSet  = mapFilters.filter(f => ['In Progress', 'Resolved'].includes(f));
    const importanceSet = mapFilters.filter(f => ['Critical'].includes(f));
    return reports.filter(r => {
      const statusOk     = statusSet.length === 0     || statusSet.includes(r.status);
      const importanceOk = importanceSet.length === 0 || importanceSet.includes(r.importance ?? '');
      return statusOk && importanceOk;
    });
  }, [reports, mapFilters]);

  // Camera helpers (3D)
  const centerOnUser3D = () => {
    if (!navigator.geolocation) { toast.error('Geolocation not supported'); return; }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        viewerRef.current?.cesiumElement?.camera.flyTo({
          destination: Cartesian3.fromDegrees(coords.longitude, coords.latitude, 1000),
        });
      },
      () => toast.error('Could not get your location. Check permissions.'),
    );
  };
  const zoomIn    = () => { const cam = viewerRef.current?.cesiumElement?.camera; if (cam) cam.zoomIn(cam.positionCartographic.height * 0.2); };
  const zoomOut   = () => { const cam = viewerRef.current?.cesiumElement?.camera; if (cam) cam.zoomOut(cam.positionCartographic.height * 0.2); };
  const moveUp    = () => { const cam = viewerRef.current?.cesiumElement?.camera; if (cam) cam.moveUp(cam.positionCartographic.height * 0.1); };
  const moveDown  = () => { const cam = viewerRef.current?.cesiumElement?.camera; if (cam) cam.moveDown(cam.positionCartographic.height * 0.1); };
  const moveLeft  = () => { const cam = viewerRef.current?.cesiumElement?.camera; if (cam) cam.moveLeft(cam.positionCartographic.height * 0.1); };
  const moveRight = () => { const cam = viewerRef.current?.cesiumElement?.camera; if (cam) cam.moveRight(cam.positionCartographic.height * 0.1); };

  // Default centre for Leaflet (average of all reports, or SA centroid)
  const leafletCenter = useMemo((): [number, number] => {
    if (reports.length === 0) return [-28.7, 24.7];
    const lat = reports.reduce((s, r) => s + r.latitude,  0) / reports.length;
    const lng = reports.reduce((s, r) => s + r.longitude, 0) / reports.length;
    return [lat, lng];
  }, [reports]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-64px)]">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const tileUrl = isSatellite
    ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
    : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
  const tileAttribution = isSatellite
    ? '&copy; Esri World Imagery'
    : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
  const clusters = computeClusters(mapFilteredReports);

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] gap-4 p-6">
      {/* ── Control bar ──────────────────────────────────────────────────── */}
      <div className="bg-white/60 backdrop-blur-md px-5 py-3.5 rounded-3xl shadow-sm border border-white/30 flex flex-wrap items-center gap-4">
        {/* Dimension toggle */}
        <div className="flex items-center bg-gray-900/90 rounded-xl p-0.5 gap-0.5 flex-shrink-0">
          {(['2d', '3d'] as const).map(d => (
            <button
              key={d}
              onClick={() => setDimension(d)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                dimension === d ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              {d === '2d' ? <MapFlatIcon className="w-3.5 h-3.5" /> : <Globe className="w-3.5 h-3.5" />}
              {d === '2d' ? t('map.2d') : t('map.3d')}
            </button>
          ))}
        </div>

        {/* View toggle: reports / aggregate */}
        <div className="flex items-center bg-gray-100/80 rounded-xl p-0.5 gap-0.5 flex-shrink-0">
          {(['reports', 'aggregate'] as const).map(v => (
            <button
              key={v}
              onClick={() => setMapView(v)}
              className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                mapView === v ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {v === 'reports' ? t('map.reports') : t('map.aggregate')}
            </button>
          ))}
        </div>

        {/* Universal filter chips */}
        <div className="flex items-center gap-2 flex-1 flex-wrap">
          <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest flex-shrink-0">{t('map.filters')}</span>
          {[
            { label: 'In Progress', display: t('map.inProgress'), active: 'bg-amber-500 text-white border-amber-500', inactive: 'bg-white text-amber-600 border-amber-200 hover:border-amber-400' },
            { label: 'Resolved',    display: t('map.resolved'),    active: 'bg-green-500 text-white border-green-500', inactive: 'bg-white text-green-600 border-green-200 hover:border-green-400' },
            { label: 'Critical',    display: t('map.critical'),    active: 'bg-red-500   text-white border-red-500',   inactive: 'bg-white text-red-500   border-red-200   hover:border-red-400' },
          ].map(({ label, display, active, inactive }) => (
            <button
              key={label}
              onClick={() => toggleMapFilter(label)}
              className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border transition-all ${
                mapFilters.includes(label) ? active : inactive
              }`}
            >
              {display}
            </button>
          ))}
          {mapFilters.length > 0 && (
            <button
              onClick={() => setMapFilters([])}
              className="text-[9px] font-bold text-gray-400 hover:text-gray-600 transition-colors ml-1"
            >
              {t('map.clear')}
            </button>
          )}
          <span className="text-[9px] font-mono text-gray-400 ml-auto">
            {mapFilteredReports.length} {mapFilteredReports.length !== 1 ? t('map.results') : t('map.result')}
          </span>
        </div>

        {/* Map controls */}
        <div className="flex gap-2">
          <button
            onClick={() => setIsSatellite(!isSatellite)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border-2 ${
              isSatellite ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-100 hover:border-gray-200'
            }`}
          >
            <Layers className="w-4 h-4" />
            {isSatellite ? t('map.satellite') : t('map.street')}
          </button>
          <button
            onClick={() => dimension === '2d' ? setLocateTrigger(n => n + 1) : centerOnUser3D()}
            className="flex items-center gap-2 px-4 py-2 bg-white text-gray-600 border-2 border-gray-100 rounded-xl text-[10px] font-black uppercase tracking-wider hover:border-gray-200 transition-all"
          >
            <LocateFixed className="w-4 h-4" />
            {t('map.locate')}
          </button>
        </div>
      </div>

      {/* ── Map container ────────────────────────────────────────────────── */}
      <div className="flex-1 bg-white/60 backdrop-blur-md rounded-3xl shadow-sm border border-white/30 overflow-hidden relative">

        {/* Overlay label + legend */}
        <div className="absolute top-4 left-4 z-[400] flex items-center gap-2 flex-wrap pointer-events-none">
          <div className="bg-white/90 backdrop-blur px-3 py-1.5 rounded-xl shadow-lg border border-gray-100 flex items-center gap-2">
            <Navigation className="w-3.5 h-3.5 text-blue-600" />
            <span className="text-[10px] font-black text-gray-900 uppercase tracking-widest">
              {dimension.toUpperCase()} · {mapView === 'reports' ? t('map.liveFaultMap') : t('map.aggregateView')}
            </span>
          </div>
          {mapView === 'aggregate' && (
            <div className="bg-white/90 backdrop-blur px-3 py-1.5 rounded-xl shadow-lg border border-gray-100 flex items-center gap-3">
              {[
                { color: 'bg-red-500',   label: t('map.critical') },
                { color: 'bg-amber-400', label: t('map.high') },
                { color: 'bg-blue-500',  label: t('map.medium') },
                { color: 'bg-gray-400',  label: t('map.low') },
              ].map(({ color, label }) => (
                <span key={label} className="flex items-center gap-1 text-[9px] font-bold text-gray-500">
                  <span className={`w-2 h-2 rounded-full ${color}`} />{label}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* 3D pan/zoom controls */}
        {dimension === '3d' && (
          <div className="absolute bottom-6 right-6 z-[400] flex flex-col gap-3 items-end">
            <div className="bg-white/90 backdrop-blur p-1 rounded-full shadow-xl border border-gray-100 flex flex-col gap-0.5">
              <button onClick={zoomIn}  className="p-2.5 hover:bg-blue-50 hover:text-blue-600 rounded-full transition-all text-gray-600 group">
                <Plus  className="w-3.5 h-3.5 group-active:scale-90 transition-transform" />
              </button>
              <div className="h-px bg-gray-100 mx-2" />
              <button onClick={zoomOut} className="p-2.5 hover:bg-blue-50 hover:text-blue-600 rounded-full transition-all text-gray-600 group">
                <Minus className="w-3.5 h-3.5 group-active:scale-90 transition-transform" />
              </button>
            </div>
            <div className="bg-white/90 backdrop-blur p-1.5 rounded-2xl shadow-xl border border-gray-100 grid grid-cols-3 gap-0.5">
              <div />
              <button onClick={moveUp}    className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors text-gray-500"><ArrowUp    className="w-3.5 h-3.5" /></button>
              <div />
              <button onClick={moveLeft}  className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors text-gray-500"><ArrowLeft  className="w-3.5 h-3.5" /></button>
              <div className="flex items-center justify-center"><div className="w-1 h-1 bg-gray-300 rounded-full" /></div>
              <button onClick={moveRight} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors text-gray-500"><ArrowRight className="w-3.5 h-3.5" /></button>
              <div />
              <button onClick={moveDown}  className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors text-gray-500"><ArrowDown  className="w-3.5 h-3.5" /></button>
              <div />
            </div>
          </div>
        )}

        {/* ── 2D Leaflet ──────────────────────────────────────────────────── */}
        {dimension === '2d' && (
          <MapContainer
            key="leaflet"
            center={leafletCenter}
            zoom={10}
            style={{ height: '100%', width: '100%' }}
            zoomControl={false}
          >
            <TileLayer url={tileUrl} attribution={tileAttribution} />
            <LeafletLocateControl trigger={locateTrigger} />

            {mapView === 'reports' ? (
              mapFilteredReports.map(report => (
                <CircleMarker
                  key={report.id}
                  center={[report.latitude, report.longitude]}
                  radius={report.importance === 'Critical' ? 10 : report.importance === 'High' ? 8 : 7}
                  pathOptions={{
                    color: 'white',
                    weight: 2,
                    fillColor: IMPORTANCE_HEX[report.importance ?? 'Medium'] ?? IMPORTANCE_HEX.Medium,
                    fillOpacity: 0.9,
                  }}
                >
                  <Popup maxWidth={290}>
                    <div style={{ minWidth: '250px', fontFamily: 'system-ui, sans-serif' }}>
                      {report.photoUrl && (
                        <img
                          src={report.photoUrl}
                          alt={report.type}
                          style={{ width: '100%', height: '130px', objectFit: 'cover', borderRadius: '8px', marginBottom: '10px', display: 'block' }}
                        />
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <p style={{ fontWeight: 900, fontSize: '13px', margin: 0 }}>{report.type}</p>
                        <span style={{
                          padding: '2px 8px', borderRadius: '99px', fontSize: '10px', fontWeight: 900,
                          background: report.status === 'Open' ? '#fee2e2' : report.status === 'In Progress' ? '#fef3c7' : '#dcfce7',
                          color: report.status === 'Open' ? '#b91c1c' : report.status === 'In Progress' ? '#b45309' : '#15803d',
                        }}>{report.status}</span>
                      </div>
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '8px' }}>
                        <span style={{
                          padding: '2px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 900,
                          background: report.importance === 'Critical' ? '#fee2e2' : report.importance === 'High' ? '#ffedd5' : report.importance === 'Medium' ? '#dbeafe' : '#f3f4f6',
                          color: report.importance === 'Critical' ? '#b91c1c' : report.importance === 'High' ? '#c2410c' : report.importance === 'Medium' ? '#1d4ed8' : '#374151',
                        }}>{report.importance || 'Medium'}</span>
                        {report.routedTo && (
                          <span style={{ padding: '2px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 700, background: '#f0fdf4', color: '#166534' }}>
                            {report.routedTo}
                          </span>
                        )}
                      </div>
                      {report.description && (
                        <p style={{ fontSize: '11px', color: '#6b7280', lineHeight: 1.5, marginBottom: '8px', margin: '0 0 8px 0' }}>
                          {report.description}
                        </p>
                      )}
                      {report.estimatedSolution && (
                        <p style={{ fontSize: '10px', color: '#3b82f6', fontWeight: 700, marginBottom: '8px' }}>
                          ⏱ {report.estimatedSolution}
                        </p>
                      )}
                      <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: '6px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        {report.address && (
                          <p style={{ fontSize: '10px', color: '#9ca3af', margin: 0 }}>📍 {report.address}</p>
                        )}
                        {report.reporterName && (
                          <p style={{ fontSize: '10px', color: '#9ca3af', margin: 0 }}>👤 {report.reporterName}</p>
                        )}
                        <p style={{ fontSize: '10px', color: '#9ca3af', margin: 0 }}>
                          🕒 {new Date(report.reportedAt).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                      </div>
                    </div>
                  </Popup>
                </CircleMarker>
              ))
            ) : (
              clusters.map((cluster, i) => (
                <CircleMarker
                  key={`cl-${i}`}
                  center={[cluster.lat, cluster.lng]}
                  radius={Math.max(18, Math.min(42, cluster.size * 0.4))}
                  pathOptions={{
                    color: 'rgba(255,255,255,0.8)',
                    weight: 3,
                    fillColor: IMPORTANCE_HEX[cluster.topImportance] ?? IMPORTANCE_HEX.Medium,
                    fillOpacity: 0.85,
                  }}
                >
                  <Popup>
                    <div style={{ minWidth: '150px' }}>
                      <p style={{ fontWeight: 900, marginBottom: '4px' }}>{cluster.count} reports in area</p>
                      <p style={{ fontSize: '11px', color: '#6b7280', marginBottom: '2px' }}>Highest priority: <strong>{cluster.topImportance}</strong></p>
                      <p style={{ fontSize: '11px', color: '#6b7280', marginBottom: '2px' }}>{cluster.open} unresolved · {cluster.count - cluster.open} resolved</p>
                      <p style={{ fontSize: '10px', color: '#9ca3af', fontFamily: 'monospace' }}>{cluster.lat.toFixed(4)}, {cluster.lng.toFixed(4)}</p>
                    </div>
                  </Popup>
                </CircleMarker>
              ))
            )}
          </MapContainer>
        )}

        {/* ── 3D Cesium globe ─────────────────────────────────────────────── */}
        {dimension === '3d' && cesiumReady && (
          <Viewer
            key={mapView}
            ref={viewerRef}
            timeline={false}
            animation={false}
            baseLayerPicker={false}
            geocoder={false}
            homeButton={false}
            infoBox={true}
            selectionIndicator={true}
            navigationHelpButton={false}
            sceneModePicker={false}
            style={{ height: '100%', width: '100%' }}
          >
            {isSatellite && satelliteProvider && (
              <ImageryLayer imageryProvider={satelliteProvider} />
            )}
            {mapView === 'reports' ? (
              mapFilteredReports.map(report => (
                <Entity
                  key={report.id}
                  position={Cartesian3.fromDegrees(report.longitude, report.latitude)}
                  name={report.type}
                >
                  <PointGraphics
                    pixelSize={report.importance === 'Critical' ? 16 : report.importance === 'High' ? 14 : 12}
                    color={
                      report.importance === 'Critical' ? Color.RED    :
                      report.importance === 'High'     ? Color.ORANGE :
                      report.importance === 'Medium'   ? Color.BLUE   :
                      Color.GRAY
                    }
                    outlineColor={Color.WHITE}
                    outlineWidth={2}
                  />
                  <EntityDescription>
                    <div style={{ padding: '12px', minWidth: '220px', fontFamily: 'system-ui, sans-serif', background: 'white', borderRadius: '10px', color: '#111' }}>
                      {report.photoUrl && (
                        <img
                          src={report.photoUrl}
                          alt={report.type}
                          style={{ width: '100%', height: '120px', objectFit: 'cover', borderRadius: '8px', marginBottom: '10px', display: 'block' }}
                        />
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <strong style={{ fontSize: '13px' }}>{report.type}</strong>
                        <span style={{
                          padding: '2px 8px', borderRadius: '99px', fontSize: '10px', fontWeight: 900,
                          background: report.status === 'Open' ? '#fee2e2' : report.status === 'In Progress' ? '#fef3c7' : '#dcfce7',
                          color: report.status === 'Open' ? '#b91c1c' : report.status === 'In Progress' ? '#b45309' : '#15803d',
                        }}>{report.status}</span>
                      </div>
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '8px' }}>
                        <span style={{
                          padding: '2px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 900,
                          background: report.importance === 'Critical' ? '#fee2e2' : report.importance === 'High' ? '#ffedd5' : report.importance === 'Medium' ? '#dbeafe' : '#f3f4f6',
                          color: report.importance === 'Critical' ? '#b91c1c' : report.importance === 'High' ? '#c2410c' : report.importance === 'Medium' ? '#1d4ed8' : '#374151',
                        }}>{report.importance || 'Medium'}</span>
                        {report.routedTo && (
                          <span style={{ padding: '2px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 700, background: '#f0fdf4', color: '#166534' }}>
                            {report.routedTo}
                          </span>
                        )}
                      </div>
                      {report.description && (
                        <p style={{ fontSize: '11px', color: '#6b7280', lineHeight: 1.5, margin: '0 0 8px 0' }}>{report.description}</p>
                      )}
                      {report.estimatedSolution && (
                        <p style={{ fontSize: '10px', color: '#3b82f6', fontWeight: 700, margin: '0 0 8px 0' }}>⏱ {report.estimatedSolution}</p>
                      )}
                      <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: '6px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        {report.address && (
                          <p style={{ fontSize: '10px', color: '#9ca3af', margin: 0 }}>📍 {report.address}</p>
                        )}
                        {report.reporterName && (
                          <p style={{ fontSize: '10px', color: '#9ca3af', margin: 0 }}>👤 {report.reporterName}</p>
                        )}
                        <p style={{ fontSize: '10px', color: '#9ca3af', margin: 0 }}>
                          🕒 {new Date(report.reportedAt).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                      </div>
                    </div>
                  </EntityDescription>
                </Entity>
              ))
            ) : (
              clusters.map((cluster, i) => (
                <Entity
                  key={`cluster-${i}`}
                  position={Cartesian3.fromDegrees(cluster.lng, cluster.lat, 0)}
                  name={`${cluster.count} report${cluster.count !== 1 ? 's' : ''} · ${cluster.topImportance}`}
                >
                  <BillboardGraphics
                    image={buildClusterCanvas(cluster.count, cluster.topImportance)}
                    verticalOrigin={VerticalOrigin.CENTER}
                    disableDepthTestDistance={Number.POSITIVE_INFINITY}
                    width={cluster.size}
                    height={cluster.size}
                  />
                  <EntityDescription>
                    <div style={{ padding: '10px', minWidth: '170px', background: 'white', color: '#111', borderRadius: '10px', fontFamily: 'system-ui' }}>
                      <p style={{ fontWeight: 900, fontSize: '13px', marginBottom: '6px' }}>{cluster.count} report{cluster.count !== 1 ? 's' : ''} in area</p>
                      <p style={{ fontSize: '10px', color: '#555', marginBottom: '3px' }}>Highest priority: <strong>{cluster.topImportance}</strong></p>
                      <p style={{ fontSize: '10px', color: '#555', marginBottom: '3px' }}>{cluster.open} unresolved · {cluster.count - cluster.open} resolved</p>
                      <p style={{ fontSize: '10px', color: '#999', marginTop: '4px', fontFamily: 'monospace' }}>{cluster.lat.toFixed(4)}, {cluster.lng.toFixed(4)}</p>
                    </div>
                  </EntityDescription>
                </Entity>
              ))
            )}
          </Viewer>
        )}

        {/* 3D loading placeholder */}
        {dimension === '3d' && !cesiumReady && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>
    </div>
  );
}
