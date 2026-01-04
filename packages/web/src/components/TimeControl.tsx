/**
 * TimeControl - Navigate through time (past, present, future)
 */

import { useCallback } from 'react';
import { useViewStore } from '../stores/viewStore';
import type { TimeMode } from '@ucm/shared';

const TIME_MODES: { id: TimeMode; label: string; description: string }[] = [
  { id: 'past', label: 'Past', description: 'What has changed' },
  { id: 'now', label: 'Now', description: 'Currently transforming' },
  { id: 'future', label: 'Future', description: 'What is planned' },
];

export default function TimeControl() {
  const { timeMode, setTimeMode, selectedYear, setSelectedYear } = useViewStore();

  const handleModeChange = useCallback(
    (mode: TimeMode) => {
      setTimeMode(mode);
    },
    [setTimeMode]
  );

  const handleYearChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSelectedYear(parseInt(e.target.value, 10));
    },
    [setSelectedYear]
  );

  const currentYear = new Date().getFullYear();
  const minYear = 2000;
  const maxYear = 2035;

  return (
    <div className="bg-white rounded-lg shadow-lg p-4 min-w-64">
      {/* Time mode selector */}
      <div className="flex gap-1 mb-3">
        {TIME_MODES.map((mode) => (
          <button
            key={mode.id}
            onClick={() => handleModeChange(mode.id)}
            className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              timeMode === mode.id
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {mode.label}
          </button>
        ))}
      </div>

      {/* Mode description */}
      <p className="text-sm text-slate-500 mb-3">
        {TIME_MODES.find((m) => m.id === timeMode)?.description}
      </p>

      {/* Year slider (only for past/future) */}
      {timeMode !== 'now' && (
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm text-slate-600">
              {timeMode === 'past' ? 'Since' : 'Until'}
            </span>
            <span className="text-sm font-medium text-slate-900">{selectedYear}</span>
          </div>
          <input
            type="range"
            min={minYear}
            max={maxYear}
            value={selectedYear}
            onChange={handleYearChange}
            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-slate-900"
          />
          <div className="flex justify-between text-xs text-slate-400">
            <span>{minYear}</span>
            <span className="text-slate-600">{currentYear}</span>
            <span>{maxYear}</span>
          </div>
        </div>
      )}

    </div>
  );
}
