/**
 * SearchBar - Search for places and neighborhoods
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useSearch } from '../hooks/useMapData';
import { useViewStore } from '../stores/viewStore';
import type { SearchResult } from '../api/client';

export default function SearchBar() {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: searchData, isLoading } = useSearch(query);
  const { setViewport, selectPlace } = useViewStore();

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    setIsOpen(e.target.value.length >= 2);
  }, []);

  const handleResultClick = useCallback(
    (result: SearchResult) => {
      // Fly to the location
      setViewport({
        latitude: result.latitude,
        longitude: result.longitude,
        zoom: result.type === 'neighborhood' ? 14 : 16,
      });

      // If it's a place, select it
      if (result.type === 'place') {
        selectPlace(result.id);
      }

      // Clear search
      setQuery('');
      setIsOpen(false);
    },
    [setViewport, selectPlace]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        inputRef.current?.blur();
      }
    },
    []
  );

  const results = searchData?.results ?? [];

  return (
    <div ref={containerRef} className="relative">
      {/* Search input */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={() => query.length >= 2 && setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search places, neighborhoods..."
          className="w-full px-4 py-3 pl-10 bg-white rounded-lg shadow-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-slate-900 placeholder-slate-400"
        />
        {/* Search icon */}
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        {/* Loading spinner */}
        {isLoading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="w-5 h-5 border-2 border-slate-300 border-t-blue-500 rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* Results dropdown */}
      {isOpen && results.length > 0 && (
        <div className="absolute top-full mt-2 w-full bg-white rounded-lg shadow-lg border border-slate-200 max-h-80 overflow-y-auto z-50">
          {results.map((result) => (
            <button
              key={result.id}
              onClick={() => handleResultClick(result)}
              className="w-full px-4 py-3 text-left hover:bg-slate-50 border-b border-slate-100 last:border-b-0 transition-colors"
            >
              <div className="flex items-start gap-3">
                {/* Type icon */}
                <div
                  className={`mt-0.5 w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                    result.type === 'neighborhood'
                      ? 'bg-purple-100 text-purple-600'
                      : 'bg-orange-100 text-orange-600'
                  }`}
                >
                  {result.type === 'neighborhood' ? (
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
                        clipRule="evenodd"
                      />
                    </svg>
                  ) : (
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
                    </svg>
                  )}
                </div>
                {/* Result info */}
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-slate-900 truncate">{result.name}</div>
                  <div className="text-sm text-slate-500 truncate">
                    {result.address && <span>{result.address} · </span>}
                    {result.neighborhood && <span>{result.neighborhood} · </span>}
                    {result.borough}
                  </div>
                </div>
                {/* Intensity badge for places */}
                {result.type === 'place' && result.intensity !== undefined && (
                  <div
                    className={`px-2 py-0.5 rounded text-xs font-medium ${
                      result.intensity >= 60
                        ? 'bg-red-100 text-red-700'
                        : result.intensity >= 30
                          ? 'bg-orange-100 text-orange-700'
                          : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {result.intensity}
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* No results message */}
      {isOpen && query.length >= 2 && !isLoading && results.length === 0 && (
        <div className="absolute top-full mt-2 w-full bg-white rounded-lg shadow-lg border border-slate-200 p-4 text-center text-slate-500">
          No results found for "{query}"
        </div>
      )}
    </div>
  );
}
