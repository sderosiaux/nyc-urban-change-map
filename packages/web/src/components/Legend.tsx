/**
 * Legend - Visual guide for map symbols
 */

const INTENSITY_SCALE = [
  { value: 0, color: '#94a3b8', label: 'Minimal' },
  { value: 30, color: '#fbbf24', label: 'Notable' },
  { value: 60, color: '#f97316', label: 'Major' },
  { value: 80, color: '#dc2626', label: 'Intense' },
];

const CERTAINTY_LEVELS = [
  { level: 'discussion', opacity: 0.4, label: 'Under discussion' },
  { level: 'probable', opacity: 0.7, label: 'Likely to happen' },
  { level: 'certain', opacity: 1.0, label: 'Approved' },
];

export default function Legend() {
  return (
    <div className="bg-white rounded-lg shadow-lg p-4 w-48">
      <h3 className="text-sm font-medium text-slate-900 mb-3">Legend</h3>

      {/* Intensity scale */}
      <div className="mb-4">
        <h4 className="text-xs text-slate-500 uppercase tracking-wide mb-2">
          Intensity
        </h4>
        <div className="space-y-1.5">
          {INTENSITY_SCALE.map((item) => (
            <div key={item.value} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-xs text-slate-600">{item.label}</span>
            </div>
          ))}
        </div>
        {/* Gradient bar */}
        <div
          className="mt-2 h-2 rounded-full"
          style={{
            background: `linear-gradient(to right, #94a3b8, #fbbf24, #f97316, #dc2626)`,
          }}
        />
        <div className="flex justify-between mt-1 text-xs text-slate-400">
          <span>0</span>
          <span>100</span>
        </div>
      </div>

      {/* Certainty levels */}
      <div>
        <h4 className="text-xs text-slate-500 uppercase tracking-wide mb-2">
          Certainty
        </h4>
        <div className="space-y-1.5">
          {CERTAINTY_LEVELS.map((item) => (
            <div key={item.level} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full flex-shrink-0 bg-orange-500"
                style={{ opacity: item.opacity }}
              />
              <span className="text-xs text-slate-600">{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Size indicator */}
      <div className="mt-4 pt-3 border-t border-slate-100">
        <h4 className="text-xs text-slate-500 uppercase tracking-wide mb-2">
          Size = Intensity
        </h4>
        <div className="flex items-end gap-2 justify-center">
          <div className="w-2 h-2 rounded-full bg-slate-400" />
          <div className="w-3 h-3 rounded-full bg-amber-400" />
          <div className="w-4 h-4 rounded-full bg-orange-500" />
          <div className="w-5 h-5 rounded-full bg-red-600" />
        </div>
      </div>
    </div>
  );
}
