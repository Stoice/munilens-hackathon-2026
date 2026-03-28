# Incident Aggregation System - User Guide

## Overview
The MuniLens map now intelligently aggregates incidents that occur at identical coordinates into single "pings." This eliminates marker overlap, provides comprehensive incident summaries, and enables efficient viewing of all reported issues at a location.

---

## How It Works

### Single Incident Location
When a location has **1 incident**:
- Shows a **single blue marker** with a dot indicator
- Hover displays incident type, status, and importance
- Click opens the incident details modal

### Multiple Incidents at Same Location
When a location has **2+ incidents**:
- Shows a **single colored marker** with a **count badge** showing the total
- Color indicates severity of the **most critical** incident at that location
  - 🔴 Red: Critical incident present
  - 🟠 Orange: High priority incident
  - 🔵 Blue: Medium priority
  - ⚫ Gray: Low priority incidents only
- Hover displays aggregated data (all types, statuses, importance levels)
- Click opens **Location Ping Modal** showing all incidents at that coordinate

---

## Marker Visual Design

### Single Incident
```
    ●
   Blue dot (clickable)
```

### Multiple Incidents (Example: 3 incidents)
```
    ╭─────╮
    │  3  │  ← Count badge (red, indicating severity)
    ╰─────╯
      ⚫
   Colored circle based on most critical incident
```

---

## Location Ping Modal

When clicking on a multi-incident marker, a modal appears with:

### 1. **Location Header**
- Number of incidents at this location
- Address (if available)
- Coordinates

### 2. **Aggregated Statistics**
- **Status Breakdown**: Count by status (Open/In Progress/Resolved)
- **Priority Breakdown**: Count by importance (Critical/High/Medium/Low)
- **Type Breakdown**: All fault types reported at this location with counts

### 3. **Individual Incident List**
Each incident card shows:
- Incident type
- Importance level
- Status
- Report date
- Reporter name
- Description snippet
- "View Details" button to open full incident modal

### 4. **Quick Actions**
- **View Most Critical**: Jumps to the most urgent incident at that location
- **Close**: Closes the modal

---

## Map Header Information

The map now displays:
- **Location Pings**: Number of aggregated locations shown
- **Total Incidents**: Sum of all incidents across all pings
- **Total Reports**: Grand total in system

```
Live Fault Map
5 location pings
12 incidents • 15 total
```

---

## Key Features

### ✅ No Overlapping Markers
- Multiple incidents at same coordinates create ONE marker
- Click badge to see all incidents at that location

### ✅ Smart Color Coding
- Marker color indicates the **most critical incident** at that location
- Helps prioritize which areas need immediate attention
- Red markers stand out for critical issues

### ✅ Comprehensive Information
- See aggregated stats for type, status, and importance
- View individual details for each incident
- Filter and sort incidents within the location

### ✅ Efficient Navigation
- "Most Critical" button takes you to the most urgent issue
- "View Details" buttons on each incident card
- Direct access to full incident modals

### ✅ Mobile Friendly
- Responsive marker sizes
- Scrollable incident lists
- Touch-friendly button sizing

---

## Example Scenarios

### Scenario 1: Construction Area with Multiple Potholes
**Location**: Main Street & 5th Avenue
- 3x Pothole (High priority)
- 1x Water Leak (Medium priority)
- 1x Illegal Dumping (Low priority)

**Map Display**:
- Single marker with "5" badge
- Color: Orange (because High priority exists)
- Hover shows: "5 Incidents: 3× Pothole, 2× Other"
- Click opens modal with all 5 incidents

### Scenario 2: Power Outage Building
**Location**: Downtown Office Complex
- 2x Electricity Outage (Critical)
- 3x Electrical Damage (High)

**Map Display**:
- Single marker with "5" badge
- Color: Red (because Critical exists)
- Hover shows: "5 Incidents: 2× Electricity Outage, 3× Electrical Damage"
- Click opens modal grouped by urgency

---

## Data Aggregation Details

### Coordinate Matching
- Incidents are matched on **exact coordinates** (rounded to 6 decimal places)
- ~11cm accuracy - sufficient for practical location matching
- Ensures only truly co-located incidents are grouped

