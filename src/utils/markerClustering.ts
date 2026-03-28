import { Report } from '../types';

export interface MarkerCluster {
  latitude: number;
  longitude: number;
  reports: Report[];
  count: number;
  isCluster: boolean;
}

/**
 * Group nearby reports into clusters for map display
 * Helps visualize overlapping markers and prevents marker collapse
 * 
 * @param reports - Array of reports with coordinates
 * @param radiusMeters - Radius in meters to consider as part of same cluster (default: 50m)
 * @returns Array of marker clusters
 */
export function clusterReports(
  reports: Report[],
  radiusMeters: number = 50
): MarkerCluster[] {
  if (reports.length === 0) return [];

  // Filter out already processed reports
  const unprocessed = new Set(reports.map((r, i) => i));
  const clusters: MarkerCluster[] = [];

  const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    // Simple distance calculation (accurate enough for local clustering)
    const latDiff = (lat2 - lat1) * 111000; // 1 degree ≈ 111km
    const lonDiff = (lon2 - lon1) * 111000 * Math.cos((lat1 * Math.PI) / 180);
    return Math.sqrt(latDiff * latDiff + lonDiff * lonDiff);
  };

  unprocessed.forEach((idx) => {
    if (!unprocessed.has(idx)) return; // Already processed

    const report = reports[idx];
    const nearby: Report[] = [report];
    unprocessed.delete(idx);

    // Find all reports within radius
    unprocessed.forEach((otherIdx) => {
      const other = reports[otherIdx];
      const distance = getDistance(
        report.latitude,
        report.longitude,
        other.latitude,
        other.longitude
      );

      if (distance <= radiusMeters) {
        nearby.push(other);
        unprocessed.delete(otherIdx);
      }
    });

    // Calculate cluster center
    const avgLat = nearby.reduce((sum, r) => sum + r.latitude, 0) / nearby.length;
    const avgLng = nearby.reduce((sum, r) => sum + r.longitude, 0) / nearby.length;

    clusters.push({
      latitude: avgLat,
      longitude: avgLng,
      reports: nearby,
      count: nearby.length,
      isCluster: nearby.length > 1
    });
  });

  return clusters;
}

/**
 * Calculate bounds for all reports
 */
export function calculateMapBounds(reports: Report[]) {
  if (reports.length === 0) {
    return {
      north: -26.1,
      south: -26.3,
      east: 28.1,
      west: 28.0
    };
  }

  let minLat = reports[0].latitude;
  let maxLat = reports[0].latitude;
  let minLng = reports[0].longitude;
  let maxLng = reports[0].longitude;

  reports.forEach(r => {
    if (r.latitude < minLat) minLat = r.latitude;
    if (r.latitude > maxLat) maxLat = r.latitude;
    if (r.longitude < minLng) minLng = r.longitude;
    if (r.longitude > maxLng) maxLng = r.longitude;
  });

  return {
    north: maxLat,
    south: minLat,
    east: maxLng,
    west: minLng
  };
}

/**
 * Get color based on cluster size for visual feedback
 */
export function getClusterColor(count: number): string {
  if (count === 1) return '#3b82f6'; // Blue - single
  if (count <= 3) return '#f59e0b'; // Amber - few
  if (count <= 5) return '#f97316'; // Orange - several
  return '#dc2626'; // Red - many
}

/**
 * Format cluster info for display
 */
export function formatClusterInfo(cluster: MarkerCluster): string {
  if (cluster.count === 1) {
    return cluster.reports[0].type;
  }
  
  const typeCount: Record<string, number> = {};
  cluster.reports.forEach(r => {
    typeCount[r.type] = (typeCount[r.type] || 0) + 1;
  });
  
  const top = Object.entries(typeCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([type, count]) => `${type} (${count})`)
    .join(', ');
  
  return `${cluster.count} incidents: ${top}`;
}
