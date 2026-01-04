/**
 * DetailPanel - Shows detailed information about a selected place
 */

import { useCallback } from 'react';
import { useViewStore } from '../stores/viewStore';
import { usePlaceDetail } from '../hooks/useMapData';

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

  const handleClose = useCallback(() => {
    closeDetailPanel();
  }, [closeDetailPanel]);

  // Format a date for display
  const formatDate = (dateStr: string | undefined | null) => {
    if (!dateStr) return 'TBD';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  return (
    <div className="absolute top-0 right-0 h-full w-96 bg-white shadow-2xl z-20 flex flex-col">
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

            {/* One-liner */}
            <p className="text-slate-700 text-base leading-relaxed">
              {detail.transformation.oneLiner}
            </p>

            {/* Timeline */}
            <div className="bg-slate-50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-slate-900 mb-3">Timeline</h3>
              <div className="space-y-3">
                {detail.transformation.disruptionStart && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-600">Disruption begins</span>
                    <span className="text-sm font-medium text-slate-900">
                      {formatDate(detail.transformation.disruptionStart)}
                    </span>
                  </div>
                )}
                {detail.transformation.visibleChangeDate && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-600">Visible change</span>
                    <span className="text-sm font-medium text-slate-900">
                      {formatDate(detail.transformation.visibleChangeDate)}
                    </span>
                  </div>
                )}
                {detail.transformation.usageChangeDate && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-600">Ready for use</span>
                    <span className="text-sm font-medium text-slate-900">
                      {formatDate(detail.transformation.usageChangeDate)}
                    </span>
                  </div>
                )}
                {detail.transformation.disruptionEnd && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-600">Disruption ends</span>
                    <span className="text-sm font-medium text-slate-900">
                      {formatDate(detail.transformation.disruptionEnd)}
                    </span>
                  </div>
                )}
              </div>
            </div>

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
              </div>
            </div>

            {/* Sources */}
            {detail.sources && detail.sources.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-slate-900 mb-2">
                  Sources ({detail.sources.length})
                </h3>
                <div className="space-y-3">
                  {detail.sources.map((source, index) => (
                    <div
                      key={index}
                      className="p-3 bg-slate-50 rounded-lg text-sm"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-medium text-slate-900">
                          {source.sourceType}
                        </div>
                        {source.sourceId && (
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(source.sourceId!);
                            }}
                            title="Click to copy"
                            className="text-xs bg-slate-200 px-1.5 py-0.5 rounded text-slate-600 hover:bg-slate-300 transition-colors cursor-pointer font-mono"
                          >
                            {source.sourceId}
                          </button>
                        )}
                      </div>
                      <div className="text-slate-700 mt-1">
                        {source.description}
                      </div>
                      {source.agency && (
                        <div className="text-xs text-slate-500 mt-1">
                          {source.agency}
                        </div>
                      )}
                      {source.projectType && (
                        <div className="text-xs text-slate-400">
                          {source.projectType}
                        </div>
                      )}
                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-200">
                        {source.filedDate && (
                          <span className="text-xs text-slate-400">
                            {source.dateLabel ?? 'Date'}: {formatDate(source.filedDate)}
                          </span>
                        )}
                        {source.officialUrl && (
                          <a
                            href={source.officialUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
                          >
                            View source →
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
