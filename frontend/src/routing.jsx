import React, { createContext, useCallback, useContext, useEffect, useState, useSyncExternalStore } from 'react';
import { createBrowserNavigation } from './browserHistory.js';
import { getPageUrl } from './navigation.js';

const NavigationContext = createContext(null);

export function NavigationProvider({ children }) {
  const [navigation] = useState(() => createBrowserNavigation(window));
  return <NavigationContext.Provider value={navigation}>{children}</NavigationContext.Provider>;
}

export function useNavigation() {
  const navigation = useContext(NavigationContext);
  if (!navigation) throw new Error('NavigationProvider is required.');
  const route = useSyncExternalStore(navigation.subscribe, navigation.getSnapshot, navigation.getSnapshot);
  useEffect(() => {
    if (route.legacy) navigation.navigate(getPageUrl(route.page, { query: route.query }), { replace: true });
  }, [route.legacy, route.page, route.query, navigation]);
  return { ...navigation, route };
}

export function useUrlQuery() {
  const { route, updateQuery, closeQuery } = useNavigation();
  return { query: route.query, updateQuery, closeQuery };
}

export function useUrlState(key, defaultValue = '', { replace = false } = {}) {
  const { route, getSnapshot, updateQuery } = useNavigation();
  const value = route.query.get(key) ?? defaultValue;
  const setValue = useCallback((next, options = {}) => {
    const previous = getSnapshot().query.get(key) ?? defaultValue;
    const resolved = typeof next === 'function' ? next(previous) : next;
    updateQuery({ [key]: resolved === defaultValue ? null : resolved }, { replace, ...options });
  }, [key, defaultValue, replace, getSnapshot, updateQuery]);
  return [value, setValue];
}
