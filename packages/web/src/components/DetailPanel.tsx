/**
 * DetailPanel - Shows detailed information about a selected place
 */

import { useCallback, useState, useRef, useEffect } from 'react';
import { useViewStore } from '../stores/viewStore';
import { usePlaceDetail } from '../hooks/useMapData';
import Tooltip from './Tooltip';

const MIN_WIDTH = 320;
const MAX_WIDTH = 800;
const DEFAULT_WIDTH = 480; // Wider default for better readability

// DOB Complaint disposition explanations for tooltips
const DISPOSITION_EXPLANATIONS: Record<string, string> = {
  'No Violation Warranted': 'Inspector found no code violation at the time of inspection',
  'Violation(s) Served': 'Inspector found violations and issued official notice to correct',
  'ECB Violation Served': 'Environmental Control Board violation issued - may include fines',
  'ECB & DOB Violations Served': 'Both ECB and DOB violations were issued',
  'No Access - 1st Attempt': 'Inspector could not access the property (1st try)',
  'No Access - 2nd Attempt': 'Inspector could not access the property (2nd try) - complaint may be closed',
  'Access Denied - 1st Attempt': 'Property owner refused inspector access (1st try)',
  'Access Denied - 2nd Attempt': 'Property owner refused inspector access (2nd try)',
  'Full Stop Work Order': 'All construction work must cease immediately',
  'Partial Stop Work Order': 'Some construction work must cease',
  'Criminal Court Summons Served': 'Serious violation requiring court appearance',
  'Referred to HPD': 'Complaint forwarded to Housing Preservation & Development',
  'Referred to FDNY': 'Complaint forwarded to Fire Department',
  'Referred to DEP': 'Complaint forwarded to Environmental Protection',
  'Administrative Closure': 'Complaint closed without inspection (duplicate, invalid, etc.)',
  'Action Filed': 'Legal or enforcement action has been initiated',
  'Full Vacate Order': 'Building must be evacuated immediately',
  'Partial Vacate Order': 'Part of building must be evacuated',
};

// DOB Job type explanations for tooltips
const JOB_TYPE_EXPLANATIONS: Record<string, string> = {
  'New Building': 'Construction of an entirely new structure',
  'Major Alteration': 'Significant changes affecting structural elements, egress, or use',
  'Minor Alteration': 'Non-structural changes that don\'t affect egress or use',
  'Demolition': 'Partial or full removal of a structure',
  'ALT-CO - New Building with Existing Elements to Remain': 'New construction that keeps parts of the original building (foundation, facade, etc.) - requires new Certificate of Occupancy',
  'Alteration Type 1': 'Major work affecting exits or occupancy - requires new C of O',
  'Alteration Type 2': 'Multiple work types without changing exits or occupancy',
  'Alteration Type 3': 'One type of minor work (plumbing, mechanical, etc.)',
  'Scaffold': 'Temporary structure for construction access',
  'Equipment': 'Installation of mechanical/electrical equipment',
  'Plumbing': 'Plumbing system installation or modification',
  'Filing': 'Subsequent filing related to an existing job',
};

// Certainty badge colors
const CERTAINTY_STYLES = {
  discussion: { bg: 'bg-slate-100', text: 'text-slate-700', label: 'Under discussion' },
  probable: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Likely' },
  certain: { bg: 'bg-green-100', text: 'text-green-700', label: 'Approved' },
} as const;

