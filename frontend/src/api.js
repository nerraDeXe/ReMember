const API_BASE = '/api';

/**
 * Enhanced fetch wrapper with JWT Authorization header injection
 */
export async function apiRequest(endpoint, options = {}) {
  const token = localStorage.getItem('remember_token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  // Handle binary / csv responses
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('text/csv')) {
    const blob = await response.blob();
    return { ok: response.ok, blob };
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data.message || `Request failed with status ${response.status}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

export const api = {
  // Auth
  login: (credentials) => apiRequest('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),
  register: (userData) => apiRequest('/auth/register', { method: 'POST', body: JSON.stringify(userData) }),
  getMe: () => apiRequest('/auth/me'),
  verifyEmail: (code) => apiRequest('/auth/verify-email', { method: 'POST', body: JSON.stringify({ code }) }),
  resendVerification: () => apiRequest('/auth/resend-verification', { method: 'POST', body: '{}' }),

  // Members
  getMemberDashboard: () => apiRequest('/members/dashboard'),
  updateProfile: (profileData) => apiRequest('/members/profile', { method: 'PUT', body: JSON.stringify(profileData) }),
  getWalletPass: () => apiRequest('/members/wallet-pass'),
  getMemberInvoices: () => apiRequest('/members/invoices'),
  downloadInvoice: (id) => apiRequest(`/members/invoices/${id}/download`),

  // Tiers
  getTiers: (organisationId) => apiRequest(`/tiers${organisationId ? `?organisationId=${encodeURIComponent(organisationId)}` : ''}`),
  createTier: (tierData) => apiRequest('/tiers', { method: 'POST', body: JSON.stringify(tierData) }),
  updateTier: (id, tierData) => apiRequest(`/tiers/${id}`, { method: 'PUT', body: JSON.stringify(tierData) }),
  deleteTier: (id) => apiRequest(`/tiers/${id}`, { method: 'DELETE' }),

  // Events
  getEvents: () => apiRequest('/events'),
  rsvpEvent: (id) => apiRequest(`/events/${id}/rsvp`, { method: 'POST' }),
  cancelRsvpEvent: (id) => apiRequest(`/events/${id}/cancel-rsvp`, { method: 'POST' }),
  createEvent: (eventData) => apiRequest('/events', { method: 'POST', body: JSON.stringify(eventData) }),
  updateEvent: (id, eventData) => apiRequest(`/events/${id}`, { method: 'PUT', body: JSON.stringify(eventData) }),
  deleteEvent: (id) => apiRequest(`/events/${id}`, { method: 'DELETE' }),

  // Payments
  processRenewal: (paymentData) => apiRequest('/payments/renew', { method: 'POST', body: JSON.stringify(paymentData) }),

  // Wallet
  syncWalletObject: (memberId) => apiRequest(`/wallet/update-object/${memberId}`, { method: 'PUT' }),

  // Admin
  getAdminMembers: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiRequest(`/admin/members?${query}`);
  },
  updateMemberStatus: (id, status, reason) => apiRequest(`/admin/members/${id}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status, reason })
  }),
  updateMemberTier: (id, tierId) => apiRequest(`/admin/members/${id}/tier`, {
    method: 'PUT',
    body: JSON.stringify({ tierId })
  }),
  getFinancialSummary: () => apiRequest('/admin/financial-summary'),
  getActivityLogs: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiRequest(`/admin/activity-logs?${query}`);
  },
  exportMembersCsv: async (params = {}) => {
    const query = new URLSearchParams(params).toString();
    const token = localStorage.getItem('remember_token');
    const res = await fetch(`${API_BASE}/admin/export-csv?${query}`, {
      headers: {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      }
    });
    if (!res.ok) throw new Error('Failed to export CSV');
    return res.blob();
  },

  // Emails
  getEmails: () => apiRequest('/emails'),

  // Organisations
  getOrganisations: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiRequest(`/organisations?${query}`);
  },
  getOrganisationCategories: () => apiRequest('/organisations/categories'),
  getOrganisation: (id) => apiRequest(`/organisations/${id}`),
  createOrganisation: (data) => apiRequest('/organisations', { method: 'POST', body: JSON.stringify(data) }),
  joinOrganisation: (id, tierId) => apiRequest(`/organisations/${id}/join`, { method: 'POST', body: JSON.stringify({ tierId }) }),
  selectOrganisation: (organisationId) => apiRequest('/organisations/select', { method: 'POST', body: JSON.stringify({ organisationId }) }),
  completeOnboarding: () => apiRequest('/organisations/onboarding-complete', { method: 'POST', body: '{}' }),
  updateOrganisation: (id, data) => apiRequest(`/organisations/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  updateOrganisationVisibility: (id, isPublic) => apiRequest(`/organisations/${id}/visibility`, {
    method: 'PUT',
    body: JSON.stringify({ isPublic, visibility: isPublic ? 'public' : 'private' })
  }),
  deleteOrganisation: (id) => apiRequest(`/organisations/${id}`, { method: 'DELETE' }),
};

