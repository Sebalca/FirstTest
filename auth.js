// plataforma-core/auth.js — v0.1
// Módulo de autenticação central partilhado entre todos os sites da plataforma.
// Requer o script do Supabase carregado antes deste ficheiro:
// <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>

// ============================================================
// CONFIGURAÇÃO — ajustar estes 3 valores por plataforma
// ============================================================
const PLATAFORMA_CONFIG = {
  SUPABASE_URL: 'https://aehitgqsfcpzuunyzpsh.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlaGl0Z3FzZmNwenV1bnl6cHNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg4OTkzNjUsImV4cCI6MjEwNDQ3NTM2NX0.LDQ9RcIpCVDB92KDa0klRvZFFIAWez69MksRiOdqX_o',
  COOKIE_DOMAIN: '.frisk.pt',
};

// ============================================================
// COOKIE STORAGE — permite que a sessão seja partilhada entre
// subdomínios (ex: site1.teudominio.pt e site2.teudominio.pt),
// ao contrário do localStorage, que é isolado por subdomínio.
// ============================================================
class CookieStorage {
  constructor(domain) {
    this.domain = domain;
    this.chunkSize = 3500;
  }

  getItem(key) {
    const chunkCount = this._getCookie(`${key}.chunks`);
    if (!chunkCount) return this._getCookie(key);
    let value = '';
    for (let i = 0; i < parseInt(chunkCount, 10); i++) {
      value += this._getCookie(`${key}.${i}`) || '';
    }
    return value || null;
  }

  setItem(key, value) {
    this.removeItem(key);
    if (value.length <= this.chunkSize) {
      this._setCookie(key, value);
      return;
    }
    const chunks = [];
    for (let i = 0; i < value.length; i += this.chunkSize) {
      chunks.push(value.slice(i, i + this.chunkSize));
    }
    this._setCookie(`${key}.chunks`, String(chunks.length));
    chunks.forEach((c, i) => this._setCookie(`${key}.${i}`, c));
  }

  removeItem(key) {
    const chunkCount = this._getCookie(`${key}.chunks`);
    if (chunkCount) {
      for (let i = 0; i < parseInt(chunkCount, 10); i++) this._deleteCookie(`${key}.${i}`);
      this._deleteCookie(`${key}.chunks`);
    }
    this._deleteCookie(key);
  }

  _setCookie(name, value) {
    const maxAge = 60 * 60 * 24 * 365;
    const secure = location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${name}=${encodeURIComponent(value)}; Domain=${this.domain}; Path=/; Max-Age=${maxAge}; SameSite=Lax${secure}`;
  }

  _getCookie(name) {
    const escaped = name.replace(/[.]/g, '\\$&');
    const match = document.cookie.match(new RegExp('(^| )' + escaped + '=([^;]+)'));
    return match ? decodeURIComponent(match[2]) : null;
  }

  _deleteCookie(name) {
    document.cookie = `${name}=; Domain=${this.domain}; Path=/; Max-Age=0`;
  }
}

// ============================================================
// CLIENTE SUPABASE — instância única, partilhada por todos os sites
// ============================================================
const cookieStorage = new CookieStorage(PLATAFORMA_CONFIG.COOKIE_DOMAIN);

const plataforma = supabase.createClient(
  PLATAFORMA_CONFIG.SUPABASE_URL,
  PLATAFORMA_CONFIG.SUPABASE_ANON_KEY,
  {
    auth: {
      storage: cookieStorage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);

// ============================================================
// FUNÇÕES DE AUTENTICAÇÃO — API usada pelos sites
// ============================================================
const Auth = {
  async signUp(email, password) {
    return await plataforma.auth.signUp({ email, password });
  },

  async signIn(email, password) {
    return await plataforma.auth.signInWithPassword({ email, password });
  },

  async signInWithGoogle() {
    return await plataforma.auth.signInWithOAuth({ provider: 'google' });
  },

  async signOut() {
    return await plataforma.auth.signOut();
  },

  async getSession() {
    const { data } = await plataforma.auth.getSession();
    return data.session;
  },

  async getUser() {
    const { data } = await plataforma.auth.getUser();
    return data.user;
  },

  onChange(callback) {
    return plataforma.auth.onAuthStateChange((event, session) => callback(event, session));
  },

  // Redireciona para a página de login se não houver sessão ativa.
  // Uso típico no topo de uma página protegida: await Auth.requireAuth('/login.html');
  async requireAuth(loginUrl = '/login.html') {
    const session = await this.getSession();
    if (!session) {
      window.location.href = loginUrl;
      return null;
    }
    return session;
  },
};

// Exposto globalmente para uso direto nos sites
window.plataforma = plataforma;
window.Auth = Auth;
