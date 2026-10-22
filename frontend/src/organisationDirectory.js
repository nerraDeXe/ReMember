const SEARCH_FIELDS = ['name', 'description', 'category', 'location', 'tags'];

/** Shared directory filtering; callers choose the fields their search covers. */
export function filterOrganisations(organisations, { search = '', category = 'All', visibility = 'all', fields = SEARCH_FIELDS } = {}) {
  const query = search.trim().toLowerCase();
  return organisations.filter(org => {
    const isPublic = org.isPublic === true || org.visibility === 'public';
    if (visibility === 'public' && !isPublic) return false;
    if (visibility === 'private' && isPublic) return false;
    if (category !== 'All' && org.category !== category) return false;
    return !query || fields.some(field => {
      const value = org[field];
      return (Array.isArray(value) ? value : [value]).some(text => String(text || '').toLowerCase().includes(query));
    });
  });
}
