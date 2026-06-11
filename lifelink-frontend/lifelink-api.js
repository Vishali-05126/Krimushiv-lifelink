const LL = (() => {
  const origin = (() => {
    if (window.LIFELINK_API_ORIGIN) return window.LIFELINK_API_ORIGIN;
    if (window.location.protocol === 'file:') return 'http://localhost:5000';
    if (['3000', '5173', '5500'].includes(window.location.port)) return 'http://localhost:5000';
    return window.location.origin;
  })();

  const apiBase = `${origin}/api`;
  const tokenKey = 'll_token';
  const userKey = 'll_user';

  function getToken() {
    return localStorage.getItem(tokenKey);
  }

  function getUser() {
    try {
      return JSON.parse(localStorage.getItem(userKey) || 'null');
    } catch (_err) {
      return null;
    }
  }

  function saveUser(user) {
    localStorage.setItem(userKey, JSON.stringify(user));
  }

  function setSession(data) {
    if (data.token) localStorage.setItem(tokenKey, data.token);
    if (data.user) saveUser(data.user);
  }

  function dashboardUrl(user = getUser()) {
    const role = typeof user === 'string' ? user : user?.role;
    const dashboardHash = {
      donor: 'donor',
      receiver: 'receiver',
      hospital: 'hospital',
      bloodbank: 'bloodbank',
      admin: 'admin',
    }[role] || 'overview';
    return `./dashboard.html#${dashboardHash}`;
  }

  function goToDashboard(user = getUser()) {
    window.location.replace(dashboardUrl(user));
  }

  function clearSession() {
    localStorage.removeItem(tokenKey);
    localStorage.removeItem(userKey);
  }

  async function request(path, options = {}) {
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;

    const response = await fetch(`${apiBase}${path}`, {
      ...options,
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    const contentType = response.headers.get('content-type') || '';
    const data = contentType.includes('application/json')
      ? await response.json()
      : { message: await response.text() };

    if (!response.ok) {
      if (response.status === 401) clearSession();
      throw new Error(data.message || `Request failed`);
    }

    return data;
  }

  function toQuery(params = {}) {
    const search = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') search.set(key, value);
    });
    const query = search.toString();
    return query ? `?${query}` : '';
  }

  function formatDate(value) {
    if (!value) return 'Not recorded';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Not recorded';
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function daysSince(value) {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return Math.floor((Date.now() - date.getTime()) / 86400000);
  }

  function donationStatus(lastDonation) {
    const days = daysSince(lastDonation);
    if (days === null) return 'No donation recorded yet';
    if (days < 90) return `Last donation was ${days} days ago. Rest before the next one.`;
    return `Last donation was ${days} days ago. Eligible for a new donation.`;
  }

  function requireAuth() {
    if (!getToken()) window.location.href = './login.html';
  }

  function redirectIfAuthed() {
    if (getToken()) goToDashboard();
  }

  function logout() {
    clearSession();
    window.location.href = './login.html';
  }

  return {
    origin,
    apiBase,
    getToken,
    getUser,
    setSession,
    dashboardUrl,
    goToDashboard,
    clearSession,
    request,
    formatDate,
    daysSince,
    donationStatus,
    requireAuth,
    redirectIfAuthed,
    logout,
    login: (payload) => request('/auth/login', { method: 'POST', body: payload }).then((data) => {
      setSession(data);
      return data;
    }),
    register: (payload) => request('/auth/register', { method: 'POST', body: payload }).then((data) => {
      setSession(data);
      return data;
    }),
    me: () => request('/auth/me').then((data) => {
      if (data.user) saveUser(data.user);
      return data;
    }),
    updateDonation: (payload) => request('/auth/donation', { method: 'PUT', body: payload }).then((data) => {
      if (data.user) saveUser(data.user);
      return data;
    }),
    loadAlerts: (params) => request(`/alerts${toQuery(params)}`),
    acceptAlert: (id) => request(`/alerts/${id}/accept`, { method: 'PUT' }).then((data) => {
      if (data.user) saveUser(data.user);
      return data;
    }),
    rejectAlert: (id) => request(`/alerts/${id}/reject`, { method: 'PUT' }),
    fulfillAlert: (id) => request(`/alerts/${id}/fulfill`, { method: 'PUT' }),
    loadBloodBank: () => request('/bloodbank/features'),
    createBloodRecord: (payload) => request('/bloodbank/records', { method: 'POST', body: payload }),
    aiTriage: (payload) => request('/ai/triage', { method: 'POST', body: payload }),
    aiShortcastForecast: () => request('/ai/shortage-forecast'),
    aiDonorMatchExplain: (payload) => request('/ai/donor-match-explain', { method: 'POST', body: payload }),
  };
})();

window.LL = LL;
