/**
 * IntensityControl - Filter places by transformation intensity
 */

import { useCallback } from 'react';
import { useViewStore } from '../stores/viewStore';

const INTENSITY_PRESETS = [
  { value: 0, label: 'All', description: 'Show everything' },
  { value: 30, label: 'Notable', description: 'Visible changes' },
  { value: 60, label: 'Major', description: 'Significant transformations' },
  { value: 80, label: 'Intense', description: 'Major construction zones' },
];

export default function IntensityControl() {
  const { minIntensity, setMinIntensity } = useViewStore();

  const handleSliderChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setMinIntensity(parseInt(e.target.value, 10));
    },
    [setMinIntensity]
  );

  const handlePresetClick = useCallback(
    (value: number) => {
      setMinIntensity(value);
    },
    [setMinIntensity]
  );

  // Find the active preset (or closest)
  const activePreset = INTENSITY_PRESETS.find((p) => p.value === minIntensity);

  return (
    <div className="bg-white rounded-lg shadow-lg p-4 w-56">
      <h3 className="text-sm font-medium text-slate-900 mb-3">Intensity Filter</h3>

      {/* Preset buttons */}
      <div className="grid grid-cols-2 gap-1 mb-3">
        {INTENSITY_PRESETS.map((preset) => (
          <button
            key={preset.value}
            onClick={() => handlePresetClick(preset.value)}
            className={`px-2 py-1.5 rounded text-xs font-medium transition-colors ${
              minIntensity === preset.value
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {preset.label}
          </button>
        ))}
      </div>

      {/* Current value display */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-slate-500">Minimum</span>
        <span className="text-sm font-medium text-slate-900">{minIntensity}</span>
      </div>

      {/* Slider */}
      <input
        type="range"
        min={0}
        max={100}
        value={minIntensity}
        onChange={handleSliderChange}
        className="w-full h-2 rounded-lg appearance-none cursor-pointer"
        style={{
          background: `linear-gradient(to right, #94a3b8 0%, #fbbf24 30%, #f97316 60%, #dc2626 100%)`,
        }}
      />

      {/* Description */}
      <p className="mt-2 text-xs text-slate-500">
        {activePreset?.description ?? `Showing intensity ${minIntensity}+`}
      </p>
    </div>
  );
}
