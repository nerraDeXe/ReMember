const API_BASE = '/api';

// All API calls share authentication, response parsing and expired-session handling.
export async function apiRequest(endpoint, options = {}) {
  const { responseType, ...fetchOptions } = options;
  const token = localStorage.getItem('remember_token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...fetchOptions.headers,
  };

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...fetchOptions,
    headers,
  });

  // Handle binary / csv responses
  const contentType = response.headers.get('content-type') || '';
  if (response.ok && (responseType === 'blob' || contentType.includes('text/csv'))) {
    const blob = await response.blob();
    return responseType === 'blob' ? blob : { ok: response.ok, blob };
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (token && data.code === 'SESSION_EXPIRED') window.dispatchEvent(new CustomEvent('remember:session-expired', { detail: { token } }));
    const error = new Error(data.message || `Request failed with status ${response.status}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

const jsonMethod = (method) => (endpoint, data) => apiRequest(endpoint, {
  method,
  ...(data === undefined ? {} : { body: JSON.stringify(data) }),
});
const post = jsonMethod('POST');
const put = jsonMethod('PUT');
const remove = jsonMethod('DELETE');
const get = (endpoint, params = {}, options) => {
  const query = new URLSearchParams(params).toString();
  return apiRequest(`${endpoint}${query ? `?${query}` : ''}`, options);
};

export const api = {
  // Auth
  login: (credentials) => post('/auth/login', credentials),
  register: (userData) => post('/auth/register', userData),
  getMe: () => apiRequest('/auth/me'),
  verifyEmail: (code) => post('/auth/verify-email', { code }),
  resendVerification: () => post('/auth/resend-verification', {}),
  forgotPassword: (email) => post('/auth/forgot-password', { email }),
  resetPassword: (token, password) => post('/auth/reset-password', { token, password }),
  getGoogleConfig: () => apiRequest('/auth/google/config'),
  googleSignIn: (data) => post('/auth/google', data),
  googleRegister: (data) => post('/auth/google/register', data),

  // Members
  getMemberDashboard: () => apiRequest('/members/dashboard'),
  updateProfile: (profileData) => put('/members/profile', profileData),
  getWalletPass: () => apiRequest('/members/wallet-pass'),
  getMemberInvoices: () => apiRequest('/members/invoices'),
  downloadInvoice: (id) => apiRequest(`/members/invoices/${id}/download`),

  // Tiers
  getTiers: (organisationId) => get('/tiers', organisationId ? { organisationId } : {}),
  createTier: (tierData) => post('/tiers', tierData),
  updateTier: (id, tierData) => put(`/tiers/${id}`, tierData),
  deleteTier: (id) => remove(`/tiers/${id}`),

  // Events
  searchEventLocations: (query, organisationId) => get('/events/locations/search', { q: query, ...(organisationId ? { organisationId } : {}) }),
  getEvents: (organisationId) => get('/events', organisationId ? { organisationId } : {}),
  rsvpEvent: (id, organisationId) => post(`/events/${id}/rsvp`, organisationId ? { organisationId } : undefined),
  cancelRsvpEvent: (id, organisationId) => post(`/events/${id}/cancel-rsvp`, organisationId ? { organisationId } : undefined),
  createEvent: (eventData) => post('/events', eventData),
  updateEvent: (id, eventData) => put(`/events/${id}`, eventData),
  deleteEvent: (id, organisationId) => remove(`/events/${id}${organisationId ? `?${new URLSearchParams({ organisationId })}` : ''}`),

  // Payments
  processRenewal: (paymentData) => post('/payments/renew', paymentData),

  // Wallet
  syncWalletObject: (memberId) => put(`/wallet/update-object/${memberId}`),

  // Admin
  getAdminMembers: (params) => get('/admin/members', params),
  updateMemberStatus: (id, status, reason) => put(`/admin/members/${id}/status`, { status, reason }),
  updateMemberTier: (id, tierId) => put(`/admin/members/${id}/tier`, { tierId }),
  getFinancialSummary: () => apiRequest('/admin/financial-summary'),
  getDashboardAnalytics: (range = {}) => get('/admin/dashboard-analytics', range),
  getActivityLogs: (params) => get('/admin/activity-logs', params),
  exportMembersCsv: (params) => get('/admin/export-csv', params, { responseType: 'blob' }),

  // Organisation communication
  getPosts: (params) => get('/posts', params),
  createPost: (data) => post('/posts', data),
  updatePost: (id, data) => put(`/posts/${encodeURIComponent(id)}`, data),
  deletePost: (id, organisationId) => apiRequest(`/posts/${encodeURIComponent(id)}${organisationId ? `?${new URLSearchParams({ organisationId })}` : ''}`, { method: 'DELETE' }),

  // Organisations
  getOrganisations: (params) => get('/organisations', params),
  getOrganisationCategories: () => apiRequest('/organisations/categories'),
  getOrganisation: (id) => apiRequest(`/organisations/${id}`),
  createOrganisation: (data) => post('/organisations', data),
  joinOrganisation: (id, tierId) => post(`/organisations/${id}/join`, { tierId }),
  selectOrganisation: (organisationId) => post('/organisations/select', { organisationId }),
  completeOnboarding: () => post('/organisations/onboarding-complete', {}),
  updateOrganisation: (id, data) => put(`/organisations/${id}`, data),
  getOrganisationEmailSettings: (id) => apiRequest(`/organisations/${encodeURIComponent(id)}/email-settings`),
  updateOrganisationEmailSettings: (id, data) => put(`/organisations/${encodeURIComponent(id)}/email-settings`, data),
  updateOrganisationVisibility: (id, isPublic) => put(`/organisations/${id}/visibility`, { isPublic, visibility: isPublic ? 'public' : 'private' }),
  deleteOrganisation: (id) => remove(`/organisations/${id}`),
};

