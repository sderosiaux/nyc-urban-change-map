/**
 * Main App component
 */

import MapView from './components/MapView';
import SearchBar from './components/SearchBar';
import TimeControl from './components/TimeControl';
import IntensityControl from './components/IntensityControl';
import Legend from './components/Legend';
import DetailPanel from './components/DetailPanel';
import { useViewStore } from './stores/viewStore';

export default function App() {
  const { detailPanelOpen } = useViewStore();

  return (
    <div className="h-screen w-screen relative overflow-hidden">
      {/* Map fills the entire viewport */}
      <MapView />

      {/* Search bar at top */}
      <div className="absolute top-4 left-4 right-4 md:left-1/2 md:-translate-x-1/2 md:w-96 z-10">
        <SearchBar />
      </div>

      {/* Controls at bottom */}
      <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end pointer-events-none z-10">
        {/* Left: Intensity control */}
        <div className="pointer-events-auto">
          <IntensityControl />
        </div>

        {/* Center: Time control */}
        <div className="pointer-events-auto mx-4">
          <TimeControl />
        </div>

        {/* Right: Legend */}
        <div className="pointer-events-auto">
          <Legend />
        </div>
      </div>

      {/* Detail panel (slides in from right) */}
      {detailPanelOpen && <DetailPanel />}
    </div>
  );
}