### Status Tracking
For aggregated locations, shows totals:
- **Open**: 2 incidents
- **In Progress**: 1 incident
- **Resolved**: 2 incidents

### Sort Order
Incidents within a location are sorted by:
1. **Most Critical First**: Importance (Critical → High → Medium → Low)
2. **Most Recent**: Report date within each importance level

### Color Priority
Marker color determined by **most critical** incident:
1. If ANY incident is "Critical" → RED
2. Else if ANY incident is "High" → ORANGE
3. Else if ANY incident is "Medium" → BLUE
4. Else (all "Low") → GRAY

---

## Technical Details

### Files Modified/Created

**New Files**:
- `src/utils/incidentAggregation.ts` - Aggregation logic & utilities
- `src/components/LocationPingPopup.tsx` - Multi-incident display component

**Updated Files**:
- `src/components/Dashboard.tsx` - Map rendering with aggregation

### Implementation Highlights

**Aggregation Algorithm**:
```typescript
GROUP reports BY (latitude, longitude)
FOR EACH group:
  - Count incidents by status, type, importance
  - Find most critical incident
  - Find most recent incident
  - Calculate group center
```

**Custom Marker Icons**:
- Dynamically generated SVG-like HTML
- Colored based on incident severity
- Badge shows incident count
- Click handlers for modal triggers

**Memory Optimization**:
- `useMemo` caches aggregated pings
- Recalculates only when reports list changes
- Prevents unnecessary re-renders

---

## Testing & Verification

### How to Test

1. **Single Incident Marker**:
   - Create 1 report with GPS coordinates
   - Verify single blue dot appears on map
   - Hover shows incident details
   - Click opens incident modal

2. **Multi-Incident Location**:
   - Create 3+ reports at **exact same location**
   - Verify single marker appears with count badge
   - Badge color matches most critical incident
   - Hover shows aggregated summary

3. **Location Ping Modal**:
   - Click multi-incident marker
   - Verify all incidents display in modal
   - Check stats totals are accurate
   - Click "View Details" on any incident

4. **Color Verification**:
   - Create 3 incidents: 1 Critical, 1 High, 1 Medium
   - Place all at same location
   - Marker should be RED (most critical wins)

### Expected Outcomes

| Scenario | Expected Result |
|----------|---|
| 1 incident at location | Blue dot marker |
| 3 incidents at location | Colorful marker with "3" badge |
| Click single incident | Opens incident modal |
| Click multi-incident | Opens Location Ping Modal |
| Hover multi-incident marker | Shows type/status/importance summary |
| Map with 5 locations | Shows "5 location pings" |

---

## Troubleshooting

### Issue: Incidents not grouping
**Cause**: Coordinates don't match exactly
**Solution**: Reports must have identical latitude/longitude values

### Issue: Marker shows wrong color
**Cause**: Color based on most critical incident
**Solution**: Check that the most critical incident in the group has correct importance level

### Issue: Count badge shows wrong number
**Cause**: Some reports may have invalid coordinates
**Solution**: Check coordinate validation in browser console

---

## Future Enhancements

Possible improvements for future releases:

1. **Radius-Based Clustering**: Group incidents within N meters (configurable)
2. **Heatmap View**: Show incident density across the map
3. **Time-Based Animation**: Show incidents appearing over time
4. **Weather Integration**: Show weather conditions affecting incident types
5. **Trend Analysis**: Highlight hotspots and recurring issue areas
6. **Export Functionality**: Download aggregated incident data by location

---

## Summary

The Incident Aggregation System ensures that **all incidents are accurately visualized** on the map without overlapping markers. By intelligently grouping incidents at identical coordinates and providing comprehensive summaries, administrators can:

- ✅ See the full picture of incidents at any location
- ✅ Prioritize response based on incident severity
- ✅ Avoid marker overlap and visual confusion
- ✅ Access detailed information for each incident
- ✅ Make data-driven decisions about resource allocation

**Result**: A cleaner, more intuitive map interface with complete incident visibility and actionable insights!
