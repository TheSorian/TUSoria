import React, { createContext, useContext, useEffect, useState } from 'react';
import { getAllLiveBuses } from '../services/avanzaApi';

const LiveDataContext = createContext({ liveBuses: [] });

const POLL_INTERVAL_MS = 8000;

export function LiveDataProvider({ children }) {
  const [liveBuses, setLiveBuses] = useState([]);

  useEffect(() => {
    let mounted = true;

    async function poll() {
      const buses = await getAllLiveBuses();
      if (mounted) setLiveBuses(buses);
    }

    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <LiveDataContext.Provider value={{ liveBuses }}>
      {children}
    </LiveDataContext.Provider>
  );
}

export function useLiveData() {
  return useContext(LiveDataContext);
}
