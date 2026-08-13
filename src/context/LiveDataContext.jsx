import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { getAllLiveBuses, fetchStopETAs, buildEtasFromLiveBuses, getFallbackETAs } from '../services/avanzaApi';
import { SORIA_ALL_STOPS } from '../data/soriaLinesData';

const LiveDataContext = createContext({ 
  liveBuses: [],
  lastUpdated: 0,
  isLoading: false,
  error: null,
  isStale: true,
  getStopETAs: async () => []
});

const INITIAL_POLL_MS = 8000;
const MAX_POLL_MS = 60000;
const STALE_THRESHOLD_MS = 25000;
const DIRECT_ETA_CACHE_MS = 15000;

export function LiveDataProvider({ children }) {
  const [state, setState] = useState({
    liveBuses: [],
    lastUpdated: 0,
    isLoading: true,
    error: null,
    isStale: true
  });

  const stateRef = useRef(state);
  const etasCacheRef = useRef({});

  // Sync state to ref for use in unmounted closures or getStopETAs
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    let mounted = true;
    let timerId = null;
    let currentBackoff = INITIAL_POLL_MS;

    async function poll() {
      if (!mounted) return;
      
      setState(prev => ({ ...prev, isLoading: true }));
      
      try {
        const buses = await getAllLiveBuses();
        if (!mounted) return;

        // Reset backoff on success
        currentBackoff = INITIAL_POLL_MS;
        
        setState(prev => ({
          ...prev,
          liveBuses: buses,
          lastUpdated: Date.now(),
          isLoading: false,
          error: null,
          isStale: false
        }));
      } catch (err) {
        if (!mounted) return;

        // Increase backoff: 8s -> 12s -> 20s -> 30s -> 60s
        if (currentBackoff === 8000) currentBackoff = 12000;
        else if (currentBackoff === 12000) currentBackoff = 20000;
        else if (currentBackoff === 20000) currentBackoff = 30000;
        else if (currentBackoff >= 30000) currentBackoff = MAX_POLL_MS;

        const isNowStale = (Date.now() - stateRef.current.lastUpdated) > STALE_THRESHOLD_MS;
        
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: err,
          isStale: isNowStale
        }));
      }

      timerId = setTimeout(poll, currentBackoff);
    }

    poll();

    return () => {
      mounted = false;
      if (timerId) clearTimeout(timerId);
    };
  }, []);

  const getStopETAs = useCallback(async (stopId) => {
    const targetStop = SORIA_ALL_STOPS.find(s => String(s.id) === String(stopId));
    if (!targetStop) return [];
    const targetLines = targetStop.lines.filter(l => l !== 'LC');

    // 1. Check if direct ETAs are in cache and fresh
    const now = Date.now();
    const cached = etasCacheRef.current[stopId];
    let directData = null;

    if (cached && (now - cached.timestamp < DIRECT_ETA_CACHE_MS)) {
      directData = cached.data;
    } else {
      // 2. Fetch direct ETAs
      try {
        // fetchStopETAs with directOnly=true prevents hub fallback
        const freshlyFetched = await fetchStopETAs(stopId, { directOnly: true });
        etasCacheRef.current[stopId] = {
          data: freshlyFetched,
          timestamp: Date.now()
        };
        directData = freshlyFetched;
      } catch (e) {
        directData = [];
      }
    }

    if (directData && directData.length > 0) {
      return directData;
    }

    // 3. Interpolate from current liveBuses if direct fails
    const currentLiveBuses = stateRef.current.liveBuses;
    if (currentLiveBuses && currentLiveBuses.length > 0 && !stateRef.current.isStale) {
      const interpolated = buildEtasFromLiveBuses(currentLiveBuses, targetStop, targetLines);
      if (interpolated.length > 0) {
        return interpolated;
      }
    }

    // 4. Fallback to schedule
    return getFallbackETAs(stopId);
  }, []);

  return (
    <LiveDataContext.Provider value={{ ...state, getStopETAs }}>
      {children}
    </LiveDataContext.Provider>
  );
}

export function useLiveData() {
  return useContext(LiveDataContext);
}
