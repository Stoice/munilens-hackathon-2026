import React from 'react';
import { LocationPing } from '../utils/incidentAggregation';
import { Report } from '../types';
import { MapPin, AlertCircle } from 'lucide-react';

interface LocationPingPopupProps {
  ping: LocationPing;
  onSelectReport: (report: Report) => void;
  onClose: () => void;
}

/**
 * Popup component for displaying multiple incidents at the same location
 * Shows aggregated stats and allows viewing individual incident details
 */
export default function LocationPingPopup({ ping, onSelectReport, onClose }: LocationPingPopupProps) {
  const getImportanceColor = (importance?: string) => {
    switch (importance) {
      case 'Critical': return 'bg-red-100 text-red-700 border border-red-200';
      case 'High': return 'bg-orange-100 text-orange-700 border border-orange-200';
      case 'Medium': return 'bg-primary-blue/10 text-primary-blue border border-primary-blue';
      case 'Low': return 'bg-neutral-grey/10 text-neutral-grey border border-neutral-grey';
      default: return 'bg-primary-blue/10 text-primary-blue border border-primary-blue';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Open': return 'bg-red-100 text-red-700';
      case 'In Progress': return 'bg-amber-100 text-amber-700';
      case 'Resolved': return 'bg-green-100 text-green-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="p-3 space-y-3 min-w-[280px] max-w-[380px]">
      {/* Location Header */}
      <div className="space-y-1 pb-2" style={{borderBottomColor: '#e8e8e8', borderBottomWidth: '1px'}}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-1.5">
            <MapPin className="w-4 h-4 flex-shrink-0" style={{color: '#1a6fa8'}} />
            <span className="font-semibold text-xs uppercase tracking-wider" style={{color: '#1a2e5a'}}>
              {ping.count} Incident{ping.count !== 1 ? 's' : ''} At Location
            </span>
          </div>
        </div>
        {ping.address && (
          <p className="text-[10px] line-clamp-2 pl-5" style={{color: '#9e9e9e'}}>{ping.address}</p>
        )}
      </div>

      {/* Aggregated Stats */}
      <div className="space-y-2 py-2 px-2 rounded-lg" style={{backgroundColor: '#f0f0f0'}}>
        <div className="grid grid-cols-2 gap-2 text-[10px]">
          {/* Status Breakdown */}
          <div className="space-y-1">
            <p className="font-bold uppercase tracking-widest" style={{color: '#9e9e9e'}}>Status</p>
            {Object.entries(ping.status).map(([status, count]) => (
              <div key={status} className="flex items-center justify-between">
                <span className={`px-2 py-1 rounded-full text-[9px] font-bold uppercase ${getStatusColor(status)}`}>
                  {status} ({count})
                </span>
              </div>
            ))}
          </div>

          {/* Importance Breakdown */}
          <div className="space-y-1">
            <p className="font-bold uppercase tracking-widest" style={{color: '#9e9e9e'}}>Priority</p>
            {Object.entries(ping.importance).map(([imp, count]) => (
              <div key={imp} className="flex items-center justify-between">
                <span className={`px-2 py-1 rounded text-[9px] font-bold uppercase ${getImportanceColor(imp)}`}>
                  {imp} ({count})
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Type Breakdown */}
        <div className="pt-1 space-y-1" style={{borderTopColor: '#d9c9a8', borderTopWidth: '1px'}}>
          <p className="font-bold uppercase tracking-widest text-[9px]" style={{color: '#9e9e9e'}}>Types</p>
          <div className="flex flex-wrap gap-1">
            {Object.entries(ping.types).map(([type, count]) => (
              <span
                key={type}
                className="px-2 py-1 bg-white border rounded text-[9px] font-semibold"
                style={{borderColor: '#d9c9a8', color: '#1a2e5a'}}
              >
                {type} <span style={{color: '#9e9e9e'}}>({count})</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Incidents List */}
      <div className="space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar">
        <p className="text-[9px] font-bold uppercase tracking-widest px-1" style={{color: '#9e9e9e'}}>Individual Incidents</p>

        {ping.reports.map((report, idx) => (
          <div
            key={report.id || idx}
            className="p-2 bg-white border rounded-lg transition-colors cursor-pointer group"
            style={{borderColor: '#d9c9a8'}} onMouseEnter={(e) => {e.currentTarget.style.borderColor = '#1a6fa8'; e.currentTarget.style.backgroundColor = '#f0f0f0';}} onMouseLeave={(e) => {e.currentTarget.style.borderColor = '#d9c9a8'; e.currentTarget.style.backgroundColor = '#fff';}}
            onClick={() => {
              onSelectReport(report);
              onClose();
            }}
          >
            <div className="flex items-start justify-between gap-2 mb-1">
              <h4 className="font-bold text-[10px] flex-1 transition-colors" style={{color: '#1a2e5a'}}>
                {report.type}
              </h4>
              <span className={`px-1.5 py-0.5 rounded-full text-[7px] font-black uppercase tracking-wider whitespace-nowrap ${getImportanceColor(report.importance)}`}>
                {report.importance || 'Medium'}
              </span>
            </div>

            <div className="flex items-center gap-2 text-[9px] mb-1">
              <span className={`px-1.5 py-0.5 rounded-full text-[7px] font-bold uppercase ${getStatusColor(report.status)}`}>
                {report.status}
              </span>
              <span className="text-gray-500">{new Date(report.reportedAt).toLocaleDateString()}</span>
            </div>

            {report.description && (
              <p className="text-[9px] line-clamp-2 italic" style={{color: '#666'}}>
                {report.description}
              </p>
            )}

            {report.reporterName && (
              <p className="text-[8px] mt-1" style={{color: '#9e9e9e'}}>
                Reported by: {report.reporterName}
              </p>
            )}

            <button className="w-full mt-2 py-1 text-white text-[8px] font-bold uppercase tracking-wider rounded transition-colors" style={{backgroundColor: '#1a6fa8'}} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1a2e5a'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#1a6fa8'}>
              View Details
            </button>
          </div>
        ))}
      </div>

      {/* Footer Actions */}
      <div className="flex gap-2 pt-2" style={{borderTopColor: '#e8e8e8', borderTopWidth: '1px'}}>
        <button
          onClick={() => {
            // Select the most critical incident
            onSelectReport(ping.mostCritical);
            onClose();
          }}
          className="flex-1 py-2 bg-red-600 text-white text-[9px] font-bold uppercase tracking-wider rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center gap-1"
        >
          <AlertCircle className="w-3 h-3" />
          View Most Critical
        </button>
        <button
          onClick={onClose}
          className="px-3 py-2 text-[9px] font-bold uppercase tracking-wider rounded-lg transition-colors"
          style={{color: '#9e9e9e'}} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f0f0f0'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          Close
        </button>
      </div>
    </div>
  );
}