// Nature badge colors
const NATURE_STYLES = {
  densification: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Densification' },
  renovation: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Renovation' },
  infrastructure: { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Infrastructure' },
  demolition: { bg: 'bg-red-100', text: 'text-red-700', label: 'Demolition' },
  mixed: { bg: 'bg-slate-100', text: 'text-slate-700', label: 'Mixed' },
} as const;

// Activity Timeline component with collapsible closed complaints
interface SourceSummary {
  sourceType: string;
  sourceId?: string;
  description: string;
  agency?: string;
  projectType?: string;
  filedDate?: string;
  officialUrl?: string;
  dobNowDetails?: {
    bin?: string;
    jobStatus?: string;
    filingStatus?: string;
    jobType?: string;
    floors?: string;
  };
  complaintDetails?: {
    status: string;
    category: string;
    categoryCode: string;
    disposition?: string;
    inspectionDate?: string;
  };
}

function ActivityTimeline({ sources, formatDate }: { sources?: SourceSummary[]; formatDate: (d: string | undefined | null) => string }) {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  if (!sources || sources.length === 0) return null;

  // Group similar sources by month + type + description
  type SourceGroup = {
    key: string;
    month: string;
    sourceType: string;
    description: string;
    items: SourceSummary[];
    officialUrl?: string;
    agency?: string;
    projectType?: string;
  };

  const groups: SourceGroup[] = [];
  const groupMap = new Map<string, SourceGroup>();

  for (const source of sources) {
    const month = source.filedDate ? formatDate(source.filedDate) : 'No date';
    const key = `${month}|${source.sourceType}|${source.description}`;

    if (groupMap.has(key)) {
      groupMap.get(key)!.items.push(source);
    } else {
      const group: SourceGroup = {
        key,
        month,
        sourceType: source.sourceType,
        description: source.description,
        items: [source],
        officialUrl: source.officialUrl,
        agency: source.agency,
        projectType: source.projectType,
      };
      groupMap.set(key, group);
      groups.push(group);
    }
  }

  // Find complaints URL (same for all complaints at this building)
  const complaintsUrl = sources.find(s => s.complaintDetails)?.officialUrl;

  const toggleExpand = (key: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-slate-900">
          Activity ({sources.length})
        </h3>
        {complaintsUrl && (
          <a
            href={complaintsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-500 hover:text-blue-700 hover:underline"
          >
            View complaints on BISWeb →
          </a>
        )}
      </div>
      <div className="relative">
        {/* Vertical timeline line */}
        <div className="absolute left-[11px] top-3 bottom-3 w-0.5 bg-slate-200" />

        <div className="space-y-0">
          {groups.map((group) => {
            const complaint = group.items[0]?.complaintDetails;
            const isClosed = complaint?.status === 'CLOSED';
            const isExpanded = expandedItems.has(group.key);
            const isCollapsible = isClosed && complaint;

            return (
              <div
                key={group.key}
                className={`relative flex gap-4 pb-4 last:pb-0 ${isClosed && !isExpanded ? 'opacity-60' : ''}`}
              >
                {/* Timeline dot */}
                <div className="relative z-10 flex-shrink-0">
                  <div className={`w-6 h-6 rounded-full bg-white border-2 ${
                    group.items.length > 1 ? 'border-blue-400' :
                    isClosed ? 'border-slate-200' : 'border-slate-300'
                  } flex items-center justify-center`}>
                    {group.items.length > 1 ? (
                      <span className="text-[10px] font-medium text-blue-600">{group.items.length}</span>
                    ) : (
                      <div className={`w-2 h-2 rounded-full ${isClosed ? 'bg-slate-300' : 'bg-slate-400'}`} />
                    )}
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 pt-0.5">
                  {/* Header row: Date, type, IDs, status - clickable for closed complaints */}
                  <div
                    className={`flex items-center gap-2 flex-wrap ${isCollapsible ? 'cursor-pointer' : ''}`}
                    onClick={isCollapsible ? () => toggleExpand(group.key) : undefined}
                  >
                    <span className={`text-sm font-semibold tabular-nums ${isClosed ? 'text-slate-500' : 'text-slate-900'}`}>
                      {group.month}
                    </span>
                    {/* Type with optional tooltip */}
                    {(() => {
                      const explanation = JOB_TYPE_EXPLANATIONS[group.sourceType] || JOB_TYPE_EXPLANATIONS[group.description];

                      if (explanation) {
                        return (
                          <Tooltip content={explanation} position="top">
                            <span className={`text-sm cursor-help border-b border-dotted ${isClosed ? 'text-slate-400 border-slate-300' : 'text-slate-600 border-slate-400'}`}>
                              {group.sourceType}
                            </span>
                          </Tooltip>
                        );
                      }
                      return (
                        <span className={`text-sm ${isClosed ? 'text-slate-400' : 'text-slate-600'}`}>
                          {group.sourceType}
                        </span>
                      );
                    })()}
                    {group.items.length > 1 && (
                      <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                        ×{group.items.length}
                      </span>
                    )}
                    {/* IDs inline */}
                    {group.items.map((item, i) => item.sourceId && (
                      <button
                        key={i}
                        onClick={(e) => {
                          e.stopPropagation();
                          navigator.clipboard.writeText(item.sourceId!);
                        }}
                        title="Click to copy"
                        className="text-xs bg-slate-100 px-1.5 py-0.5 rounded text-slate-500 hover:bg-slate-200 transition-colors cursor-pointer font-mono"
                      >
                        {item.sourceId}
                      </button>
                    ))}
                    {/* Expand indicator for closed complaints */}
                    {isCollapsible && (
                      <span className="text-xs text-slate-400 ml-auto">
                        {isExpanded ? '▼' : '▶'}
                      </span>
                    )}
                  </div>

                  {/* Expanded content OR non-complaint content */}
                  {(!isCollapsible || isExpanded) && (
                    <>
                      {/* Description */}
                      {(() => {
                        if (complaint) {
                          if (complaint.category.startsWith('Category ')) return null;
                          return (
                            <div className={`text-sm mt-0.5 ${isClosed ? 'text-slate-400' : 'text-slate-500'}`}>
                              <Tooltip content={`Code: ${complaint.categoryCode}`} position="top">
                                <span className="cursor-help border-b border-dotted border-slate-300">
                                  {complaint.category}
                                </span>
                              </Tooltip>
                            </div>
                          );
                        }
                        // Skip description if it matches sourceType or DOB NOW jobType (avoid duplication)
                        const dobJobType = group.items.find(item => item.dobNowDetails)?.dobNowDetails?.jobType;
                        if (group.description !== group.sourceType && group.description !== dobJobType) {
                          const explanation = JOB_TYPE_EXPLANATIONS[group.description];
                          if (explanation) {
                            return (
                              <div className="text-sm text-slate-500 mt-0.5">
                                <Tooltip content={explanation} position="top">
                                  <span className="cursor-help border-b border-dotted border-slate-400">
                                    {group.description}
                                  </span>
                                </Tooltip>
                              </div>
                            );
                          }
                          return <div className="text-sm text-slate-500 mt-0.5">{group.description}</div>;
                        }
                        return null;
                      })()}

                      {/* Metadata row */}
                      {(() => {
                        const isComplaint = !!complaint;
                        const showUrl = group.officialUrl && !isComplaint;
                        if (!group.agency && !group.projectType && !showUrl) return null;
                        return (
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs text-slate-400">
                            {group.agency && <span>{group.agency}</span>}
                            {group.projectType && <span>{group.projectType}</span>}
                            {showUrl && (
                              <a href={group.officialUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-700 hover:underline">
                                View →
                              </a>
                            )}
                          </div>
                        );
                      })()}

                      {/* DOB NOW enriched details */}
                      {(() => {
                        const firstWithDetails = group.items.find(item => item.dobNowDetails);
                        if (!firstWithDetails?.dobNowDetails) return null;
                        const dob = firstWithDetails.dobNowDetails;
                        return (
                          <div className="mt-2 pt-2 border-t border-slate-100 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                            {dob.jobStatus && (
                              <>
                                <span className="text-slate-400">Status</span>
                                <span className="text-slate-600 font-medium">{dob.jobStatus}</span>
                              </>
                            )}
                            {dob.filingStatus && (
                              <>
                                <span className="text-slate-400">Filing</span>
                                <span className="text-slate-600">{dob.filingStatus}</span>
                              </>
                            )}
                            {dob.jobType && (
                              <>
                                <span className="text-slate-400">Type</span>
                                <span className="text-slate-600">{dob.jobType}</span>
                              </>
                            )}
                            {dob.floors && (() => {
                              const rangeMatch = dob.floors.match(/(\d+)\s+through\s+(\d+)/i);
                              if (rangeMatch?.[1] && rangeMatch?.[2]) {
                                return (
                                  <>
                                    <span className="text-slate-400">Floors</span>
                                    <span className="text-slate-600">{rangeMatch[1]}-{rangeMatch[2]}</span>
                                  </>
                                );
                              }
                              const floors = dob.floors.split(',').map(f => f.trim()).filter(Boolean);
                              return (
                                <>
                                  <span className="text-slate-400">Floors</span>
                                  <span className="text-slate-600">{floors.length} floor{floors.length > 1 ? 's' : ''}</span>
                                </>
                              );
                            })()}
                          </div>
                        );
                      })()}

                      {/* Complaint enriched details */}
                      {(() => {
                        const firstWithComplaint = group.items.find(item => item.complaintDetails);
                        if (!firstWithComplaint?.complaintDetails) return null;
                        const c = firstWithComplaint.complaintDetails;
                        const dispositionExplanation = c.disposition ? DISPOSITION_EXPLANATIONS[c.disposition] : undefined;

                        // Calculate delay
                        const filedDate = firstWithComplaint.filedDate ? new Date(firstWithComplaint.filedDate) : null;
                        const inspectionDate = c.inspectionDate ? new Date(c.inspectionDate) : null;
                        let delayText = '';
                        if (filedDate && inspectionDate && inspectionDate > filedDate) {
                          const diffDays = Math.floor((inspectionDate.getTime() - filedDate.getTime()) / (1000 * 60 * 60 * 24));
                          if (diffDays < 7) delayText = diffDays === 1 ? '1 day later' : `${diffDays} days later`;
                          else if (diffDays < 30) delayText = `${Math.floor(diffDays / 7)} weeks later`;
                          else if (diffDays < 365) delayText = `${Math.floor(diffDays / 30)} months later`;
                          else {
                            const years = Math.floor(diffDays / 365);
                            const months = Math.floor((diffDays % 365) / 30);
                            delayText = months > 0 ? `${years}y ${months}mo later` : `${years} year${years > 1 ? 's' : ''} later`;
                          }
                        }

                        return (
                          <div className="mt-1.5 space-y-1">
                            {c.inspectionDate && (
                              <div className="text-xs text-slate-400">
                                <Tooltip content="Date when DOB inspector visited the property" position="right">
                                  <span className="cursor-help border-b border-dotted border-slate-300">Inspection</span>
                                </Tooltip>
                                : {c.inspectionDate}
                                {delayText && <span> ({delayText})</span>}
                              </div>
                            )}
                            {c.disposition && (
                              <div className="flex items-center gap-1.5 text-xs">
                                <span className="text-slate-400">Outcome:</span>
                                {dispositionExplanation ? (
                                  <Tooltip content={dispositionExplanation} position="top">
                                    <span className={`cursor-help border-b border-dotted ${isClosed ? 'text-slate-500 border-slate-300' : 'text-slate-600 border-slate-400'}`}>
                                      {c.disposition}
                                    </span>
                                  </Tooltip>
                                ) : (
                                  <span className={isClosed ? 'text-slate-500' : 'text-slate-600'}>{c.disposition}</span>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function DetailPanel() {
  const { closeDetailPanel } = useViewStore();
  const { data: detail, isLoading, error } = usePlaceDetail(true);

  // Resizable panel state
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const isResizing = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);

  const handleClose = useCallback(() => {
    closeDetailPanel();
  }, [closeDetailPanel]);

  // Format a date for display
  const formatDate = (dateStr: string | undefined | null) => {
    if (!dateStr) return 'TBD';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  // Resize handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    isResizing.current = true;
    startX.current = e.clientX;
    startWidth.current = width;
    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';
  }, [width]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return;

      // Calculate new width (dragging left increases width since panel is on right)
      const delta = startX.current - e.clientX;
      const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth.current + delta));
      setWidth(newWidth);
    };

    const handleMouseUp = () => {
      if (isResizing.current) {
        isResizing.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  return (
    <div
      className="absolute top-0 right-0 h-full bg-white shadow-2xl z-20 flex flex-col"
      style={{ width: `${width}px` }}
    >
      {/* Resize handle */}
      <div
        onMouseDown={handleMouseDown}
        className="absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize hover:bg-blue-500 transition-colors group"
      >
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-12 bg-slate-300 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
      {/* Header */}
      <div className="p-4 border-b border-slate-200 flex items-start justify-between">
        <div className="flex-1 min-w-0">
          {isLoading ? (
            <div className="animate-pulse">
              <div className="h-6 bg-slate-200 rounded w-3/4 mb-2" />
              <div className="h-4 bg-slate-100 rounded w-1/2" />
            </div>
          ) : detail ? (
            <>
              <h2 className="text-lg font-semibold text-slate-900 truncate">
                {detail.transformation?.headline ?? 'Loading...'}
              </h2>
              <p className="text-sm text-slate-500 truncate">
                {detail.place.address}
              </p>
            </>
          ) : null}
        </div>
        <button
          onClick={handleClose}
          className="p-1 hover:bg-slate-100 rounded-md transition-colors ml-2"
        >
          <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading && (
          <div className="space-y-4 animate-pulse">
            <div className="h-20 bg-slate-100 rounded" />
            <div className="h-32 bg-slate-100 rounded" />
            <div className="h-24 bg-slate-100 rounded" />
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-50 text-red-700 rounded-lg">
            Failed to load details. Please try again.
          </div>
        )}

        {detail && detail.transformation && (
          <div className="space-y-6">
            {/* Badges */}
            <div className="flex flex-wrap gap-2">
              {/* Intensity */}
              <div className="px-3 py-1 bg-slate-900 text-white rounded-full text-sm font-medium">
                Intensity: {detail.transformation.intensity}
              </div>
              {/* Certainty */}
              {detail.transformation.certainty && (
                <div
                  className={`px-3 py-1 rounded-full text-sm font-medium ${
                    CERTAINTY_STYLES[detail.transformation.certainty].bg
                  } ${CERTAINTY_STYLES[detail.transformation.certainty].text}`}
                >
                  {CERTAINTY_STYLES[detail.transformation.certainty].label}
                </div>
              )}
              {/* Nature */}
              {detail.transformation.nature && (
                <div
                  className={`px-3 py-1 rounded-full text-sm font-medium ${
                    NATURE_STYLES[detail.transformation.nature].bg
                  } ${NATURE_STYLES[detail.transformation.nature].text}`}
                >
                  {NATURE_STYLES[detail.transformation.nature].label}
                </div>
              )}
            </div>

            {/* Timeline - Visual vertical line design */}
            {(() => {
              const events = [
                { date: detail.transformation.disruptionStart, label: 'Disruption begins', icon: '🚧', color: 'bg-amber-500' },
                { date: detail.transformation.visibleChangeDate, label: 'Visible change', icon: '👁', color: 'bg-blue-500' },
                { date: detail.transformation.usageChangeDate, label: 'Ready for use', icon: '✓', color: 'bg-green-500' },
                { date: detail.transformation.disruptionEnd, label: 'Disruption ends', icon: '✓', color: 'bg-green-600' },
              ].filter(e => e.date);

              if (events.length === 0) return null;

              return (
                <div className="relative pl-6">
                  {/* Vertical line */}
                  <div className="absolute left-[7px] top-2 bottom-2 w-0.5 bg-gradient-to-b from-amber-400 via-blue-400 to-green-500" />

                  <div className="space-y-4">
                    {events.map((event, i) => (
                      <div key={i} className="relative flex items-start gap-3">
                        {/* Dot on the line */}
                        <div className={`absolute -left-6 top-0.5 w-4 h-4 rounded-full ${event.color} border-2 border-white shadow-sm flex items-center justify-center`}>
                          <span className="text-[8px] text-white">{i + 1}</span>
                        </div>
                        {/* Content */}
                        <div className="flex-1 flex justify-between items-baseline min-w-0">
                          <span className="text-sm text-slate-600">{event.label}</span>
                          <span className="text-sm font-semibold text-slate-900 tabular-nums">
                            {formatDate(event.date)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* One-liner */}
            <p className="text-slate-700 text-base leading-relaxed">
              {detail.transformation.oneLiner}
            </p>

            {/* Disruption summary */}
            {detail.transformation.disruptionSummary && (
              <div className="bg-amber-50 rounded-lg p-4">
                <h3 className="text-sm font-medium text-amber-900 mb-2">
                  What to expect
                </h3>
                <p className="text-sm text-amber-800">
                  {detail.transformation.disruptionSummary}
                </p>
              </div>
            )}

            {/* Location details */}
            <div>
              <h3 className="text-sm font-medium text-slate-900 mb-2">Location</h3>
              <div className="text-sm text-slate-600 space-y-1">
                {detail.place.address && <p>{detail.place.address}</p>}
                <p>
                  {[detail.place.neighborhood, detail.place.borough]
                    .filter(Boolean)
                    .join(', ') || 'Location details unavailable'}
                </p>
                {/* BIN, BBL, Owner, Architect, Community Board */}
                {(() => {
                  const dobNow = detail.sources?.find(s => s.dobNowDetails)?.dobNowDetails;
                  const prop = detail.propertyDetails;
                  const bin = prop?.bin ?? dobNow?.bin;
                  const bbl = prop?.bbl;
                  const owner = dobNow?.owner;
                  const designProfessional = dobNow?.designProfessional;
                  const communityBoard = prop?.communityBoard;
                  // Parse CB: "402" -> borough 4, district 02
                  const cbBorough = communityBoard ? parseInt(communityBoard.charAt(0), 10) : null;
                  const cbDistrict = communityBoard ? parseInt(communityBoard.slice(1), 10) : null;
                  const boroughNames = ['', 'Manhattan', 'Bronx', 'Brooklyn', 'Queens', 'Staten Island'];
                  const cbUrl = cbBorough && cbDistrict
                    ? `https://www.nyc.gov/site/queenscb${cbDistrict}/index.page`.replace('queenscb',
                        cbBorough === 1 ? 'manhattancb' :
                        cbBorough === 2 ? 'bronxcb' :
                        cbBorough === 3 ? 'brooklyncb' :
                        cbBorough === 4 ? 'queenscb' : 'sicb')
                    : null;

                  if (!bin && !bbl && !owner && !designProfessional && !communityBoard) return null;
                  return (
                    <div className="mt-2 pt-2 border-t border-slate-200 space-y-1">
                      {(bin || bbl) && (
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500 text-xs w-16">IDs</span>
                          <div className="flex gap-2">
                            {bin && (
                              <button
                                onClick={() => navigator.clipboard.writeText(bin)}
                                title="Click to copy BIN"
                                className="font-mono text-slate-700 hover:bg-slate-200 px-1 rounded cursor-pointer text-sm"
                              >
                                BIN {bin}
                              </button>
                            )}
                            {bbl && (
                              <button
                                onClick={() => navigator.clipboard.writeText(bbl)}
                                title="Click to copy BBL"
                                className="font-mono text-slate-700 hover:bg-slate-200 px-1 rounded cursor-pointer text-sm"
                              >
                                BBL {bbl}
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                      {communityBoard && cbBorough && cbDistrict && (
                        <div className="flex items-center gap-2">
                          <div className="w-16 flex-shrink-0">
                            <Tooltip content="Local advisory board that reviews land use, zoning, and neighborhood issues" position="right">
                              <span className="text-slate-500 text-xs cursor-help border-b border-dotted border-slate-400">CB</span>
                            </Tooltip>
                          </div>
                          <a
                            href={cbUrl ?? '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 hover:underline text-sm"
                          >
                            {boroughNames[cbBorough]} CB{cbDistrict}
                          </a>
                        </div>
                      )}
                      {owner && (
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500 text-xs w-16">Owner</span>
                          <span className="text-slate-700 text-sm">{owner}</span>
                        </div>
                      )}
                      {designProfessional && (
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500 text-xs w-16">Architect</span>
                          <span className="text-slate-700 text-sm">{designProfessional}</span>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Property Details from DOB NOW API */}
            {detail.propertyDetails && (
              <div>
                <h3 className="text-sm font-medium text-slate-900 mb-2">Property Details</h3>
                <div className="bg-slate-50 rounded-lg p-3 space-y-3">
                  {/* Key info grid */}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                    {detail.propertyDetails.occupancy && (
                      <>
                        <span className="text-slate-500">Use</span>
                        <span className="text-slate-700">{detail.propertyDetails.occupancy}</span>
                      </>
                    )}
                    {detail.propertyDetails.specialArea && (
                      <>
                        <span className="text-slate-500">Zone</span>
                        <span className="text-slate-700">{detail.propertyDetails.specialArea}</span>
                      </>
                    )}
                    {detail.propertyDetails.buildingsOnLot && detail.propertyDetails.buildingsOnLot > 1 && (
                      <>
                        <span className="text-slate-500">Buildings</span>
                        <span className="text-slate-700">{detail.propertyDetails.buildingsOnLot} on lot</span>
                      </>
                    )}
                  </div>

                  {/* Flags row */}
                  {(() => {
                    const flags: { label: string; color: string }[] = [];
                    const prop = detail.propertyDetails!;

                    // Environmental
                    if (prop.floodZone) flags.push({ label: 'Flood Zone', color: 'bg-blue-100 text-blue-700' });
                    if (prop.coastalErosion) flags.push({ label: 'Coastal Erosion', color: 'bg-blue-100 text-blue-700' });
                    if (prop.tidalWetlands) flags.push({ label: 'Tidal Wetlands', color: 'bg-cyan-100 text-cyan-700' });
                    if (prop.freshwaterWetlands) flags.push({ label: 'Wetlands', color: 'bg-cyan-100 text-cyan-700' });

                    // Status
                    if (prop.landmarkStatus) flags.push({ label: 'Landmark', color: 'bg-amber-100 text-amber-700' });
                    if (prop.cityOwned) flags.push({ label: 'City-Owned', color: 'bg-slate-200 text-slate-700' });
                    if (prop.condo) flags.push({ label: 'Condo', color: 'bg-slate-200 text-slate-700' });
                    if (prop.vacant) flags.push({ label: 'Vacant', color: 'bg-slate-200 text-slate-700' });

                    // Regulatory
                    if (prop.sroRestricted) flags.push({ label: 'SRO', color: 'bg-purple-100 text-purple-700' });
                    if (prop.loftLaw) flags.push({ label: 'Loft Law', color: 'bg-purple-100 text-purple-700' });
                    if (prop.antiHarassment) flags.push({ label: 'Anti-Harassment', color: 'bg-purple-100 text-purple-700' });

                    // Violations (red)
                    if (prop.hasClass1Violation) flags.push({ label: 'Class 1 Violation', color: 'bg-red-100 text-red-700' });
                    if (prop.hasStopWork) flags.push({ label: 'Stop Work', color: 'bg-red-100 text-red-700' });
                    if (prop.hasPadlock) flags.push({ label: 'Padlock', color: 'bg-red-100 text-red-700' });
                    if (prop.hasVacateOrder) flags.push({ label: 'Vacate Order', color: 'bg-red-100 text-red-700' });
                    if (prop.filingOnHold) flags.push({ label: 'Filing Hold', color: 'bg-amber-100 text-amber-700' });
                    if (prop.approvalOnHold) flags.push({ label: 'Approval Hold', color: 'bg-amber-100 text-amber-700' });

                    if (flags.length === 0) return null;

                    return (
                      <div className="flex flex-wrap gap-1 pt-2 border-t border-slate-200">
                        {flags.map((flag, i) => (
                          <span key={i} className={`text-xs px-2 py-0.5 rounded ${flag.color}`}>
                            {flag.label}
                          </span>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* Activity Feed / Sources Timeline */}
            <ActivityTimeline sources={detail.sources} formatDate={formatDate} />
          </div>
        )}
      </div>
    </div>
  );
}
