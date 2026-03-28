import { Report } from '../types';

export interface LocationPing {
  latitude: number;
  longitude: number;
  address?: string;
  reports: Report[];
  count: number;
  status: Record<string, number>; // e.g. { 'Open': 2, 'Resolved': 1 }
  importance: Record<string, number>; // e.g. { 'Critical': 1, 'High': 1 }
  types: Record<string, number>; // e.g. { 'Pothole': 2, 'Water Leak': 1 }
  mostRecent: Report;
  mostCritical: Report;
}

/**
 * Group incidents by exact coordinates
 * Useful when multiple reports occur at the same location
 * 
 * @param reports - Array of all reports with valid coordinates
 * @returns Array of location pings with aggregated incidents
 */
export function aggregateIncidentsByLocation(reports: Report[]): LocationPing[] {
  const locationMap = new Map<string, Report[]>();

  // Group by coordinate key
  reports.forEach(report => {
    // Create a key from coordinates (rounded to 6 decimals for exact matching)
    const key = `${report.latitude.toFixed(6)},${report.longitude.toFixed(6)}`;
    
    if (!locationMap.has(key)) {
      locationMap.set(key, []);
    }
    locationMap.get(key)!.push(report);
  });

  // Convert to LocationPing objects
  return Array.from(locationMap.entries()).map(([key, groupReports]) => {
    const status: Record<string, number> = {};
    const importance: Record<string, number> = {};
    const types: Record<string, number> = {};

    groupReports.forEach(report => {
      status[report.status] = (status[report.status] || 0) + 1;
      importance[report.importance || 'Medium'] = (importance[report.importance || 'Medium'] || 0) + 1;
      types[report.type] = (types[report.type] || 0) + 1;
    });

    // Find most recent and most critical
    const mostRecent = groupReports.reduce((latest, current) => 
      new Date(current.reportedAt) > new Date(latest.reportedAt) ? current : latest
    );

    const importanceOrder = { 'Critical': 4, 'High': 3, 'Medium': 2, 'Low': 1 };
    const mostCritical = groupReports.reduce((most, current) => {
      const currentImportance = importanceOrder[(current.importance || 'Medium') as keyof typeof importanceOrder] || 0;
      const mostImportance = importanceOrder[(most.importance || 'Medium') as keyof typeof importanceOrder] || 0;
      return currentImportance >= mostImportance ? current : most;
    });

    return {
      latitude: groupReports[0].latitude,
      longitude: groupReports[0].longitude,
      address: groupReports[0].address,
      reports: groupReports,
      count: groupReports.length,
      status,
      importance,
      types,
      mostRecent,
      mostCritical
    };
  });
}

/**
 * Get human-readable summary of incidents at a location
 */
export function getLocationSummary(ping: LocationPing): {
  typesSummary: string;
  statusSummary: string;
  importanceSummary: string;
} {
  const typesSummary = Object.entries(ping.types)
    .sort((a, b) => b[1] - a[1])
    .map(([type, count]) => count === 1 ? type : `${count}x ${type}`)
    .join(', ');

  const statusSummary = Object.entries(ping.status)
    .sort((a, b) => {
      const order = { 'Open': 0, 'In Progress': 1, 'Resolved': 2 };
      return (order[a[0] as keyof typeof order] || 0) - (order[b[0] as keyof typeof order] || 0);
    })
    .map(([status, count]) => `${count} ${status}`)
    .join(' • ');

  const importanceSummary = Object.entries(ping.importance)
    .sort((a, b) => {
      const order = { 'Critical': 0, 'High': 1, 'Medium': 2, 'Low': 3 };
      return (order[a[0] as keyof typeof order] || 2) - (order[b[0] as keyof typeof order] || 2);
    })
    .map(([imp, count]) => `${count} ${imp}`)
    .join(' • ');

  return {
    typesSummary,
    statusSummary,
    importanceSummary
  };
}

/**
 * Get color based on most critical incident at location
 */
export function getLocationColor(ping: LocationPing): string {
  const criticalLevel = ping.mostCritical.importance;
  
  switch (criticalLevel) {
    case 'Critical': return '#dc2626'; // Red
    case 'High': return '#f97316'; // Orange
    case 'Medium': return '#3b82f6'; // Blue
    case 'Low': return '#6b7280'; // Gray
    default: return '#3b82f6'; // Blue
  }
}

/**
 * Sort location pings by most critical first
 */
export function sortByUrgency(pings: LocationPing[]): LocationPing[] {
  const importanceOrder = { 'Critical': 4, 'High': 3, 'Medium': 2, 'Low': 1 };
  
  return [...pings].sort((a, b) => {
    const aImportance = importanceOrder[(a.mostCritical.importance || 'Medium') as keyof typeof importanceOrder] || 0;
    const bImportance = importanceOrder[(b.mostCritical.importance || 'Medium') as keyof typeof importanceOrder] || 0;
    
    if (aImportance !== bImportance) return bImportance - aImportance;
    
    // If same importance, sort by count (more incidents first)
    return b.count - a.count;
  });
}

/**
 * Format coordinates for display
 */
export function formatCoordinates(latitude: number, longitude: number, precision: number = 4): string {
  return `${latitude.toFixed(precision)}, ${longitude.toFixed(precision)}`;
}

/**
 * Calculate distance between two coordinate sets (in meters, approximate for short distances)
 */
export function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const latDiff = (lat2 - lat1) * 111000; // 1 degree ≈ 111km
  const lngDiff = (lng2 - lng1) * 111000 * Math.cos((lat1 * Math.PI) / 180);
  return Math.sqrt(latDiff * latDiff + lngDiff * lngDiff);
}
