import { AppConfig, UserSession, showConnect } from '@stacks/connect';

const appDetails = {
  name: 'Stacks AI Payment Agents',
  icon: typeof window !== 'undefined' ? window.location.origin + '/logo.png' : undefined,
};

// SINGLETON UserSession shared across the app
const appConfig = new AppConfig(['store_write', 'publish_data']);
const userSession = new UserSession({ appConfig });

export function getUserSession() {
  return userSession;
}

export function isSignedIn() {
  try {
    return userSession.isUserSignedIn();
  } catch {
    return false;
  }
}

export function getAgentAddress({ network = 'testnet' } = {}) {
  try {
    // Prefer Leather stored address if present
    const stored = getStoredAddress(network);
    if (stored) return stored;
    const data = userSession.loadUserData();
    if (!data) return null;
    const stx = data.profile?.stxAddress;
    if (!stx) return null;
    return network === 'mainnet' ? stx.mainnet : stx.testnet;
  } catch {
    return null;
  }
}

// ------------- Leather Provider helpers -------------
export function detectLeatherProvider() {
  try {
    const prov = typeof window !== 'undefined' && (window.LeatherProvider || window.StacksProvider);
    return prov && typeof prov.request === 'function' ? prov : null;
  } catch {
    return null;
  }
}

export async function requestLeatherAddresses() {
  const prov = detectLeatherProvider();
  if (!prov) return null;
  try {
    const res = await prov.request('getAddresses');
    return res || null;
  } catch (e) {
    return null;
  }
}

function extractStacksAddress(addresses, network = 'testnet') {
  if (!addresses) return null;
  try {
    // Common shapes from Leather
    return (
      addresses?.addresses?.stacks?.[network]?.[0]?.address ||
      addresses?.stacks?.[network]?.[0]?.address ||
      addresses?.addresses?.[0]?.address || null
    );
  } catch {
    return null;
  }
}

export function saveAddress(addr, network = 'testnet') {
  try {
    if (!addr) return;
    localStorage.setItem('leatherConnected', '1');
    localStorage.setItem(`stxAddress:${network}`, addr);
  } catch {}
}

export function getStoredAddress(network = 'testnet') {
  try {
    return localStorage.getItem(`stxAddress:${network}`);
  } catch {
    return null;
  }
}

export async function connectWithLeatherFirst({ network = 'testnet' } = {}) {
  const addrs = await requestLeatherAddresses();
  if (addrs) {
    const addr = extractStacksAddress(addrs, network);
    if (addr) {
      saveAddress(addr, network);
      return { ok: true, address: addr, via: 'leather' };
    }
  }
  // Fallback to showConnect
  const ok = await connectWallet({});
  if (ok) {
    const addr = getAgentAddress({ network });
    if (addr) saveAddress(addr, network);
  }
  return { ok, address: getAgentAddress({ network }), via: ok ? 'connect' : 'none' };
}

export function connectWallet({ onFinish, onCancel } = {}) {
  return new Promise((resolve) => {
    showConnect({
      appDetails,
      userSession,
      onFinish: () => {
        try { if (onFinish) onFinish(); } catch {}
        resolve(true);
      },
      onCancel: () => {
        try { if (onCancel) onCancel(); } catch {}
        resolve(false);
      },
    });
  });
}
