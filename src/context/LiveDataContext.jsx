import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { getAllLiveBuses, fetchStopETAs } from '../services/avanzaApi';

const LiveDataContext = createContext({ 
  liveBuses: [],
  lastUpdated: 0,
  isLoading: false,
  error: null,
  isStale: true,
  isDead: true,
  getStopETAs: async () => []
});

const INITIAL_POLL_MS = 8000;
const MAX_POLL_MS = 60000;
const STALE_THRESHOLD_MS = 25000;
const DEAD_THRESHOLD_MS = 120000;
const ETA_CACHE_TTL_MS = 15000;

export function LiveDataProvider({ children }) {
  const [state, setState] = useState({
    liveBuses: [],
    lastUpdated: 0,
    isLoading: true,
    error: null,
    isStale: true,
    isDead: true
  });

  const stateRef = useRef(state);
  const etasCacheRef = useRef({});
  const pendingEtasRef = useRef({});

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
          isStale: false,
          isDead: false
        }));
      } catch (err) {
        if (!mounted) return;

        // Increase backoff: 8s -> 12s -> 20s -> 30s -> 60s
        if (currentBackoff === 8000) currentBackoff = 12000;
        else if (currentBackoff === 12000) currentBackoff = 20000;
        else if (currentBackoff === 20000) currentBackoff = 30000;
        else if (currentBackoff >= 30000) currentBackoff = MAX_POLL_MS;

        const timeSinceUpdate = Date.now() - stateRef.current.lastUpdated;
        const isNowStale = timeSinceUpdate > STALE_THRESHOLD_MS;
        const isNowDead = timeSinceUpdate > DEAD_THRESHOLD_MS;
        
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: err,
          isStale: isNowStale,
          isDead: isNowDead
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
    const key = String(stopId);
    const now = Date.now();

    // 1. Check if cached and within TTL (15 seconds)
    const cached = etasCacheRef.current[key];
    if (cached && (now - cached.timestamp < ETA_CACHE_TTL_MS)) {
      return cached.data;
    }

    // 2. Check if a fetch for this stop is already in-flight (Promise Locking)
    if (pendingEtasRef.current[key]) {
      return pendingEtasRef.current[key];
    }

    // 3. Initiate fetch using the full unconstrained hierarchy
    const fetchPromise = (async () => {
      try {
        const timeSinceLastUpdate = Date.now() - stateRef.current.lastUpdated;
        const isDead = timeSinceLastUpdate > DEAD_THRESHOLD_MS;
        const liveSnapshot = isDead ? [] : stateRef.current.liveBuses;

        const data = await fetchStopETAs(key, { liveBuses: liveSnapshot });
        
        etasCacheRef.current[key] = {
          data,
          timestamp: Date.now()
        };
        return data;
      } catch (error) {
        console.warn(`[LiveDataContext] Failed to fetch ETAs for stop ${key}:`, error);
        return [];
      } finally {
        delete pendingEtasRef.current[key];
      }
    })();

    pendingEtasRef.current[key] = fetchPromise;
    return fetchPromise;
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
