const FIREBASE_CONFIG = {
  apiKey: "AIzaSyAMLuIWDn9NoyVf24JWzXx0W0snURiY8Yk",
  authDomain: "teacher-hub-ai-14f7b.firebaseapp.com",
  projectId: "teacher-hub-ai-14f7b",
  appId: "1:522499758575:web:bfe421ffdeb11395157e1a",
};

const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${FIREBASE_CONFIG.projectId}/databases/(default)/documents`;
const FB_SESSION_KEY = "fb-session";

function safeDocId(key) {
  return key.replace(/\//g, "_");
}

async function getIdToken() {
  try {
    const raw = localStorage.getItem(FB_SESSION_KEY);
    if (!raw) return null;
    const rec = JSON.parse(raw);
    if (!rec) return null;
    if (rec.expiresAt - 60000 > Date.now()) return rec.idToken;
    const res = await fetch(
      `https://securetoken.googleapis.com/v1/token?key=${FIREBASE_CONFIG.apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(rec.refreshToken)}`,
      }
    );
    const data = await res.json();
    if (!res.ok) return null;
    const updated = {
      idToken: data.id_token,
      refreshToken: data.refresh_token,
      uid: data.user_id,
      email: rec.email,
      expiresAt: Date.now() + Number(data.expires_in) * 1000,
    };
    localStorage.setItem(FB_SESSION_KEY, JSON.stringify(updated));
    return updated.idToken;
  } catch (e) {
    return null;
  }
}

window.storage = {
  async get(key, shared) {
    if (!shared) {
      const v = localStorage.getItem(key);
      return v ? { value: v } : null;
    }
    const token = await getIdToken();
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const res = await fetch(`${FIRESTORE_BASE}/shared/${safeDocId(key)}`, { headers });
    if (res.status === 404) return null;
    if (!res.ok) return null;
    const data = await res.json();
    const value = data.fields && data.fields.value && data.fields.value.stringValue;
    return value !== undefined ? { value } : null;
  },

  async set(key, value, shared) {
    if (!shared) {
      localStorage.setItem(key, value);
      return { key, value, shared: false };
    }
    const token = await getIdToken();
    const headers = {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
    await fetch(
      `${FIRESTORE_BASE}/shared/${safeDocId(key)}?updateMask.fieldPaths=value`,
      {
        method: "PATCH",
        headers,
        body: JSON.stringify({ fields: { value: { stringValue: value } } }),
      }
    );
    return { key, value, shared: true };
  },

  async delete(key, shared) {
    if (!shared) {
      localStorage.removeItem(key);
      return { key, deleted: true, shared: false };
    }
    const token = await getIdToken();
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    await fetch(`${FIRESTORE_BASE}/shared/${safeDocId(key)}`, { method: "DELETE", headers });
    return { key, deleted: true, shared: true };
  },

  async list() {
    return { keys: [] };
  },
};
