import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Report } from '../types';
import {
  Cartesian3,
  Color,
  VerticalOrigin,
  HorizontalOrigin,
  Math as CesiumMath,
  HeadingPitchRange,
  ConstantPositionProperty,
  CallbackProperty,
  NearFarScalar,
  Matrix4,
  ColorMaterialProperty,
} from 'cesium';
import { motion, AnimatePresence } from 'motion/react';
import { Crosshair, RotateCcw, Send, Radio, AlertTriangle, MapPin } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type DroneStatus = 'idle' | 'en-route' | 'verifying' | 'returning';

interface DroneState {
  lat: number;
  lng: number;
  altitude: number;
  heading: number;
  status: DroneStatus;
  targetReport: Report | null;
  battery: number;
  speed: number;
  missionTime: number;
  verifyProgress: number;
}

interface Props {
  reports: Report[];
  viewerRef: React.MutableRefObject<any>;
  mapReady: boolean;
  active: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SPEED_DEG_S = 60 / 111 / 3600; // ~60 km/h in deg/s
const TICK_MS = 100;
const CRUISE_ALT = 280;
const HOVER_ALT = 65;
const VERIFY_S = 14;

const STATUS_META: Record<DroneStatus, { label: string; color: string; dot: string }> = {
  idle:       { label: 'STANDBY',  color: 'text-gray-400', dot: 'bg-gray-400' },
  'en-route': { label: 'EN-ROUTE', color: 'text-blue-400', dot: 'bg-blue-400 animate-pulse' },
  verifying:  { label: 'VERIFYING', color: 'text-amber-400', dot: 'bg-amber-400 animate-pulse' },
  returning:  { label: 'RETURNING', color: 'text-green-400', dot: 'bg-green-400 animate-pulse' },
};

const IMPORTANCE_BG: Record<string, string> = {
  Critical: 'bg-red-900/50 text-red-300 border-red-700/40',
  High:     'bg-orange-900/50 text-orange-300 border-orange-700/40',
  Medium:   'bg-blue-900/50 text-blue-300 border-blue-700/40',
  Low:      'bg-gray-800/50 text-gray-400 border-gray-700/40',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildDroneCanvas(size = 96): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;
  const h = size / 2;

  ctx.save();
  ctx.translate(h, h);

  // Arms at 45° angles (X-pattern quadcopter)
  [45, 135, 225, 315].forEach(deg => {
    const rad = (deg * Math.PI) / 180;
    ctx.strokeStyle = '#1E3A8A';
    ctx.lineWidth = size * 0.075;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(Math.cos(rad) * size * 0.13, Math.sin(rad) * size * 0.13);
    ctx.lineTo(Math.cos(rad) * size * 0.4, Math.sin(rad) * size * 0.4);
    ctx.stroke();

    // Rotor disk
    const rx = Math.cos(rad) * size * 0.41;
    const ry = Math.sin(rad) * size * 0.41;
    ctx.fillStyle = 'rgba(147, 197, 253, 0.30)';
    ctx.beginPath();
    ctx.arc(rx, ry, size * 0.135, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#3B82F6';
    ctx.lineWidth = size * 0.022;
    ctx.stroke();
    // Motor hub
    ctx.fillStyle = '#1D4ED8';
    ctx.beginPath();
    ctx.arc(rx, ry, size * 0.038, 0, Math.PI * 2);
    ctx.fill();
  });

  // Body
  ctx.fillStyle = '#2563EB';
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.135, 0, Math.PI * 2);
  ctx.fill();
  // Camera/lens
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.065, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(147, 197, 253, 0.6)';
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.03, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
  return c;
}

function buildVerifyingDroneCanvas(size = 96): HTMLCanvasElement {
  // Amber tinted drone for verifying state
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;
  const h = size / 2;
  ctx.save();
  ctx.translate(h, h);
  [45, 135, 225, 315].forEach(deg => {
    const rad = (deg * Math.PI) / 180;
    ctx.strokeStyle = '#92400E';
    ctx.lineWidth = size * 0.075;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(Math.cos(rad) * size * 0.13, Math.sin(rad) * size * 0.13);
    ctx.lineTo(Math.cos(rad) * size * 0.4, Math.sin(rad) * size * 0.4);
    ctx.stroke();
    const rx = Math.cos(rad) * size * 0.41;
    const ry = Math.sin(rad) * size * 0.41;
    ctx.fillStyle = 'rgba(251, 191, 36, 0.28)';
    ctx.beginPath();
    ctx.arc(rx, ry, size * 0.135, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#F59E0B';
    ctx.lineWidth = size * 0.022;
    ctx.stroke();
    ctx.fillStyle = '#B45309';
    ctx.beginPath();
    ctx.arc(rx, ry, size * 0.038, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.fillStyle = '#D97706';
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.135, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.065, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(252, 211, 77, 0.6)';
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.03, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  return c;
}

function centroid(reports: Report[]) {
  if (!reports.length) return { lat: -26.2041, lng: 28.0473 };
  return {
    lat: reports.reduce((s, r) => s + r.latitude, 0) / reports.length,
    lng: reports.reduce((s, r) => s + r.longitude, 0) / reports.length,
  };
}

function topTarget(reports: Report[]): Report | null {
  const priority: Record<string, number> = { Critical: 4, High: 3, Medium: 2, Low: 1 };
  return (
    reports
      .filter(r => r.status !== 'Resolved')
      .sort((a, b) => (priority[b.importance ?? 'Low'] ?? 1) - (priority[a.importance ?? 'Low'] ?? 1))[0] ?? null
  );
}

function bearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dl = ((lng2 - lng1) * Math.PI) / 180;
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  return (
    ((Math.atan2(
      Math.sin(dl) * Math.cos(p2),
      Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl),
    ) *
      180) /
      Math.PI +
      360) %
    360
  );
}

function distDeg(lat1: number, lng1: number, lat2: number, lng2: number) {
  return Math.sqrt((lat2 - lat1) ** 2 + (lng2 - lng1) ** 2);
}

function fmtTime(s: number) {
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function DroneMapOverlay({ reports, viewerRef, mapReady, active }: Props) {
  const base = useMemo(() => centroid(reports), []); // eslint-disable-line react-hooks/exhaustive-deps

  const initDrone = (): DroneState => ({
    lat: base.lat, lng: base.lng, altitude: 5,
    heading: 0, status: 'idle', targetReport: null,
    battery: 100, speed: 0, missionTime: 0, verifyProgress: 0,
  });

  const [drone, setDrone] = useState<DroneState>(initDrone);
  const [following, setFollowing] = useState(true);

  const droneRef = useRef<DroneState>(drone);
  useEffect(() => { droneRef.current = drone; }, [drone]);

  const droneEntityRef = useRef<any>(null);
  const beamEntityRef  = useRef<any>(null);
  const pathEntityRef  = useRef<any>(null);
  const pathPointsRef  = useRef<Cartesian3[]>([]);
  const verifyTimer    = useRef(0);
  const animRef        = useRef<NodeJS.Timeout | null>(null);
  const normalCanvasRef    = useRef<HTMLCanvasElement | null>(null);
  const verifyingCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Build both drone canvas icons once
  useEffect(() => {
    normalCanvasRef.current    = buildDroneCanvas(96);
    verifyingCanvasRef.current = buildVerifyingDroneCanvas(96);
  }, []);

  // ── Cesium entity lifecycle ──────────────────────────────────────────────────
  useEffect(() => {
    const viewer = viewerRef.current?.cesiumElement;
    if (!viewer || !mapReady) return;

    if (!active) {
      [droneEntityRef, beamEntityRef, pathEntityRef].forEach(r => {
        if (r.current && !viewer.isDestroyed()) { viewer.entities.remove(r.current); r.current = null; }
      });
      pathPointsRef.current = [];
      try { viewer.camera.lookAtTransform(Matrix4.IDENTITY); } catch {}
      return;
    }

    const initPos = Cartesian3.fromDegrees(base.lng, base.lat, 5);

    // Drone billboard entity
    droneEntityRef.current = viewer.entities.add({
      position: new ConstantPositionProperty(initPos) as any,
      billboard: {
        image: normalCanvasRef.current ?? document.createElement('canvas'),
        width: 52,
        height: 52,
        verticalOrigin: VerticalOrigin.CENTER,
        horizontalOrigin: HorizontalOrigin.CENTER,
        rotation: new CallbackProperty(() => CesiumMath.toRadians(-droneRef.current.heading), false),
        scaleByDistance: new NearFarScalar(500, 1.6, 500000, 0.4),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        eyeOffset: new Cartesian3(0, 0, -10),
      },
      label: {
        text: new CallbackProperty(() => {
          const d = droneRef.current;
          return `  MuniLens-1    ${d.altitude.toFixed(0)}m  `;
        }, false) as any,
        font: 'bold 10px monospace',
        fillColor: Color.WHITE,
        outlineColor: Color.fromCssColorString('#0F172A'),
        outlineWidth: 3,
        style: 1, // FILL_AND_OUTLINE
        verticalOrigin: VerticalOrigin.BOTTOM,
        pixelOffset: { x: 0, y: -36 } as any,
        showBackground: true,
        backgroundColor: Color.fromCssColorString('#1E3A8A').withAlpha(0.9),
        backgroundPadding: { x: 8, y: 5 } as any,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    });

    // Scanning beam cylinder (amber cone from drone down to ground)
    beamEntityRef.current = viewer.entities.add({
      position: new ConstantPositionProperty(initPos) as any,
      cylinder: {
        length: new CallbackProperty(() => {
          const d = droneRef.current;
          return d.status === 'verifying' ? d.altitude : 1;
        }, false) as any,
        topRadius: 2,
        bottomRadius: new CallbackProperty(() => {
          return droneRef.current.status === 'verifying' ? 18 : 0.1;
        }, false) as any,
        material: new ColorMaterialProperty(
          new CallbackProperty(() => {
            return droneRef.current.status === 'verifying'
              ? Color.fromCssColorString('#FCD34D').withAlpha(0.10)
              : Color.TRANSPARENT;
          }, false) as any,
        ),
        outline: new CallbackProperty(() => droneRef.current.status === 'verifying', false) as any,
        outlineColor: Color.fromCssColorString('#FBBF24').withAlpha(0.35),
        outlineWidth: 1,
      },
    });

    // Trail polyline
    pathEntityRef.current = viewer.entities.add({
      polyline: {
        positions: new CallbackProperty(() => pathPointsRef.current, false) as any,
        width: 2,
        material: new ColorMaterialProperty(
          Color.fromCssColorString('#60A5FA').withAlpha(0.55),
        ),
        clampToGround: false,
      },
    });

    return () => {
      [droneEntityRef, beamEntityRef, pathEntityRef].forEach(r => {
        if (r.current && !viewer.isDestroyed()) { viewer.entities.remove(r.current); r.current = null; }
      });
      pathPointsRef.current = [];
      try { viewer.camera.lookAtTransform(Matrix4.IDENTITY); } catch {}
    };
  }, [active, mapReady]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Animation loop ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!active) { if (animRef.current) clearInterval(animRef.current); return; }

    animRef.current = setInterval(() => {
      const viewer = viewerRef.current?.cesiumElement;
      if (!viewer || viewer.isDestroyed()) return;

      const d = droneRef.current;

      if (d.status === 'idle') return;

      // Determine movement target
      let tLat: number, tLng: number, tAlt: number;
      if ((d.status === 'en-route' || d.status === 'verifying') && d.targetReport) {
        tLat = d.targetReport.latitude;
        tLng = d.targetReport.longitude;
        tAlt = d.status === 'verifying' ? HOVER_ALT : CRUISE_ALT;
      } else if (d.status === 'returning') {
        tLat = base.lat; tLng = base.lng; tAlt = CRUISE_ALT;
      } else return;

      // Verifying: don't move, just tick progress
      if (d.status === 'verifying') {
        verifyTimer.current += TICK_MS / 1000;
        const prog = Math.min(100, (verifyTimer.current / VERIFY_S) * 100);

        if (verifyTimer.current >= VERIFY_S) {
          verifyTimer.current = 0;
          setDrone(prev => ({ ...prev, status: 'returning', verifyProgress: 100, speed: 0 }));
          // Switch billboard back to normal
          if (droneEntityRef.current?.billboard) {
            droneEntityRef.current.billboard.image = normalCanvasRef.current;
          }
        } else {
          setDrone(prev => ({ ...prev, verifyProgress: prog }));
        }

        // Camera: slow orbit around target during verification
        if (following) {
          viewer.camera.lookAt(
            Cartesian3.fromDegrees(tLng, tLat, 0),
            new HeadingPitchRange(
              CesiumMath.toRadians(verifyTimer.current * 8),
              CesiumMath.toRadians(-48),
              HOVER_ALT * 4.5,
            ),
          );
        }
        return;
      }

      // Movement step
      const dist = distDeg(d.lat, d.lng, tLat, tLng);
      const step = SPEED_DEG_S * (TICK_MS / 1000);
      const hdg = bearing(d.lat, d.lng, tLat, tLng);

      let newLat = d.lat, newLng = d.lng, arrived = false;
      if (dist < step * 1.5) {
        newLat = tLat; newLng = tLng; arrived = true;
      } else {
        const ratio = step / dist;
        newLat = d.lat + (tLat - d.lat) * ratio;
        newLng = d.lng + (tLng - d.lng) * ratio;
      }

      // Altitude transition
      const altStep = 12;
      const newAlt = Math.abs(d.altitude - tAlt) < altStep ? tAlt : d.altitude + Math.sign(tAlt - d.altitude) * altStep;

      const newPos = Cartesian3.fromDegrees(newLng, newLat, newAlt);
      const beamPos = Cartesian3.fromDegrees(newLng, newLat, newAlt / 2);

      // Update Cesium entity positions
      if (droneEntityRef.current) {
        droneEntityRef.current.position = new ConstantPositionProperty(newPos) as any;
      }
      if (beamEntityRef.current) {
        beamEntityRef.current.position = new ConstantPositionProperty(beamPos) as any;
      }

      // Trail (keep last 70 points)
      pathPointsRef.current = [...pathPointsRef.current.slice(-70), newPos];

      // Status transitions
      let nextStatus: DroneStatus = d.status;
      if (arrived) {
        if (d.status === 'en-route') {
          nextStatus = 'verifying';
          verifyTimer.current = 0;
          // Switch billboard to amber verifying icon
          if (droneEntityRef.current?.billboard) {
            droneEntityRef.current.billboard.image = verifyingCanvasRef.current;
          }
        } else if (d.status === 'returning') {
          nextStatus = 'idle';
        }
      }

      const spd = arrived ? 0 : 60;
      const bat = Math.max(0, d.battery - (TICK_MS / 1000) / 720);
      const mt = d.missionTime + TICK_MS / 1000;

      setDrone(prev => ({
        ...prev,
        lat: newLat, lng: newLng, altitude: newAlt,
        heading: hdg, status: nextStatus,
        speed: spd, battery: bat, missionTime: mt,
      }));

      // Chase camera — behind and slightly above the drone
      if (following && nextStatus !== 'idle') {
        viewer.camera.lookAt(
          newPos,
          new HeadingPitchRange(
            CesiumMath.toRadians(hdg + 180),
            CesiumMath.toRadians(-20),
            600,
          ),
        );
      }
    }, TICK_MS);

    return () => { if (animRef.current) clearInterval(animRef.current); };
  }, [active, following, base]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Controls ─────────────────────────────────────────────────────────────────
  const dispatch = useCallback(() => {
    const target = topTarget(reports);
    if (!target) return;
    const viewer = viewerRef.current?.cesiumElement;

    pathPointsRef.current = [];
    verifyTimer.current = 0;

    const newDrone: DroneState = {
      lat: base.lat, lng: base.lng, altitude: 5,
      heading: bearing(base.lat, base.lng, target.latitude, target.longitude),
      status: 'en-route', targetReport: target,
      battery: 100, speed: 60, missionTime: 0, verifyProgress: 0,
    };
    setDrone(newDrone);

    if (droneEntityRef.current?.billboard) {
      droneEntityRef.current.billboard.image = normalCanvasRef.current;
    }

    if (viewer) {
      viewer.camera.flyTo({
        destination: Cartesian3.fromDegrees(base.lng, base.lat, 2500),
        duration: 1.5,
      });
    }
  }, [reports, base, viewerRef]);

  const recall = useCallback(() => {
    if (drone.status === 'idle') return;
    setDrone(prev => ({ ...prev, status: 'returning', verifyProgress: 0 }));
    if (droneEntityRef.current?.billboard) {
      droneEntityRef.current.billboard.image = normalCanvasRef.current;
    }
    verifyTimer.current = 0;
  }, [drone.status]);

  const toggleFollow = useCallback(() => {
    setFollowing(f => {
      if (f) {
        const viewer = viewerRef.current?.cesiumElement;
        try { viewer?.camera.lookAtTransform(Matrix4.IDENTITY); } catch {}
      }
      return !f;
    });
  }, [viewerRef]);

  if (!active) return null;

  const meta = STATUS_META[drone.status];
  const isFlying = drone.status !== 'idle';
  const target = drone.targetReport;

  return (
    <>
      {/* ── Status Bar (top-centre) ───────────────────────────────────────── */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[400] flex items-center gap-3 bg-gray-950/88 backdrop-blur-md px-5 py-2.5 rounded-2xl shadow-2xl border border-white/10 pointer-events-none">
        <Radio className={`w-3 h-3 ${meta.color} ${isFlying ? 'animate-pulse' : ''}`} />
        <div className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
        <span className="text-[8px] font-black text-gray-500 uppercase tracking-widest">DRONE OPS</span>
        <span className="text-[8px] text-gray-700">|</span>
        <span className={`text-[9px] font-black uppercase tracking-widest ${meta.color}`}>{meta.label}</span>
        {target && isFlying && (
          <>
            <span className="text-[8px] text-gray-700">|</span>
            <AlertTriangle className={`w-3 h-3 ${target.importance === 'Critical' ? 'text-red-400' : 'text-orange-400'}`} />
            <span className="text-[9px] font-bold text-gray-200 truncate max-w-[140px]">{target.type}</span>
          </>
        )}
      </div>

      {/* ── Telemetry Panel (bottom-left) ──────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, x: -16 }}
        animate={{ opacity: 1, x: 0 }}
        className="absolute bottom-28 left-6 z-[400] bg-gray-950/88 backdrop-blur-md rounded-2xl border border-white/10 shadow-2xl overflow-hidden w-52"
      >
        <div className="px-4 py-2.5 border-b border-white/5 flex items-center justify-between">
          <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest">Telemetry</p>
          <span className={`text-[7px] font-black ${meta.color} uppercase tracking-wider`}>{meta.label}</span>
        </div>
        <div className="px-4 py-3 grid grid-cols-2 gap-x-4 gap-y-2.5">
          {[
            { label: 'ALTITUDE', value: `${drone.altitude.toFixed(0)} m` },
            { label: 'SPEED', value: `${drone.speed} km/h` },
            { label: 'HEADING', value: `${drone.heading.toFixed(0)}°` },
            { label: 'MISSION', value: fmtTime(drone.missionTime) },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-[7px] font-black text-gray-600 uppercase tracking-widest">{label}</p>
              <p className="text-[11px] font-black font-mono text-white leading-tight">{value}</p>
            </div>
          ))}
        </div>

        {/* Battery */}
        <div className="px-4 pb-1">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[7px] font-black text-gray-600 uppercase tracking-widest">BATTERY</p>
            <p className={`text-[9px] font-black font-mono ${drone.battery < 20 ? 'text-red-400' : 'text-white'}`}>
              {drone.battery.toFixed(0)}%
            </p>
          </div>
          <div className="h-1 bg-white/10 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                drone.battery > 50 ? 'bg-green-400' : drone.battery > 20 ? 'bg-amber-400' : 'bg-red-400'
              }`}
              style={{ width: `${drone.battery}%` }}
            />
          </div>
        </div>

        {/* Verify progress */}
        {drone.status === 'verifying' && (
          <div className="px-4 pb-3 mt-2">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[7px] font-black text-amber-400 uppercase tracking-widest">SCAN PROGRESS</p>
              <p className="text-[9px] font-black font-mono text-amber-400">{drone.verifyProgress.toFixed(0)}%</p>
            </div>
            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-amber-400 rounded-full"
                animate={{ width: `${drone.verifyProgress}%` }}
                transition={{ duration: 0.1 }}
              />
            </div>
          </div>
        )}

        {/* Lat/Lng */}
        <div className="px-4 pb-3 mt-1">
          <p className="text-[7px] font-black text-gray-600 uppercase tracking-widest mb-0.5">POSITION</p>
          <p className="text-[9px] font-mono text-gray-400 leading-tight">
            {drone.lat.toFixed(5)}, {drone.lng.toFixed(5)}
          </p>
        </div>
      </motion.div>

      {/* ── Drone Controls (top-right of map) ──────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, x: 16 }}
        animate={{ opacity: 1, x: 0 }}
        className="absolute top-4 right-4 z-[400] flex flex-col gap-2"
      >
        <button
          onClick={dispatch}
          disabled={drone.status === 'en-route' || drone.status === 'verifying'}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all shadow-lg border ${
            drone.status === 'idle' || drone.status === 'returning'
              ? 'bg-blue-600 text-white border-blue-500 hover:bg-blue-700 active:scale-95'
              : 'bg-gray-900 text-gray-600 border-gray-800 cursor-not-allowed'
          }`}
        >
          <Send className="w-3.5 h-3.5" />
          Dispatch
        </button>
        <button
          onClick={recall}
          disabled={!isFlying}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all shadow-lg border ${
            isFlying
              ? 'bg-gray-800 text-white border-gray-600 hover:bg-gray-700 active:scale-95'
              : 'bg-gray-900 text-gray-600 border-gray-800 cursor-not-allowed'
          }`}
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Recall
        </button>
        <button
          onClick={toggleFollow}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all shadow-lg border ${
            following
              ? 'bg-amber-500 text-white border-amber-400 hover:bg-amber-600 active:scale-95'
              : 'bg-gray-800 text-gray-300 border-gray-600 hover:bg-gray-700 active:scale-95'
          }`}
        >
          <Crosshair className="w-3.5 h-3.5" />
          {following ? 'Following' : 'Free Cam'}
        </button>
      </motion.div>

      {/* ── Target Info Panel (bottom-right of map) ────────────────────────── */}
      <AnimatePresence>
        {target && isFlying && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            className="absolute bottom-28 right-28 z-[400] bg-gray-950/88 backdrop-blur-md rounded-2xl border border-white/10 shadow-2xl p-4 w-56"
          >
            <div className="flex items-center gap-2 mb-2">
              <MapPin className="w-3 h-3 text-blue-400 flex-shrink-0" />
              <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest">Dispatch Target</p>
            </div>
            <p className="text-sm font-black text-white italic font-serif mb-2 leading-tight">{target.type}</p>
            <div className="flex gap-1.5 mb-2 flex-wrap">
              <span className={`px-2 py-0.5 rounded-lg text-[7px] font-black uppercase tracking-wider border ${IMPORTANCE_BG[target.importance ?? 'Medium'] ?? IMPORTANCE_BG.Medium}`}>
                {target.importance}
              </span>
              <span className={`px-2 py-0.5 rounded-lg text-[7px] font-black uppercase tracking-wider border ${
                target.status === 'Open'
                  ? 'bg-amber-900/50 text-amber-300 border-amber-700/40'
                  : 'bg-blue-900/50 text-blue-300 border-blue-700/40'
              }`}>
                {target.status}
              </span>
            </div>
            {target.address && (
              <p className="text-[9px] font-mono text-gray-400 truncate">{target.address}</p>
            )}
            <div className="mt-2 pt-2 border-t border-white/5">
              <p className="text-[8px] font-mono text-gray-600">
                {target.latitude.toFixed(5)}, {target.longitude.toFixed(5)}
              </p>
            </div>

            {/* Verification progress ring */}
            {drone.status === 'verifying' && (
              <div className="mt-3 flex items-center gap-3">
                <div className="relative w-8 h-8 flex-shrink-0">
                  <svg viewBox="0 0 32 32" className="w-8 h-8 -rotate-90">
                    <circle cx="16" cy="16" r="12" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="3" />
                    <circle
                      cx="16" cy="16" r="12" fill="none"
                      stroke="#FBBF24" strokeWidth="3"
                      strokeDasharray={`${(drone.verifyProgress / 100) * 75.4} 75.4`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-[7px] font-black text-amber-400">
                    {drone.verifyProgress.toFixed(0)}
                  </span>
                </div>
                <div>
                  <p className="text-[8px] font-black text-amber-400 uppercase tracking-widest">Scanning</p>
                  <p className="text-[9px] text-gray-400">Verification in progress</p>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
