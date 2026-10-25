import React from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { getAccountHomePage, getPageUrl } from '../navigation.js';

// Keep normal link behavior for copying URLs and opening pages in another tab.
export default function PageLink({ page, onNavigate, onClick, children, ...props }) {
  const { user } = useAuth();
  const destination = page === 'account-home' ? getAccountHomePage(user) : page;
  return <a {...props} href={getPageUrl(destination, { organisationId: user?.activeOrganisationId })} onClick={event => {
    onClick?.(event);
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    onNavigate(page);
  }}>{children}</a>;
}
