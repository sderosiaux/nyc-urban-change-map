/**
 * DetailPanel - Shows detailed information about a selected place
 */

import { useCallback, useState, useRef, useEffect } from 'react';
import { useViewStore } from '../stores/viewStore';
import { usePlaceDetail } from '../hooks/useMapData';

const MIN_WIDTH = 320;
const MAX_WIDTH = 800;
const DEFAULT_WIDTH = 384; // w-96 = 24rem = 384px

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
                {/* BIN, Owner, Architect from first DOB NOW source */}
                {(() => {
                  const dobNow = detail.sources?.find(s => s.dobNowDetails)?.dobNowDetails;
                  if (!dobNow) return null;
                  const { bin, owner, designProfessional } = dobNow;
                  if (!bin && !owner && !designProfessional) return null;
                  return (
                    <div className="mt-2 pt-2 border-t border-slate-200 space-y-1">
                      {bin && (
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500 text-xs w-16">BIN</span>
                          <button
                            onClick={() => navigator.clipboard.writeText(bin)}
                            title="Click to copy BIN"
                            className="font-mono text-slate-700 hover:bg-slate-200 px-1 rounded cursor-pointer text-sm"
                          >
                            {bin}
                          </button>
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

            {/* Activity Feed / Sources Timeline */}
            {detail.sources && detail.sources.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-slate-900 mb-4">
                  Activity ({detail.sources.length})
                </h3>
                <div className="relative">
                  {/* Vertical timeline line */}
                  <div className="absolute left-[11px] top-3 bottom-3 w-0.5 bg-slate-200" />

                  <div className="space-y-0">
                    {detail.sources.map((source, index) => (
                      <div key={index} className="relative flex gap-4 pb-6 last:pb-0">
                        {/* Timeline dot */}
                        <div className="relative z-10 flex-shrink-0">
                          <div className="w-6 h-6 rounded-full bg-white border-2 border-slate-300 flex items-center justify-center">
                            <div className="w-2 h-2 rounded-full bg-slate-400" />
                          </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0 pt-0.5">
                          {/* Date and ID row */}
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-semibold text-slate-900 tabular-nums">
                              {source.filedDate ? formatDate(source.filedDate) : 'No date'}
                            </span>
                            {source.sourceId && (
                              <button
                                onClick={() => navigator.clipboard.writeText(source.sourceId!)}
                                title="Click to copy"
                                className="text-xs bg-slate-100 px-1.5 py-0.5 rounded text-slate-500 hover:bg-slate-200 transition-colors cursor-pointer font-mono"
                              >
                                {source.sourceId}
                              </button>
                            )}
                          </div>

                          {/* Type and description */}
                          <div className="text-sm font-medium text-slate-700">
                            {source.sourceType}
                          </div>
                          <div className="text-sm text-slate-600 mt-0.5">
                            {source.description}
                          </div>

                          {/* Metadata row */}
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-slate-400">
                            {source.agency && <span>{source.agency}</span>}
                            {source.projectType && <span>{source.projectType}</span>}
                            {source.officialUrl && (
                              <a
                                href={source.officialUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-500 hover:text-blue-700 hover:underline"
                              >
                                View source →
                              </a>
                            )}
                          </div>

                          {/* DOB NOW enriched details */}
                          {source.dobNowDetails && (
                            <div className="mt-2 pt-2 border-t border-slate-200 space-y-1">
                              {source.dobNowDetails.jobStatus && (
                                <div className="flex justify-between text-xs">
                                  <span className="text-slate-500">Status</span>
                                  <span className="text-slate-700 font-medium">{source.dobNowDetails.jobStatus}</span>
                                </div>
                              )}
                              {source.dobNowDetails.filingStatus && (
                                <div className="flex justify-between text-xs">
                                  <span className="text-slate-500">Filing</span>
                                  <span className="text-slate-700">{source.dobNowDetails.filingStatus}</span>
                                </div>
                              )}
                              {source.dobNowDetails.jobType && (
                                <div className="flex justify-between text-xs">
                                  <span className="text-slate-500">Type</span>
                                  <span className="text-slate-700">{source.dobNowDetails.jobType}</span>
                                </div>
                              )}
                              {source.dobNowDetails.floors && (() => {
                                const raw = source.dobNowDetails.floors!;

                                // Check for "through" range format (e.g., "Floor Number(s) 1 through 40")
                                const rangeMatch = raw.match(/(\d+)\s+through\s+(\d+)/i);
                                if (rangeMatch && rangeMatch[1] && rangeMatch[2]) {
                                  const start = parseInt(rangeMatch[1], 10);
                                  const end = parseInt(rangeMatch[2], 10);
                                  const extras = raw
                                    .replace(/Floor Number\(s\)\s*\d+\s+through\s+\d+/gi, '')
                                    .split(',')
                                    .map(f => f.trim())
                                    .filter(Boolean);
                                  const summary = extras.length > 0
                                    ? `Floors ${start}-${end}, ${extras.join(', ')}`
                                    : `Floors ${start}-${end}`;
                                  return (
                                    <div className="flex justify-between text-xs">
                                      <span className="text-slate-500">Floors</span>
                                      <span className="text-slate-700">{summary}</span>
                                    </div>
                                  );
                                }

                                // Parse individual floors
                                const floorList = raw
                                  .split(',')
                                  .map(f => {
                                    let floor = f.trim();
                                    // Remove SO codes like "-SO-3467-B00591681-I1"
                                    floor = floor.replace(/-SO-\d+-[A-Z]\d+-[A-Z0-9]+$/i, '');
                                    // Clean up "Floor Number(s)" prefix
                                    floor = floor.replace(/Floor Number\(s\)\s*/gi, 'Floor ');
                                    // Clean up "Floor -1" to "Floor 1" (negative sign is separator artifact)
                                    floor = floor.replace(/Floor\s*-(\d+)/i, 'Floor $1');
                                    // Clean up "Mezzanine-1" to "Mezzanine 1"
                                    floor = floor.replace(/-(\d+)$/, ' $1');
                                    return floor.trim();
                                  })
                                  .filter(Boolean)
                                  // Deduplicate
                                  .filter((v, i, a) => a.indexOf(v) === i)
                                  .sort((a, b) => {
                                    const numA = parseInt(a.match(/\d+/)?.[0] || '0');
                                    const numB = parseInt(b.match(/\d+/)?.[0] || '0');
                                    const specialA = /cellar|basement/i.test(a) ? -2 : /mezzanine/i.test(a) ? -1 : 0;
                                    const specialB = /cellar|basement/i.test(b) ? -2 : /mezzanine/i.test(b) ? -1 : 0;
                                    if (specialA !== specialB) return specialA - specialB;
                                    if (/roof/i.test(a)) return 1;
                                    if (/roof/i.test(b)) return -1;
                                    return numA - numB;
                                  });

                                // Summarize if many floors
                                const numericFloors = floorList.filter(f => /Floor \d+/.test(f));
                                const specialFloors = floorList.filter(f => !/Floor \d+/.test(f));

                                let summary: string;
                                if (numericFloors.length > 3) {
                                  const nums = numericFloors.map(f => parseInt(f.match(/\d+/)?.[0] || '0'));
                                  const min = Math.min(...nums);
                                  const max = Math.max(...nums);
                                  summary = specialFloors.length > 0
                                    ? `Floors ${min}-${max}, ${specialFloors.join(', ')}`
                                    : `Floors ${min}-${max}`;
                                } else {
                                  summary = floorList.join(', ');
                                }

                                return (
                                  <div className="flex justify-between text-xs">
                                    <span className="text-slate-500">Floors</span>
                                    <span className="text-slate-700">{summary}</span>
                                  </div>
                                );
                              })()}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
