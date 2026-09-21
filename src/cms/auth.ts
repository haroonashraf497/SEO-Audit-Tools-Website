const SESSION_KEY = 'ekstruh:admin-session:v1';
const CREDS_KEY = 'ekstruh:admin-creds:v1';
const RESET_KEY = 'ekstruh:admin-reset:v1';
const REMEMBER_DAYS = 30;
const RESET_MINUTES = 60;

export const DEFAULT_ADMIN_USERNAME = (import.meta.env.VITE_ADMIN_USERNAME as string | undefined)?.trim() || 'admin';
export const DEFAULT_ADMIN_EMAIL = (import.meta.env.VITE_ADMIN_EMAIL as string | undefined)?.trim().toLowerCase() || 'help@seoaudittools.pk';
const DEFAULT_ADMIN_PASSWORD = (import.meta.env.VITE_ADMIN_PASSWORD as string | undefined) || '';

type StoredCreds = { username: string; email: string; passwordHash: string };
type SessionRecord = { user: string; remember: boolean; exp: number };
type ResetRecord = { token: string; exp: number };

const sha256 = async (value: string): Promise<string> => {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
};

const randomToken = (): string => {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
};

const readJson = <T>(storage: Storage, key: string): T | null => {
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

export const getAdminCreds = (fallbackPassword: string): { username: string; email: string; fallbackPassword: string; passwordHash: string | null } => {
  const stored = readJson<StoredCreds>(localStorage, CREDS_KEY);
  return {
    username: stored?.username || DEFAULT_ADMIN_USERNAME,
    email: (stored?.email || DEFAULT_ADMIN_EMAIL).toLowerCase(),
    passwordHash: stored?.passwordHash || null,
    fallbackPassword: DEFAULT_ADMIN_PASSWORD || fallbackPassword || 'admin123',
  };
};

export const saveAdminPassword = async (password: string, username?: string, email?: string): Promise<void> => {
  const current = getAdminCreds('');
  const record: StoredCreds = {
    username: (username || current.username).trim() || DEFAULT_ADMIN_USERNAME,
    email: (email || current.email).trim().toLowerCase() || DEFAULT_ADMIN_EMAIL,
    passwordHash: await sha256(password),
  };
  try { localStorage.setItem(CREDS_KEY, JSON.stringify(record)); } catch { /* quota */ }
};

export const verifyAdminLogin = async (username: string, password: string, fallbackPassword: string): Promise<boolean> => {
  const creds = getAdminCreds(fallbackPassword);
  if (username.trim().toLowerCase() !== creds.username.toLowerCase()) return false;
  if (!password) return false;
  if (creds.passwordHash) return (await sha256(password)) === creds.passwordHash;
  return password === creds.fallbackPassword;
};

export const readAdminSession = (): SessionRecord | null => {
  const now = Date.now();
  const local = readJson<SessionRecord>(localStorage, SESSION_KEY);
  if (local && local.exp > now) return local;
  if (local) try { localStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
  const session = readJson<SessionRecord>(sessionStorage, SESSION_KEY);
  if (session && session.exp > now) return session;
  if (session) try { sessionStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
  return null;
};

export const writeAdminSession = (user: string, remember: boolean): void => {
  const record: SessionRecord = {
    user,
    remember,
    exp: Date.now() + (remember ? REMEMBER_DAYS : 1) * 24 * 60 * 60 * 1000,
  };
  try {
    sessionStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(SESSION_KEY);
    (remember ? localStorage : sessionStorage).setItem(SESSION_KEY, JSON.stringify(record));
  } catch { /* storage blocked */ }
};

export const clearAdminSession = (): void => {
  try { localStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
  try { sessionStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
};

export const issuePasswordReset = (email: string, fallbackPassword: string): string | null => {
  const creds = getAdminCreds(fallbackPassword);
  if (email.trim().toLowerCase() !== creds.email) return null;
  const token = randomToken();
  const record: ResetRecord = { token, exp: Date.now() + RESET_MINUTES * 60 * 1000 };
  try { sessionStorage.setItem(RESET_KEY, JSON.stringify(record)); } catch { /* ignore */ }
  return token;
};

export const consumePasswordReset = (token: string): boolean => {
  const record = readJson<ResetRecord>(sessionStorage, RESET_KEY);
  if (!record || record.token !== token || record.exp < Date.now()) return false;
  try { sessionStorage.removeItem(RESET_KEY); } catch { /* ignore */ }
  return true;
};

export const peekPasswordReset = (token: string): boolean => {
  const record = readJson<ResetRecord>(sessionStorage, RESET_KEY);
  return !!record && record.token === token && record.exp > Date.now();
};
