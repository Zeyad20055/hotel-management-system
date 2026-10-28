import { useCallback, useEffect, useState } from 'react';
import api, { errMsg } from '../api/client.js';

export function useDebounced(value, ms = 350) {
  const [v, setV] = useState(value);
  useEffect(() => { const id = setTimeout(() => setV(value), ms); return () => clearTimeout(id); }, [value, ms]);
  return v;
}

/** Server-driven list with pagination, filters and sorting. */
export function useList(url, initial = {}, enabled = true) {
  const [params, setParams] = useState({ page: 1, limit: 10, ...initial });
  const [state, setState] = useState({ data: [], meta: null, loading: true, error: null });
  const key = JSON.stringify(params);

  const load = useCallback(async () => {
    setState((p) => ({ ...p, loading: true }));
    try {
      const clean = Object.fromEntries(Object.entries(JSON.parse(key)).filter(([, v]) => v !== '' && v != null));
      const r = await api.get(url, { params: clean });
      setState({ data: r.data.data, meta: r.data.meta, loading: false, error: null });
    } catch (e) { setState((p) => ({ ...p, loading: false, error: errMsg(e) })); }
  }, [url, key]);

  useEffect(() => { if (enabled) load(); }, [load, enabled]);
  return {
    ...state, params, reload: load,
    set: (patch) => setParams((p) => ({ ...p, page: 1, ...patch })),
    setPage: (page) => setParams((p) => ({ ...p, page })),
  };
}

export function useFetch(url, deps = [], enabled = true) {
  const [s, setS] = useState({ data: null, loading: true, error: null });
  const load = useCallback(async () => {
    setS((p) => ({ ...p, loading: true }));
    try { setS({ data: (await api.get(url)).data.data, loading: false, error: null }); } catch (e) { setS({ data: null, loading: false, error: errMsg(e) }); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, ...deps]);
  useEffect(() => { if (enabled) load(); }, [load, enabled]);
  return { ...s, reload: load };
}
