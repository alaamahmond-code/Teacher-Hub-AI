import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  LayoutGrid, Users, Layers, Calendar, Menu, Plus, X, Lock, Shield, Eye,
  BarChart2, LogOut, Upload, Check, XCircle, Clock, UserPlus, FolderPlus,
  ClipboardCheck, Sparkles, Settings, CreditCard, Award, ChevronRight, Bell, Wallet, RefreshCw, Search,
  GraduationCap, Copy, Send, ToggleLeft, ToggleRight, MailCheck,
} from "lucide-react";

// ================= Firebase Authentication (REST API) =================
// Fill this in with the values from Firebase Console → Project settings →
// General → "Your apps" → Web app (see setup notes shared with you).
// This config is NOT a secret — Firebase's client config is meant to be
// public; real protection comes from Firebase's own security rules.
// NOTE: we call Firebase's plain REST API (Identity Toolkit) via fetch()
// instead of the JS SDK, because this sandbox can't load external JS
// modules from a CDN — fetch() to HTTPS APIs works fine though.
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyAMLuIWDn9NoyVf24JWzXx0W0snURiY8Yk",
  authDomain: "teacher-hub-ai-14f7b.firebaseapp.com",
  projectId: "teacher-hub-ai-14f7b",
  appId: "1:522499758575:web:bfe421ffdeb11395157e1a",
};

const IDTOOLKIT = "https://identitytoolkit.googleapis.com/v1";
const SECURETOKEN = "https://securetoken.googleapis.com/v1";

async function fbCall(path, body) {
  if (!FIREBASE_CONFIG.apiKey) {
    throw { message: "لم يتم إعداد Firebase بعد لهذا التطبيق." };
  }
  const res = await fetch(`${IDTOOLKIT}/${path}?key=${FIREBASE_CONFIG.apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    throw { message: (data.error && data.error.message) || "AUTH_ERROR" };
  }
  return data;
}

async function fbSignUp(email, password) {
  return fbCall("accounts:signUp", { email, password, returnSecureToken: true });
}
async function fbSignIn(email, password) {
  return fbCall("accounts:signInWithPassword", { email, password, returnSecureToken: true });
}
async function fbSendVerification(idToken) {
  return fbCall("accounts:sendOobCode", { requestType: "VERIFY_EMAIL", idToken });
}
async function fbSendPasswordReset(email) {
  return fbCall("accounts:sendOobCode", { requestType: "PASSWORD_RESET", email });
}
async function fbLookup(idToken) {
  const data = await fbCall("accounts:lookup", { idToken });
  return (data.users && data.users[0]) || null;
}
async function fbUpdateProfile(idToken, displayName) {
  return fbCall("accounts:update", { idToken, displayName, returnSecureToken: true });
}
async function fbRefreshToken(refreshToken) {
  const res = await fetch(`${SECURETOKEN}/token?key=${FIREBASE_CONFIG.apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(refreshToken)}`,
  });
  const data = await res.json();
  if (!res.ok) throw { message: (data.error && data.error.message) || "AUTH_ERROR" };
  return data; // { id_token, refresh_token, user_id, expires_in }
}

function firebaseErrorMessage(e) {
  const msg = (e && e.message) || "";
  const key = msg.split(" ")[0].split(":")[0];
  const map = {
    EMAIL_EXISTS: "البريد الإلكتروني مستخدم بالفعل",
    EMAIL_NOT_FOUND: "لا يوجد حساب بهذا البريد الإلكتروني",
    INVALID_PASSWORD: "بيانات الدخول غير صحيحة",
    INVALID_LOGIN_CREDENTIALS: "بيانات الدخول غير صحيحة",
    INVALID_EMAIL: "البريد الإلكتروني غير صحيح",
    WEAK_PASSWORD: "كلمة المرور ضعيفة جدًا",
    USER_DISABLED: "هذا الحساب معطّل",
    TOO_MANY_ATTEMPTS_TRY_LATER: "محاولات كثيرة جدًا، حاول لاحقًا",
    "لم يتم إعداد Firebase بعد لهذا التطبيق.": "لم يتم إعداد Firebase بعد لهذا التطبيق.",
  };
  return map[key] || msg || "حدث خطأ غير متوقع";
}


async function loadKey(key, fallback, shared) {
  try {
    const res = await window.storage.get(key, shared);
    if (!res) return fallback;
    return JSON.parse(res.value);
  } catch (e) {
    return fallback;
  }
}
async function saveKey(key, value, shared) {
  try {
    await window.storage.set(key, JSON.stringify(value), shared);
  } catch (e) {
    console.error("storage save failed", e);
  }
}

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const todayISO = () => new Date().toISOString().slice(0, 10);
const TRIAL_DAYS = 7;
const TAB_COLORS = ["#2f5fd6", "#1fae66", "#d4a017", "#8b6fe0", "#e05260", "#2fb6c9"];
const STATUS_CYCLE = ["none", "present", "absent", "late"];
const STATUS_META = {
  none: { label: "—", color: "rgba(238,241,247,0.25)" },
  present: { label: "حاضر", color: "#1fae66" },
  absent: { label: "غائب", color: "#e05260" },
  late: { label: "متأخر", color: "#d4a017" },
};

function daysLeft(trialStart) {
  const start = new Date(trialStart).getTime();
  const now = Date.now();
  const passed = Math.floor((now - start) / 86400000);
  return Math.max(0, TRIAL_DAYS - passed);
}

function addMonthsToDate(isoDate, months) {
  const d = new Date(isoDate + "T00:00:00");
  d.setMonth(d.getMonth() + months);
  return d;
}

function fileToCompressedBase64(file, maxWidth = 900, quality = 0.72) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let w = img.width, h = img.height;
        if (w > maxWidth) {
          h = Math.round((h * maxWidth) / w);
          w = maxWidth;
        }
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const DEFAULT_ADMIN_EMAIL = "alaamahmond@gmail.com";
const FB_SESSION_KEY = "fb-session"; // personal (non-shared) storage: {idToken, refreshToken, uid, email, expiresAt}

// ================= Root =================
export default function App() {
  const [booted, setBooted] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [users, setUsers] = useState([]);
  const [session, setSession] = useState(null);
  const [pendingUser, setPendingUser] = useState(null); // {idToken, refreshToken, uid, email} — signed in but not verified
  const [view, setView] = useState("landing");
  const [toast, setToast] = useState(null);
  const [fbError, setFbError] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setShowSplash(false), 1700);
    return () => clearTimeout(t);
  }, []);

  const showToast = (msg, type = "info") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2600);
  };

  const refreshUsers = useCallback(async () => {
    const list = await loadKey("users", [], true);
    setUsers(list);
    return list;
  }, []);

  // build/refresh a local profile (role, trial, subscription) for a verified account
  const syncProfile = useCallback(async (fbUser) => {
    const list = await loadKey("users", [], true);
    let profile = list.find((u) => u.id === fbUser.uid);
    const isDefaultAdmin = (fbUser.email || "").toLowerCase() === DEFAULT_ADMIN_EMAIL;
    if (!profile) {
      const emailKey = (fbUser.email || "").toLowerCase();
      const pending = await loadKey(`pending-role:${emailKey}`, null, true);
      profile = {
        id: fbUser.uid,
        username: fbUser.email,
        fullName: fbUser.displayName || "",
        role: isDefaultAdmin ? "admin" : (pending?.role || "teacher"),
        isSuperAdmin: isDefaultAdmin,
        trialStart: new Date().toISOString(),
        subscribed: false,
        ...(pending?.teacherId ? { teacherId: pending.teacherId } : {}),
        ...(pending?.phone ? { phone: pending.phone } : {}),
      };
      await saveKey("users", [...list, profile], true);
      if (pending) await saveKey(`pending-role:${emailKey}`, null, true); // consume marker
    } else if (isDefaultAdmin && (!profile.isSuperAdmin || profile.role !== "admin")) {
      profile = { ...profile, role: "admin", isSuperAdmin: true };
      await saveKey("users", list.map((u) => (u.id === fbUser.uid ? profile : u)), true);
    }
    await refreshUsers();
    return profile;
  }, [refreshUsers]);

  const saveFbSession = async (data) => {
    // data: { id_token/idToken, refresh_token/refreshToken, user_id/localId/uid, email, expires_in/expiresIn }
    const idToken = data.idToken || data.id_token;
    const refreshToken = data.refreshToken || data.refresh_token;
    const uid = data.localId || data.user_id || data.uid;
    const expiresIn = Number(data.expiresIn || data.expires_in || 3600);
    const rec = { idToken, refreshToken, uid, email: data.email, expiresAt: Date.now() + expiresIn * 1000 };
    await saveKey(FB_SESSION_KEY, rec, false);
    return rec;
  };

  // resolves a currently-valid idToken from storage, refreshing it if needed
  const getValidToken = async () => {
    let rec = await loadKey(FB_SESSION_KEY, null, false);
    if (!rec) return null;
    if (rec.expiresAt - 60000 > Date.now()) return rec;
    try {
      const refreshed = await fbRefreshToken(rec.refreshToken);
      rec = await saveFbSession({
        idToken: refreshed.id_token,
        refreshToken: refreshed.refresh_token,
        uid: refreshed.user_id,
        email: rec.email,
        expiresIn: refreshed.expires_in,
      });
      return rec;
    } catch (e) {
      await saveKey(FB_SESSION_KEY, null, false);
      return null;
    }
  };

  const routeFromToken = useCallback(async (rec) => {
    try {
      const info = await fbLookup(rec.idToken);
      if (!info) { setSession(null); setPendingUser(null); return; }
      if (!info.emailVerified) {
        setPendingUser({ idToken: rec.idToken, refreshToken: rec.refreshToken, uid: rec.uid, email: info.email });
        setSession(null);
        setView("verify");
        return;
      }
      const profile = await syncProfile({ uid: rec.uid, email: info.email, displayName: info.displayName });
      setPendingUser(null);
      setSession(profile);
      setView((v) => (v === "landing" || v === "login" || v === "register" || v === "verify" ? (profile.role === "admin" ? "ov" : "home") : v));
    } catch (e) {
      setFbError(firebaseErrorMessage(e));
    }
  }, [syncProfile]);

  // Boot: restore session from stored tokens, load users, count visit
  useEffect(() => {
    (async () => {
      const visits = await loadKey("visits", { total: 0, byDate: {} }, true);
      const d = todayISO();
      await saveKey("visits", { total: visits.total + 1, byDate: { ...visits.byDate, [d]: (visits.byDate[d] || 0) + 1 } }, true);
      await refreshUsers();

      if (!FIREBASE_CONFIG.apiKey) {
        setFbError("لم يتم إعداد Firebase بعد لهذا التطبيق.");
        setBooted(true);
        return;
      }
      try {
        const rec = await getValidToken();
        if (rec) await routeFromToken(rec);
      } catch (e) {
        setFbError(firebaseErrorMessage(e));
      }
      setBooted(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshUsers]);

  const login = async (email, password) => {
    try {
      const data = await fbSignIn(email.trim(), password);
      const rec = await saveFbSession(data);
      await routeFromToken(rec);
      return true;
    } catch (e) {
      showToast(firebaseErrorMessage(e), "error");
      return false;
    }
  };

  const register = async (fullName, email, password) => {
    try {
      const data = await fbSignUp(email.trim(), password);
      if (fullName.trim()) {
        try { await fbUpdateProfile(data.idToken, fullName.trim()); } catch (e) { /* non-fatal */ }
      }
      await fbSendVerification(data.idToken);
      const rec = await saveFbSession(data);
      setPendingUser({ idToken: rec.idToken, refreshToken: rec.refreshToken, uid: rec.uid, email: email.trim() });
      setSession(null);
      setView("verify");
      showToast("تم إنشاء الحساب — تحقق من بريدك لتفعيله");
      return true;
    } catch (e) {
      showToast(firebaseErrorMessage(e), "error");
      return false;
    }
  };

  // used for secretary/admin invite redemption: the resulting role is decided
  // by the invite, not by the default teacher signup path
  const registerWithInvite = async (fullName, code, email, password) => {
    try {
      const trimmedCode = code.trim().toUpperCase();
      const secInvites = await loadKey("invites", [], true);
      const secInvite = secInvites.find((i) => i.code === trimmedCode && !i.used);
      const adminInvites = secInvite ? [] : await loadKey("admin-invites", [], true);
      const adminInvite = !secInvite ? adminInvites.find((i) => i.code === trimmedCode && !i.used) : null;

      if (!secInvite && !adminInvite) {
        showToast("كود الدعوة غير صحيح أو مستخدم من قبل", "error");
        return false;
      }

      const emailKey = email.trim().toLowerCase();
      const pending = secInvite
        ? { role: "secretary", teacherId: secInvite.teacherId }
        : { role: "admin", isSuperAdmin: false, phone: adminInvite.phone || "" };
      await saveKey(`pending-role:${emailKey}`, pending, true);

      const data = await fbSignUp(email.trim(), password);
      if (fullName.trim()) {
        try { await fbUpdateProfile(data.idToken, fullName.trim()); } catch (e) { /* non-fatal */ }
      }
      await fbSendVerification(data.idToken);
      const rec = await saveFbSession(data);
      setPendingUser({ idToken: rec.idToken, refreshToken: rec.refreshToken, uid: rec.uid, email: email.trim() });
      setSession(null);
      setView("verify");

      if (secInvite) {
        await saveKey("invites", secInvites.map((i) => (i.code === secInvite.code ? { ...i, used: true } : i)), true);
      } else {
        await saveKey("admin-invites", adminInvites.map((i) => (i.code === adminInvite.code ? { ...i, used: true } : i)), true);
      }

      showToast("تم إنشاء الحساب — تحقق من بريدك لتفعيله");
      return true;
    } catch (e) {
      showToast(firebaseErrorMessage(e), "error");
      return false;
    }
  };

  const resendVerification = async () => {
    if (!pendingUser) return;
    try {
      await fbSendVerification(pendingUser.idToken);
      showToast("تم إرسال رابط التفعيل من جديد");
    } catch (e) {
      showToast(firebaseErrorMessage(e), "error");
    }
  };

  const checkVerified = async () => {
    if (!pendingUser) return;
    try {
      const info = await fbLookup(pendingUser.idToken);
      if (info && info.emailVerified) {
        const profile = await syncProfile({ uid: pendingUser.uid, email: info.email, displayName: info.displayName });
        setPendingUser(null);
        setSession(profile);
        setView(profile.role === "admin" ? "ov" : "home");
      } else {
        showToast("لسه معملتش تفعيل — افتح بريدك واضغط على رابط التفعيل", "error");
      }
    } catch (e) {
      showToast(firebaseErrorMessage(e), "error");
    }
  };

  const resetPassword = async (email) => {
    try {
      await fbSendPasswordReset(email.trim());
      return true;
    } catch (e) {
      showToast(firebaseErrorMessage(e), "error");
      return false;
    }
  };

  const logout = async () => {
    await saveKey(FB_SESSION_KEY, null, false);
    setSession(null);
    setPendingUser(null);
    setView("landing");
  };

  if (!booted || showSplash) {
    return (
      <div dir="rtl" className="app-root">
        <style>{CSS}</style>
        <SplashScreen />
      </div>
    );
  }

  return (
    <div dir="rtl" className="app-root">
      <style>{CSS}</style>
      {toast && <div className={"toast " + toast.type}>{toast.msg}</div>}
      {fbError && (
        <div className="toast error" style={{ top: "auto", bottom: 16 }}>
          خدمة تسجيل الدخول غير مُفعّلة بعد: {fbError}
        </div>
      )}
      {!session && view === "landing" && (
        <Landing
          onRegister={() => setView("register")}
          onLogin={() => setView("login")}
          onGuest={() => setView("guest")}
          onInvite={() => setView("invite")}
        />
      )}
      {!session && view === "guest" && (
        <GuestApp onAuth={() => setView("login")} showToast={showToast} />
      )}
      {!session && (view === "login" || view === "register") && (
        <AuthScreen mode={view} setMode={(m) => setView(m)} onLogin={login} onRegister={register} onBack={() => setView("landing")} onForgot={() => setView("forgot")} />
      )}
      {!session && view === "forgot" && (
        <ForgotPasswordScreen onReset={resetPassword} onBack={() => setView("login")} />
      )}
      {!session && view === "invite" && (
        <InviteRedeemScreen onRedeem={registerWithInvite} onBack={() => setView("landing")} />
      )}
      {!session && view === "verify" && pendingUser && (
        <EmailVerifyPending
          email={pendingUser.email}
          onCheck={checkVerified}
          onResend={resendVerification}
          onCancel={logout}
        />
      )}
      {session && session.role === "admin" && (
        <AdminApp session={session} users={users} refreshUsers={refreshUsers} view={view} setView={setView} onLogout={logout} showToast={showToast} />
      )}
      {session && session.role !== "admin" && (
        <TeacherApp session={session} users={users} view={view} setView={setView} onLogout={logout} showToast={showToast} refreshUsers={refreshUsers} />
      )}
    </div>
  );
}

// ================= Splash =================
function SplashScreen() {
  return (
    <div className="splash-screen">
      <div className="splash-logo">
        <GraduationCap size={44} strokeWidth={1.8} />
      </div>
      <h1 className="splash-title">Teacher Hub AI</h1>
      <p className="splash-sub">منصّتك الذكية لإدارة أعمال التدريس</p>
      <div className="splash-dots">
        <span /><span /><span />
      </div>
    </div>
  );
}

// ================= Guest Landing =================
function Landing({ onRegister, onLogin, onGuest, onInvite }) {
  return (
    <div className="screen landing-screen">
      <div className="landing-center">
        <div className="landing-logo">
          <GraduationCap size={40} strokeWidth={1.8} />
        </div>
        <h1 className="brand">Teacher Hub AI</h1>
        <p className="dim landing-sub">منصّتك الذكية لإدارة صفك بثقة واحترافية</p>
        <div className="landing-badges">
          <span className="landing-badge"><Shield size={13} /> آمن</span>
          <span className="landing-badge"><Sparkles size={13} /> AI</span>
        </div>
      </div>
      <div className="landing-actions">
        <button className="primary-btn full" onClick={onRegister}>إنشاء حساب</button>
        <button className="ghost-btn full" onClick={onLogin}>تسجيل الدخول</button>
        <button className="link-btn" onClick={onGuest}>تصفح كزائر</button>
        <button className="link-btn" onClick={onInvite}>
          <UserPlus size={14} /> لدي كود دعوة (سكرتارية/أدمن)
        </button>
      </div>
    </div>
  );
}

function GuestApp({ onAuth, showToast }) {
  const [view, setView] = useState("home");
  const requireAuth = () => {
    showToast("سجّل دخول للمتابعة");
    onAuth();
  };
  return (
    <div className="screen with-nav">
      {view === "home" && (
        <div className="content">
          <p className="dim">أهلًا بيك،</p>
          <h1 className="brand medium">زائر</h1>
          <div className="stat-grid">
            <StatCard icon={Layers} color="#2f5fd6" label="عدد الفصول" value={0} />
            <StatCard icon={Users} color="#8b6fe0" label="عدد الطلاب" value={0} />
            <StatCard icon={Calendar} color="#1fae66" label="نسبة الحضور" value="0%" />
            <StatCard icon={Award} color="#d4a017" label="متوسط الدرجات" value="0%" />
          </div>
          <h3 className="section-title">اختصارات سريعة</h3>
          <div className="quick-grid">
            <QuickAction icon={FolderPlus} label="إضافة فصل" onClick={requireAuth} />
            <QuickAction icon={UserPlus} label="إضافة طالب" onClick={requireAuth} />
            <QuickAction icon={Sparkles} label="المساعد الذكي" onClick={requireAuth} />
            <QuickAction icon={ClipboardCheck} label="تسجيل حضور" onClick={requireAuth} />
          </div>
        </div>
      )}
      {view === "students" && <GuestLocked label="الطلاب" onAuth={requireAuth} />}
      {view === "classes" && <GuestLocked label="الفصول" onAuth={requireAuth} />}
      {view === "attendance" && <GuestLocked label="الحضور" onAuth={requireAuth} />}
      {view === "more" && (
        <div className="content">
          <h2 className="page-title">المزيد</h2>
          <div className="menu-grid">
            <MenuTile icon={BarChart2} label="التقارير" onClick={requireAuth} />
            <MenuTile icon={Award} label="الدرجات" onClick={requireAuth} />
            <MenuTile icon={Settings} label="الإعدادات" onClick={requireAuth} />
            <MenuTile icon={CreditCard} label="الاشتراك" onClick={requireAuth} />
          </div>
          <button className="primary-btn full" style={{ marginTop: 24 }} onClick={onAuth}>
            تسجيل الدخول / إنشاء حساب
          </button>
        </div>
      )}
      <BottomNav view={view} setView={setView} isSecretary={false} />
    </div>
  );
}

function GuestLocked({ label, onAuth }) {
  return (
    <div className="content">
      <h2 className="page-title">{label}</h2>
      <div className="lock-screen">
        <Lock size={36} className="dim" />
        <p className="dim">سجّل دخولك لعرض واستخدام هذه الميزة</p>
        <button className="primary-btn" onClick={onAuth}>تسجيل الدخول</button>
      </div>
    </div>
  );
}

// ================= Auth =================
function isEmail(v) {
  return /\S+@\S+\.\S+/.test(v);
}
function passwordStrong(p) {
  return p.length >= 8 && /[A-Za-z]/.test(p) && /[0-9]/.test(p);
}

function EmailVerifyPending({ email, onCheck, onResend, onCancel }) {
  const [resendIn, setResendIn] = useState(30);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setResendIn((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, []);

  const check = async () => {
    setChecking(true);
    await onCheck();
    setChecking(false);
  };

  const resend = async () => {
    if (resendIn > 0) return;
    await onResend();
    setResendIn(30);
  };

  return (
    <div className="screen">
      <button className="back-btn" onClick={onCancel}>
        <ChevronRight size={18} /> رجوع
      </button>
      <h1 className="brand small">فعّل بريدك الإلكتروني</h1>
      <div className="card auth-card" style={{ textAlign: "center" }}>
        <MailCheck size={40} style={{ margin: "8px auto", color: "#2f5fd6" }} />
        <p className="dim small">
          أرسلنا رابط تفعيل إلى <b dir="ltr">{email}</b>. افتح بريدك واضغط على الرابط، ثم ارجع هنا واضغط "تحققت من التفعيل".
        </p>
        <button className="primary-btn full" disabled={checking} onClick={check}>
          {checking ? "جارٍ التحقق…" : "تحققت من التفعيل"}
        </button>
        <button className="link-btn" disabled={resendIn > 0} onClick={resend}>
          {resendIn > 0 ? `إعادة إرسال الرابط بعد ${resendIn} ثانية` : "إعادة إرسال رابط التفعيل"}
        </button>
      </div>
    </div>
  );
}

function AuthScreen({ mode, setMode, onLogin, onRegister, onBack, onForgot }) {
  const [fullName, setFullName] = useState("");
  const [contact, setContact] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failCount, setFailCount] = useState(0);
  const [lockUntil, setLockUntil] = useState(0);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (lockUntil <= Date.now()) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [lockUntil]);

  const locked = lockUntil > now;
  const lockLeft = Math.max(0, Math.ceil((lockUntil - now) / 1000));

  const loginSubmit = async () => {
    if (!identifier.trim() || !password.trim() || locked) return;
    setBusy(true);
    const ok = await onLogin(identifier.trim(), password);
    setBusy(false);
    if (!ok) {
      const next = failCount + 1;
      setFailCount(next);
      if (next >= 5) {
        setLockUntil(Date.now() + 30000);
        setFailCount(0);
      }
    }
  };

  const registerSubmit = async () => {
    if (!fullName.trim() || !isEmail(contact.trim()) || !agree) return;
    if (!passwordStrong(password) || password !== confirmPw) return;
    setBusy(true);
    await onRegister(fullName, contact.trim(), password);
    setBusy(false);
  };

  return (
    <div className="screen">
      <button className="back-btn" onClick={onBack}>
        <ChevronRight size={18} /> رجوع
      </button>
      <h1 className="brand small">Teacher Hub AI</h1>
      <div className="auth-tabs">
        <button className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>
          تسجيل الدخول
        </button>
        <button className={mode === "register" ? "active" : ""} onClick={() => setMode("register")}>
          حساب جديد
        </button>
      </div>

      {mode === "login" ? (
        <div className="card auth-card">
          <label className="field-label">البريد الإلكتروني</label>
          <input value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="name@email.com" dir="ltr" />
          <label className="field-label">كلمة المرور</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••" />
          {locked ? (
            <p className="hint otp-demo-note">تم إيقاف المحاولات مؤقتًا — حاول تاني بعد {lockLeft} ثانية</p>
          ) : (
            <button className="primary-btn full" disabled={busy} onClick={loginSubmit}>دخول</button>
          )}
          <button className="link-btn" onClick={onForgot}>نسيت كلمة المرور؟</button>
        </div>
      ) : (
        <div className="card auth-card">
          <label className="field-label">الاسم الكامل</label>
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="مثال: أحمد محمد" />

          <label className="field-label">البريد الإلكتروني</label>
          <input
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            placeholder="name@email.com"
            dir="ltr"
          />

          <label className="field-label">كلمة المرور</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="8 أحرف على الأقل، حروف وأرقام" />
          <label className="field-label">تأكيد كلمة المرور</label>
          <input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} placeholder="••••••" />
          {contact && !isEmail(contact.trim()) && (
            <p className="hint otp-demo-note">أدخل بريدًا إلكترونيًا صحيحًا</p>
          )}
          {password && !passwordStrong(password) && (
            <p className="hint otp-demo-note">كلمة المرور لازم تكون 8 أحرف على الأقل وتحتوي على حروف وأرقام</p>
          )}
          {confirmPw && password !== confirmPw && (
            <p className="hint otp-demo-note">كلمتا المرور غير متطابقتين</p>
          )}

          <label className="check-row">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
            <span>أوافق على الشروط والأحكام</span>
          </label>

          <button
            className="primary-btn full"
            disabled={!fullName.trim() || !isEmail(contact.trim()) || !agree || !passwordStrong(password) || password !== confirmPw}
            onClick={registerSubmit}
          >
            متابعة
          </button>
          <p className="hint">هذا التسجيل لحساب معلّم. حساب السكرتارية يُنشأ من داخل حساب المعلّم بعد الدخول.</p>
        </div>
      )}
    </div>
  );
}

function ForgotPasswordScreen({ onReset, onBack }) {
  const [identifier, setIdentifier] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!isEmail(identifier.trim())) return;
    setBusy(true);
    const ok = await onReset(identifier.trim());
    setBusy(false);
    if (ok) setSent(true);
  };

  if (sent) {
    return (
      <div className="screen">
        <button className="back-btn" onClick={onBack}>
          <ChevronRight size={18} /> رجوع
        </button>
        <h1 className="brand small">تحقق من بريدك</h1>
        <div className="card auth-card" style={{ textAlign: "center" }}>
          <MailCheck size={40} style={{ margin: "8px auto", color: "#2f5fd6" }} />
          <p className="dim small">
            أرسلنا رابط إعادة تعيين كلمة المرور إلى <b dir="ltr">{identifier.trim()}</b>. اتبع الرابط لإنشاء كلمة مرور جديدة.
          </p>
          <button className="primary-btn full" onClick={onBack}>رجوع لتسجيل الدخول</button>
        </div>
      </div>
    );
  }

  return (
    <div className="screen">
      <button className="back-btn" onClick={onBack}>
        <ChevronRight size={18} /> رجوع
      </button>
      <h1 className="brand small">استعادة كلمة المرور</h1>
      <div className="card auth-card">
        <label className="field-label">البريد الإلكتروني المسجّل بحسابك</label>
        <input value={identifier} onChange={(e) => setIdentifier(e.target.value)} dir="ltr" placeholder="name@email.com" />
        <button className="primary-btn full" disabled={busy || !isEmail(identifier.trim())} onClick={submit}>
          إرسال رابط إعادة التعيين
        </button>
      </div>
    </div>
  );
}

function InviteRedeemScreen({ onRedeem, onBack }) {
  const [code, setCode] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [busy, setBusy] = useState(false);

  const valid = code.trim() && fullName.trim() && isEmail(email.trim()) && passwordStrong(password) && password === confirmPw;

  const submit = async () => {
    if (!valid) return;
    setBusy(true);
    await onRedeem(fullName, code, email.trim(), password);
    setBusy(false);
  };

  return (
    <div className="screen">
      <button className="back-btn" onClick={onBack}>
        <ChevronRight size={18} /> رجوع
      </button>
      <h1 className="brand small">تفعيل كود دعوة</h1>
      <div className="card auth-card">
        <label className="field-label">كود الدعوة</label>
        <input value={code} onChange={(e) => setCode(e.target.value)} dir="ltr" placeholder="مثال: A1B2C3" />
        <label className="field-label">الاسم الكامل</label>
        <input value={fullName} onChange={(e) => setFullName(e.target.value)} />
        <label className="field-label">البريد الإلكتروني</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" placeholder="name@email.com" />
        <label className="field-label">كلمة المرور</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="8 أحرف على الأقل، حروف وأرقام" />
        <label className="field-label">تأكيد كلمة المرور</label>
        <input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} />
        <button className="primary-btn full" disabled={!valid || busy} onClick={submit}>إنشاء الحساب</button>
      </div>
    </div>
  );
}

// ================= Teacher / Secretary App =================
function TeacherApp({ session, users, view, setView, onLogout, showToast, refreshUsers }) {
  const ownerId = session.role === "secretary" ? session.teacherId : session.id;
  const ownerUser = users.find((u) => u.id === ownerId) || session;
  const isSecretary = session.role === "secretary";
  const locked = ownerUser.role !== "admin" && !ownerUser.subscribed && daysLeft(ownerUser.trialStart || session.trialStart) <= 0;

  const [classes, setClasses] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [classData, setClassData] = useState(null);
  const [attDate, setAttDate] = useState(todayISO());
  const [loadingClasses, setLoadingClasses] = useState(true);

  useEffect(() => {
    (async () => {
      const list = await loadKey(`classes:${ownerId}`, [], true);
      setClasses(list);
      if (list.length) setSelectedId(list[0].id);
      setLoadingClasses(false);
    })();
  }, [ownerId]);

  useEffect(() => {
    if (!selectedId) {
      setClassData(null);
      return;
    }
    (async () => {
      const data = await loadKey(`class-data:${selectedId}`, { students: [], attendance: {}, assignments: [], scores: {} }, true);
      setClassData(data);
    })();
  }, [selectedId]);

  const persistClassData = (data) => {
    if (selectedId) saveKey(`class-data:${selectedId}`, data, true);
  };
  const updateClassData = (updater) => {
    setClassData((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      persistClassData(next);
      return next;
    });
  };

  const addClass = async (name) => {
    if (!name.trim()) return;
    const item = { id: uid(), name: name.trim(), color: TAB_COLORS[classes.length % TAB_COLORS.length] };
    const next = [...classes, item];
    setClasses(next);
    await saveKey(`classes:${ownerId}`, next, true);
    setSelectedId(item.id);
    showToast("تمت إضافة الفصل");
  };
  const removeClass = async (id) => {
    const next = classes.filter((c) => c.id !== id);
    setClasses(next);
    await saveKey(`classes:${ownerId}`, next, true);
    if (selectedId === id) setSelectedId(next.length ? next[0].id : null);
  };

  // aggregate stats for home
  const [stats, setStats] = useState({ students: 0, attendancePct: 0, gradesPct: 0 });
  useEffect(() => {
    (async () => {
      let studentsTotal = 0, present = 0, marked = 0, gradeSum = 0, gradeMax = 0;
      for (const c of classes) {
        const d = await loadKey(`class-data:${c.id}`, { students: [], attendance: {}, assignments: [], scores: {} }, true);
        studentsTotal += d.students.length;
        Object.values(d.attendance || {}).forEach((day) => {
          Object.values(day).forEach((st) => {
            if (st === "none") return;
            marked++;
            if (st === "present") present++;
          });
        });
        d.students.forEach((s) => {
          const sc = (d.scores || {})[s.id] || {};
          (d.assignments || []).forEach((a) => {
            const v = Number(sc[a.id]);
            if (!isNaN(v) && sc[a.id] !== "" && sc[a.id] !== undefined) {
              gradeSum += v;
              gradeMax += Number(a.max);
            }
          });
        });
      }
      setStats({
        students: studentsTotal,
        attendancePct: marked ? Math.round((present / marked) * 100) : 0,
        gradesPct: gradeMax ? Math.round((gradeSum / gradeMax) * 100) : 0,
      });
    })();
  }, [classes, view]);

  // subscription alerts, derived from the dedicated student-subscriptions registry
  const [subsAlerts, setSubsAlerts] = useState({ expiring: [], expired: [] });
  const loadSubsAlerts = useCallback(async () => {
    const list = await loadKey(`student-subs:${ownerId}`, [], true);
    const now = new Date();
    const expiring = [];
    const expired = [];
    list.forEach((s) => {
      const expiry = addMonthsToDate(s.payDate, 1);
      const diffDays = Math.ceil((expiry - now) / 86400000);
      if (diffDays < 0) expired.push({ id: s.id, name: s.name });
      else if (diffDays <= 5) expiring.push({ id: s.id, name: s.name, daysLeft: diffDays });
    });
    setSubsAlerts({ expiring, expired });
  }, [ownerId]);
  useEffect(() => { loadSubsAlerts(); }, [loadSubsAlerts, view]);

  return (
    <div className="screen with-nav">
      {locked && view !== "subscription" && view !== "more" ? (
        <LockedView onSubscribe={() => setView("subscription")} isSecretary={isSecretary} />
      ) : (
        <>
          {view === "home" && (
            <HomeView
              session={session}
              ownerUser={ownerUser}
              isSecretary={isSecretary}
              classesCount={classes.length}
              stats={stats}
              setView={setView}
            />
          )}
          {view === "classes" && (
            <ClassesView
              classes={classes}
              selectedId={selectedId}
              setSelectedId={setSelectedId}
              addClass={addClass}
              removeClass={removeClass}
              canManage={!isSecretary}
            />
          )}
          {view === "students" && (
            <StudentsView classes={classes} selectedId={selectedId} setSelectedId={setSelectedId} classData={classData} updateClassData={updateClassData} loading={loadingClasses} />
          )}
          {view === "attendance" && (
            <AttendanceView classes={classes} selectedId={selectedId} setSelectedId={setSelectedId} classData={classData} updateClassData={updateClassData} attDate={attDate} setAttDate={setAttDate} />
          )}
          {view === "grades" && !isSecretary && (
            <GradesView classes={classes} selectedId={selectedId} setSelectedId={setSelectedId} classData={classData} updateClassData={updateClassData} />
          )}
          {view === "more" && (
            <MoreView session={session} isSecretary={isSecretary} setView={setView} onLogout={onLogout} showToast={showToast} refreshUsers={refreshUsers} ownerId={ownerId} alertsCount={subsAlerts.expiring.length + subsAlerts.expired.length} />
          )}
          {view === "subs-alerts" && !isSecretary && (
            <SubsAlertsView alerts={subsAlerts} />
          )}
          {view === "student-subs" && (
            <StudentSubsView ownerId={ownerId} showToast={showToast} />
          )}
          {view === "support" && (
            <SupportView isAdmin={false} showToast={showToast} />
          )}
          {view === "subscription" && !isSecretary && (
            <SubscriptionView user={ownerUser} refreshUsers={refreshUsers} showToast={showToast} />
          )}
        </>
      )}
      <BottomNav view={view} setView={setView} isSecretary={isSecretary} />
    </div>
  );
}

function LockedView({ onSubscribe, isSecretary }) {
  return (
    <div className="lock-screen">
      <Lock size={40} className="dim" />
      <h2>انتهت فترة التجربة المجانية</h2>
      <p className="dim">
        {isSecretary ? "يحتاج حساب المعلّم إلى تفعيل الاشتراك للمتابعة." : "فعّل اشتراك Pro للاستمرار في استخدام كل الميزات."}
      </p>
      {!isSecretary && (
        <button className="primary-btn" onClick={onSubscribe}>
          الترقية إلى Pro
        </button>
      )}
    </div>
  );
}

function BottomNav({ view, setView, isSecretary }) {
  const items = [
    { key: "home", label: "الرئيسية", icon: LayoutGrid },
    { key: "students", label: "الطلاب", icon: Users },
    { key: "classes", label: "الفصول", icon: Layers },
    { key: "attendance", label: "الحضور", icon: Calendar },
    { key: "more", label: "المزيد", icon: Menu },
  ];
  return (
    <nav className="bottom-nav">
      {items.map((it) => (
        <button key={it.key} className={"nav-item" + (view === it.key ? " active" : "")} onClick={() => setView(it.key)}>
          <it.icon size={20} />
          <span>{it.label}</span>
        </button>
      ))}
    </nav>
  );
}

function HomeView({ session, ownerUser, isSecretary, classesCount, stats, setView }) {
  const dLeft = daysLeft(ownerUser.trialStart);
  const [showAI, setShowAI] = useState(false);
  return (
    <div className="content">
      <p className="dim">أهلًا بعودتك،</p>
      <h1 className="brand medium">{session.username}</h1>

      {!isSecretary && !ownerUser.subscribed && (
        <div className="trial-banner" onClick={() => setView("subscription")}>
          <span>{dLeft > 0 ? `متبقٍ ${dLeft} يوم في التجربة المجانية` : "انتهت التجربة"}</span>
          <span className="pill">الترقية إلى Pro</span>
        </div>
      )}

      <div className="stat-grid">
        <StatCard icon={Layers} color="#2f5fd6" label="عدد الفصول" value={classesCount} />
        <StatCard icon={Users} color="#8b6fe0" label="عدد الطلاب" value={stats.students} />
        <StatCard icon={Calendar} color="#1fae66" label="نسبة الحضور" value={stats.attendancePct + "%"} />
        <StatCard icon={Award} color="#d4a017" label="متوسط الدرجات" value={stats.gradesPct + "%"} />
      </div>

      <h3 className="section-title">اختصارات سريعة</h3>
      <div className="quick-grid">
        {!isSecretary && (
          <QuickAction icon={FolderPlus} label="إضافة فصل" onClick={() => setView("classes")} />
        )}
        <QuickAction icon={UserPlus} label="إضافة طالب" onClick={() => setView("students")} />
        <QuickAction icon={Sparkles} label="المساعد الذكي" onClick={() => setShowAI(true)} />
        <QuickAction icon={ClipboardCheck} label="تسجيل حضور" onClick={() => setView("attendance")} />
      </div>

      <h3 className="section-title">آخر الإشعارات</h3>
      <div className="card empty-note">
        <Bell size={16} className="dim" />
        <span className="dim">لا توجد إشعارات جديدة حاليًا</span>
      </div>

      {showAI && <AIAssistantModal onClose={() => setShowAI(false)} />}
    </div>
  );
}

function AIAssistantModal({ onClose, title, icon: Icon = Sparkles, greeting, systemPrompt }) {
  const [messages, setMessages] = useState([
    { role: "assistant", text: greeting || "أهلًا بيك! أنا المساعد الذكي لتطبيق Teacher Hub AI. اسألني عن أي حاجة تخص شغلك كمعلّم — أفكار أنشطة، صياغة ملاحظات لأولياء الأمور، تنظيم جدول، وأكتر." },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    const nextMessages = [...messages, { role: "user", text }];
    setMessages(nextMessages);
    setInput("");
    setBusy(true);
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1000,
          system: systemPrompt || "أنت مساعد ذكي داخل تطبيق Teacher Hub AI، مخصص لمساعدة المعلّمين في مهامهم اليومية (تحضير الدروس، أفكار الأنشطة، صياغة الملاحظات، تنظيم الوقت). ردودك بالعربية، مختصرة وعملية.",
          messages: nextMessages.map((m) => ({ role: m.role, content: m.text })),
        }),
      });
      const data = await response.json();
      const replyText = (data.content || []).map((b) => b.text || "").join("\n").trim() || "معلش، حصل خطأ في الرد. جرّب تاني.";
      setMessages((prev) => [...prev, { role: "assistant", text: replyText }]);
    } catch (e) {
      setMessages((prev) => [...prev, { role: "assistant", text: "تعذّر الاتصال بالمساعد الذكي حاليًا. جرّب تاني بعد لحظات." }]);
    }
    setBusy(false);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card ai-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ai-header">
          <span className="ai-title"><Icon size={16} /> {title || "المساعد الذكي"}</span>
          <button className="modal-close-inline" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="ai-messages" ref={scrollRef}>
          {messages.map((m, i) => (
            <div key={i} className={"ai-bubble " + m.role}>{m.text}</div>
          ))}
          {busy && <div className="ai-bubble assistant dim">جارٍ الكتابة…</div>}
        </div>
        <div className="ai-input-row">
          <input
            placeholder="اكتب سؤالك هنا…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
          />
          <button className="primary-btn" disabled={busy} onClick={send}><Send size={16} /></button>
        </div>
      </div>
    </div>
  );
}

function SupportView({ isAdmin, showToast }) {
  const [whatsapp, setWhatsapp] = useState("");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [showChat, setShowChat] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const s = await loadKey("support-settings", { whatsapp: "+923333764761" }, true);
    setWhatsapp(s.whatsapp || "");
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const saveWhatsapp = async () => {
    if (!draft.trim()) return;
    await saveKey("support-settings", { whatsapp: draft.trim() }, true);
    setWhatsapp(draft.trim());
    setEditing(false);
    showToast("تم تحديث رقم واتساب الدعم");
  };

  const waLink = `https://wa.me/${whatsapp.replace(/[^0-9]/g, "")}`;

  return (
    <div className="content">
      <h2 className="page-title">خدمة العملاء</h2>
      <p className="hint">اختر طريقة التواصل المناسبة لك.</p>

      {!loading && (
        <>
          <a href={waLink} target="_blank" rel="noreferrer" className="card quick-card support-option">
            <div className="icon-badge" style={{ background: "#1fae6626", color: "#1fae66" }}><Send size={20} /></div>
            <div>
              <div style={{ fontWeight: 700 }}>تواصل عبر واتساب</div>
              <div className="dim small" dir="ltr">{whatsapp}</div>
            </div>
          </a>

          <button className="card quick-card support-option" onClick={() => setShowChat(true)}>
            <div className="icon-badge" style={{ background: "#8b6fe026", color: "#8b6fe0" }}><Sparkles size={20} /></div>
            <div>
              <div style={{ fontWeight: 700 }}>شات دعم بالذكاء الاصطناعي</div>
              <div className="dim small">رد فوري على أسئلتك عن التطبيق</div>
            </div>
          </button>
        </>
      )}

      {isAdmin && (
        <>
          <h3 className="section-title">إعدادات الأدمن</h3>
          {!editing ? (
            <button className="ghost-btn" onClick={() => { setDraft(whatsapp); setEditing(true); }}>
              <Settings size={16} /> تعديل رقم واتساب الدعم
            </button>
          ) : (
            <div className="card auth-card">
              <label className="field-label">رقم واتساب الدعم</label>
              <input value={draft} onChange={(e) => setDraft(e.target.value)} dir="ltr" placeholder="+201234567890" />
              <div className="modal-actions">
                <button className="primary-btn full" onClick={saveWhatsapp}>حفظ</button>
                <button className="ghost-btn full" onClick={() => setEditing(false)}>إلغاء</button>
              </div>
            </div>
          )}
        </>
      )}

      {showChat && (
        <AIAssistantModal
          onClose={() => setShowChat(false)}
          title="شات دعم Teacher Hub AI"
          greeting="أهلًا بيك! أنا شات الدعم بتاع Teacher Hub AI. اسألني عن أي حاجة تخص استخدام التطبيق، الاشتراك، أو أي مشكلة بتواجهك."
          systemPrompt="أنت موظف خدمة عملاء داخل تطبيق Teacher Hub AI، تساعد المستخدمين (معلّمين وسكرتارية) في أسئلتهم عن استخدام التطبيق، الاشتراك، تسجيل الدخول، وميزاته. ردودك بالعربية، ودودة ومختصرة. لو السؤال يحتاج تدخل بشري، انصح المستخدم بالتواصل عبر واتساب من نفس الشاشة."
        />
      )}
    </div>
  );
}

function StatCard({ icon: Icon, color, label, value }) {
  return (
    <div className="card stat-card">
      <div className="icon-badge" style={{ background: color + "26", color }}>
        <Icon size={20} />
      </div>
      <div className="stat-value">{value}</div>
      <div className="dim small">{label}</div>
    </div>
  );
}
function QuickAction({ icon: Icon, label, onClick }) {
  return (
    <button className="card quick-card" onClick={onClick}>
      <div className="icon-badge blueish">
        <Icon size={20} />
      </div>
      <span>{label}</span>
    </button>
  );
}

function ClassPicker({ classes, selectedId, setSelectedId }) {
  if (!classes.length) return null;
  return (
    <div className="class-tabs">
      {classes.map((c) => (
        <button key={c.id} className={"class-chip" + (c.id === selectedId ? " active" : "")} style={{ "--c": c.color }} onClick={() => setSelectedId(c.id)}>
          {c.name}
        </button>
      ))}
    </div>
  );
}

function ClassesView({ classes, selectedId, setSelectedId, addClass, removeClass, canManage }) {
  const [name, setName] = useState("");
  return (
    <div className="content">
      <h2 className="page-title">الفصول</h2>
      {canManage && (
        <div className="row-form">
          <input placeholder="اسم الفصل الجديد" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (addClass(name), setName(""))} />
          <button className="primary-btn" onClick={() => { addClass(name); setName(""); }}>
            <Plus size={16} /> إضافة
          </button>
        </div>
      )}
      {classes.length === 0 && <p className="hint">لا توجد فصول بعد.</p>}
      <ul className="list">
        {classes.map((c) => (
          <li key={c.id} className={"list-row" + (c.id === selectedId ? " active" : "")} onClick={() => setSelectedId(c.id)}>
            <span className="dot" style={{ background: c.color }} />
            <span className="flex1">{c.name}</span>
            {canManage && (
              <button className="remove-btn" onClick={(e) => { e.stopPropagation(); removeClass(c.id); }}>
                حذف
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function StudentsView({ classes, selectedId, setSelectedId, classData, updateClassData, loading }) {
  const [name, setName] = useState("");
  if (!classes.length) return <div className="content"><h2 className="page-title">الطلاب</h2><p className="hint">أنشئ فصلًا أولًا من تبويب "الفصول".</p></div>;
  const add = () => {
    if (!name.trim()) return;
    updateClassData((prev) => ({ ...prev, students: [...prev.students, { id: uid(), name: name.trim() }] }));
    setName("");
  };
  const remove = (sid) => updateClassData((prev) => ({ ...prev, students: prev.students.filter((s) => s.id !== sid) }));
  return (
    <div className="content">
      <h2 className="page-title">الطلاب</h2>
      <ClassPicker classes={classes} selectedId={selectedId} setSelectedId={setSelectedId} />
      {classData && (
        <>
          <div className="row-form">
            <input placeholder="اسم الطالب" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
            <button className="primary-btn" onClick={add}><Plus size={16} /> إضافة</button>
          </div>
          {classData.students.length === 0 && <p className="hint">لا يوجد طلاب بعد.</p>}
          <ul className="list">
            {classData.students.map((s, i) => (
              <li key={s.id} className="list-row">
                <span className="avatar">{s.name.charAt(0)}</span>
                <span className="flex1">{s.name}</span>
                <span className="dim small">#{i + 1}</span>
                <button className="remove-btn" onClick={() => remove(s.id)}>حذف</button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function AttendanceView({ classes, selectedId, setSelectedId, classData, updateClassData, attDate, setAttDate }) {
  if (!classes.length) return <div className="content"><h2 className="page-title">الحضور</h2><p className="hint">أنشئ فصلًا وأضف طلابًا أولًا.</p></div>;
  const cycle = (sid) => {
    updateClassData((prev) => {
      const dayRec = { ...(prev.attendance[attDate] || {}) };
      const cur = dayRec[sid] || "none";
      dayRec[sid] = STATUS_CYCLE[(STATUS_CYCLE.indexOf(cur) + 1) % STATUS_CYCLE.length];
      return { ...prev, attendance: { ...prev.attendance, [attDate]: dayRec } };
    });
  };
  return (
    <div className="content">
      <h2 className="page-title">الحضور</h2>
      <ClassPicker classes={classes} selectedId={selectedId} setSelectedId={setSelectedId} />
      {classData && (
        <>
          <div className="row-form">
            <label className="date-label">
              التاريخ: <input type="date" value={attDate} onChange={(e) => setAttDate(e.target.value)} />
            </label>
          </div>
          {classData.students.length === 0 ? (
            <p className="hint">أضف طلابًا أولًا.</p>
          ) : (
            <ul className="list">
              {classData.students.map((s) => {
                const st = (classData.attendance[attDate] || {})[s.id] || "none";
                return (
                  <li key={s.id} className="list-row">
                    <span className="avatar">{s.name.charAt(0)}</span>
                    <span className="flex1">{s.name}</span>
                    <button className="status-pill" style={{ "--c": STATUS_META[st].color }} onClick={() => cycle(s.id)}>
                      {STATUS_META[st].label}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

function GradesView({ classes, selectedId, setSelectedId, classData, updateClassData }) {
  const [showNew, setShowNew] = useState(false);
  const [aname, setAname] = useState("");
  const [amax, setAmax] = useState(10);
  if (!classes.length) return <div className="content"><h2 className="page-title">الدرجات</h2><p className="hint">أنشئ فصلًا وأضف طلابًا أولًا.</p></div>;
  const addAssignment = () => {
    if (!aname.trim()) return;
    updateClassData((prev) => ({ ...prev, assignments: [...prev.assignments, { id: uid(), name: aname.trim(), max: Number(amax) || 10 }] }));
    setAname(""); setAmax(10); setShowNew(false);
  };
  const removeAssignment = (aid) => updateClassData((prev) => ({ ...prev, assignments: prev.assignments.filter((a) => a.id !== aid) }));
  const setScore = (sid, aid, val) => updateClassData((prev) => ({ ...prev, scores: { ...prev.scores, [sid]: { ...(prev.scores[sid] || {}), [aid]: val } } }));

  return (
    <div className="content">
      <h2 className="page-title">الدرجات</h2>
      <ClassPicker classes={classes} selectedId={selectedId} setSelectedId={setSelectedId} />
      {classData && (
        <>
          <div className="row-form">
            {!showNew ? (
              <button className="primary-btn" onClick={() => setShowNew(true)}><Plus size={16} /> إضافة تقييم</button>
            ) : (
              <>
                <input placeholder="اسم التقييم" value={aname} onChange={(e) => setAname(e.target.value)} />
                <input type="number" className="max-input" placeholder="القصوى" value={amax} onChange={(e) => setAmax(e.target.value)} />
                <button className="primary-btn" onClick={addAssignment}>إضافة</button>
                <button className="ghost-btn" onClick={() => setShowNew(false)}>إلغاء</button>
              </>
            )}
          </div>
          {classData.students.length === 0 ? (
            <p className="hint">أضف طلابًا أولًا.</p>
          ) : classData.assignments.length === 0 ? (
            <p className="hint">أضف تقييمًا لتبدأ برصد الدرجات.</p>
          ) : (
            <div className="table-wrap">
              <table className="grade-table">
                <thead>
                  <tr>
                    <th className="sticky-col">الطالب</th>
                    {classData.assignments.map((a) => (
                      <th key={a.id}>
                        <div className="assign-head">
                          <span>{a.name}</span>
                          <span className="dim small">/{a.max}</span>
                          <span className="remove-x" onClick={() => removeAssignment(a.id)}>✕</span>
                        </div>
                      </th>
                    ))}
                    <th>المعدّل</th>
                  </tr>
                </thead>
                <tbody>
                  {classData.students.map((s) => {
                    const sc = classData.scores[s.id] || {};
                    let sum = 0, max = 0;
                    classData.assignments.forEach((a) => {
                      const v = Number(sc[a.id]);
                      if (!isNaN(v) && sc[a.id] !== "" && sc[a.id] !== undefined) { sum += v; max += Number(a.max); }
                    });
                    const avg = max > 0 ? Math.round((sum / max) * 1000) / 10 : null;
                    return (
                      <tr key={s.id}>
                        <td className="sticky-col">{s.name}</td>
                        {classData.assignments.map((a) => (
                          <td key={a.id}>
                            <input type="number" className="score-input" value={sc[a.id] ?? ""} onChange={(e) => setScore(s.id, a.id, e.target.value)} placeholder="—" />
                          </td>
                        ))}
                        <td className="avg-cell">{avg === null ? "—" : avg + "%"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function MoreView({ session, isSecretary, setView, onLogout, showToast, refreshUsers, ownerId, alertsCount }) {
  const [invites, setInvites] = useState([]);
  const [genBusy, setGenBusy] = useState(false);

  const loadInvites = useCallback(async () => {
    const all = await loadKey("invites", [], true);
    setInvites(all.filter((i) => i.teacherId === ownerId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  }, [ownerId]);

  useEffect(() => { if (!isSecretary) loadInvites(); }, [isSecretary, loadInvites]);

  const generateInvite = async () => {
    setGenBusy(true);
    const code = Array.from({ length: 6 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]).join("");
    const all = await loadKey("invites", [], true);
    const item = { code, teacherId: ownerId, createdAt: new Date().toISOString(), used: false };
    await saveKey("invites", [...all, item], true);
    await loadInvites();
    setGenBusy(false);
    showToast("تم إنشاء كود الدعوة");
  };

  return (
    <div className="content">
      <h2 className="page-title">المزيد</h2>
      <div className="menu-grid">
        <MenuTile icon={BarChart2} label="التقارير" onClick={() => showToast("التقارير — قريبًا")} />
        <MenuTile icon={Award} label="الدرجات" onClick={() => setView("grades")} disabled={isSecretary} />
        <MenuTile icon={Settings} label="الإعدادات" onClick={() => showToast("الإعدادات — قريبًا")} />
        <MenuTile icon={Wallet} label="اشتراكات الطلاب" onClick={() => setView("student-subs")} />
        <MenuTile icon={Send} label="خدمة العملاء" onClick={() => setView("support")} />
        {!isSecretary && <MenuTile icon={CreditCard} label="الاشتراك" onClick={() => setView("subscription")} />}
        {!isSecretary && (
          <MenuTile
            icon={Bell}
            label={"تذكير الاشتراكات" + (alertsCount ? ` (${alertsCount})` : "")}
            onClick={() => setView("subs-alerts")}
          />
        )}
      </div>

      {!isSecretary && (
        <>
          <h3 className="section-title">دعوة سكرتارية</h3>
          <p className="hint">أنشئ كود دعوة وشاركه مع السكرتارية؛ هتقدر تنشئ حسابها بنفسها (بريدها الإلكتروني الخاص) من شاشة الدخول.</p>
          <button className="primary-btn" disabled={genBusy} onClick={generateInvite}>
            <UserPlus size={16} /> إنشاء كود دعوة جديد
          </button>
          {invites.length > 0 && (
            <ul className="list" style={{ marginTop: 12 }}>
              {invites.map((i) => (
                <li key={i.code} className="list-row">
                  <span className="flex1" dir="ltr" style={{ fontWeight: 700, letterSpacing: 1 }}>{i.code}</span>
                  <span className={"badge " + (i.used ? "rejected" : "approved")}>{i.used ? "مستخدم" : "متاح"}</span>
                  {!i.used && (
                    <button
                      className="copy-btn"
                      onClick={() => { navigator.clipboard?.writeText(i.code); showToast("تم نسخ الكود"); }}
                    >
                      <Copy size={14} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <button className="ghost-btn full" style={{ marginTop: 24 }} onClick={onLogout}>
        <LogOut size={16} /> تسجيل خروج
      </button>
    </div>
  );
}
function MenuTile({ icon: Icon, label, onClick, disabled }) {
  return (
    <button className={"card quick-card" + (disabled ? " disabled" : "")} onClick={disabled ? undefined : onClick}>
      <div className="icon-badge blueish"><Icon size={20} /></div>
      <span>{label}</span>
    </button>
  );
}

function SubsAlertsView({ alerts }) {
  const { expiring, expired } = alerts;
  return (
    <div className="content">
      <h2 className="page-title">تذكير الاشتراكات</h2>

      <h3 className="section-title">قربت تنتهي</h3>
      {expiring.length === 0 ? (
        <p className="hint">لا يوجد اشتراكات قربت تنتهي حاليًا.</p>
      ) : (
        <ul className="list">
          {expiring.map((s) => (
            <li key={s.id} className="list-row">
              <span className="avatar">{s.name.charAt(0)}</span>
              <span className="flex1">{s.name}</span>
              <span className="badge pending">باقي {s.daysLeft} يوم</span>
            </li>
          ))}
        </ul>
      )}

      <h3 className="section-title">اشتراكات منتهية</h3>
      {expired.length === 0 ? (
        <p className="hint">لا يوجد اشتراكات منتهية حاليًا.</p>
      ) : (
        <ul className="list">
          {expired.map((s) => (
            <li key={s.id} className="list-row">
              <span className="avatar">{s.name.charAt(0)}</span>
              <span className="flex1">{s.name}</span>
              <span className="badge rejected">منتهي</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function subStatus(payDate) {
  const expiry = addMonthsToDate(payDate, 1);
  const now = new Date();
  const diffDays = Math.ceil((expiry - now) / 86400000);
  if (diffDays < 0) return { key: "expired", label: "منتهي", color: "🔴", cls: "rejected" };
  if (diffDays <= 5) return { key: "near", label: "يقترب من الانتهاء", color: "🟡", cls: "pending" };
  return { key: "active", label: "نشط", color: "🟢", cls: "approved" };
}

function StudentSubsView({ ownerId, showToast }) {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [payDate, setPayDate] = useState(todayISO());

  const load = useCallback(async () => {
    setLoading(true);
    const data = await loadKey(`student-subs:${ownerId}`, [], true);
    setList(data);
    setLoading(false);
  }, [ownerId]);

  useEffect(() => { load(); }, [load]);

  const persist = async (next) => {
    setList(next);
    await saveKey(`student-subs:${ownerId}`, next, true);
  };

  const addStudent = async () => {
    if (!name.trim() || !amount || !payDate) return;
    const item = { id: uid(), name: name.trim(), phone: phone.trim(), amount: Number(amount), payDate };
    await persist([item, ...list]);
    setName(""); setPhone(""); setAmount(""); setPayDate(todayISO()); setShowAdd(false);
    showToast("تم إضافة الطالب للاشتراكات");
  };

  const renew = async (id) => {
    const next = list.map((s) => (s.id === id ? { ...s, payDate: todayISO() } : s));
    await persist(next);
    showToast("تم تجديد الاشتراك");
  };

  const remove = async (id) => {
    await persist(list.filter((s) => s.id !== id));
  };

  const filtered = list.filter((s) => s.name.toLowerCase().includes(search.trim().toLowerCase()));

  return (
    <div className="content">
      <h2 className="page-title">اشتراكات الطلاب</h2>

      <div className="search-row">
        <Search size={16} className="dim" />
        <input placeholder="ابحث عن طالب بالاسم" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {!showAdd ? (
        <button className="primary-btn" onClick={() => setShowAdd(true)}>
          <UserPlus size={16} /> إضافة طالب جديد
        </button>
      ) : (
        <div className="card auth-card">
          <label className="field-label">اسم الطالب</label>
          <input value={name} onChange={(e) => setName(e.target.value)} />
          <label className="field-label">رقم الهاتف (اختياري)</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" placeholder="01xxxxxxxxx" />
          <label className="field-label">قيمة الاشتراك الشهري</label>
          <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} dir="ltr" placeholder="مثال: 200" />
          <label className="field-label">تاريخ دفع الاشتراك</label>
          <input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} dir="ltr" />
          <div className="modal-actions">
            <button className="primary-btn full" onClick={addStudent}>حفظ</button>
            <button className="ghost-btn full" onClick={() => setShowAdd(false)}>إلغاء</button>
          </div>
        </div>
      )}

      {loading && <p className="hint">جارٍ التحميل…</p>}
      {!loading && filtered.length === 0 && <p className="hint">لا يوجد طلاب مسجّلين في الاشتراكات بعد.</p>}

      <ul className="list" style={{ marginTop: 12 }}>
        {filtered.map((s) => {
          const st = subStatus(s.payDate);
          const expiry = addMonthsToDate(s.payDate, 1);
          return (
            <li key={s.id} className="list-row sub-row">
              <span className="avatar">{s.name.charAt(0)}</span>
              <span className="flex1">
                {s.name}
                {s.phone && <span className="dim small" dir="ltr"> — {s.phone}</span>}
                <br />
                <span className="dim small">{s.amount} ج.م — ينتهي {expiry.toISOString().slice(0, 10)}</span>
              </span>
              <span className={"badge " + st.cls}>{st.color} {st.label}</span>
              <button className="copy-btn" onClick={() => renew(s.id)} title="تجديد الاشتراك">
                <RefreshCw size={14} />
              </button>
              <button className="remove-btn" onClick={() => remove(s.id)}>حذف</button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function SubscriptionView({ user, refreshUsers, showToast }) {
  const [receipts, setReceipts] = useState([]);
  const [busy, setBusy] = useState(false);
  const [billing, setBilling] = useState("monthly");
  const [showPayment, setShowPayment] = useState(false);
  const fileRef = useRef(null);
  const dLeft = daysLeft(user.trialStart);
  const price = billing === "monthly" ? "150 ج.م / شهريًا" : "1500 ج.م / سنويًا";

  const loadReceipts = useCallback(async () => {
    const idx = await loadKey("receipts-index", [], true);
    setReceipts(idx.filter((r) => r.userId === user.id).sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)));
  }, [user.id]);

  useEffect(() => { loadReceipts(); }, [loadReceipts]);

  const upload = async (file) => {
    if (!file) return;
    setBusy(true);
    try {
      const base64 = await fileToCompressedBase64(file);
      const id = uid();
      const meta = { id, userId: user.id, username: user.username, status: "pending", submittedAt: new Date().toISOString() };
      await saveKey(`receipt:${id}`, { ...meta, imageBase64: base64 }, true);
      const idx = await loadKey("receipts-index", [], true);
      await saveKey("receipts-index", [...idx, meta], true);
      showToast("تم رفع الإيصال، بانتظار مراجعة الأدمن");
      await loadReceipts();
    } catch (e) {
      showToast("فشل رفع الصورة", "error");
    }
    setBusy(false);
  };

  return (
    <div className="content">
      <h2 className="page-title">الاشتراك</h2>

      {user.subscribed ? (
        <div className="card"><p><Check size={16} className="ok-icon" /> اشتراكك مفعّل — خطة Pro</p></div>
      ) : (
        <>
          <div className="card plan-card">
            <h3 className="plan-name">الخطة المجانية</h3>
            <p className="plan-price">مجانًا</p>
            <ul className="plan-features">
              <li><Check size={14} className="ok-icon" /> حتى 3 فصول</li>
              <li><Check size={14} className="ok-icon" /> حتى 100 طالب</li>
              <li><Check size={14} className="ok-icon" /> تقارير أساسية</li>
              <li className="dim"><Check size={14} /> يحتوي على إعلانات</li>
            </ul>
          </div>

          <div className="card plan-card pro-card">
            <span className="pro-badge">PRO</span>
            <h3 className="plan-name">الخطة الاحترافية</h3>
            <p className="plan-price gold">{price}</p>
            <ul className="plan-features">
              <li><Check size={14} className="ok-icon" /> فصول وطلاب غير محدودة</li>
              <li><Check size={14} className="ok-icon" /> بدون إعلانات</li>
              <li><Check size={14} className="ok-icon" /> مساعد AI كامل</li>
              <li><Check size={14} className="ok-icon" /> تقارير متقدمة وتصدير غير محدود</li>
            </ul>
            <div className="billing-toggle">
              <button className={billing === "yearly" ? "active" : ""} onClick={() => setBilling("yearly")}>سنوي</button>
              <button className={billing === "monthly" ? "active" : ""} onClick={() => setBilling("monthly")}>شهري</button>
            </div>
            <button className="primary-btn full" onClick={() => setShowPayment(true)}>اشترك الآن</button>
          </div>

          <p className="dim small">{dLeft > 0 ? `متبقٍ ${dLeft} يوم في فترة التجربة المجانية` : "انتهت فترة التجربة"}</p>
        </>
      )}

      {!user.subscribed && showPayment && (
        <>
          <h3 className="section-title">الدفع عبر فودافون كاش</h3>
          <div className="card vf-card">
            <div className="vf-row">
              <span className="vf-badge">فودافون كاش</span>
              <span className="vf-number" dir="ltr">010 250 953 61</span>
              <button
                className="copy-btn"
                onClick={() => {
                  navigator.clipboard?.writeText("01025095361");
                  showToast("تم نسخ الرقم");
                }}
              >
                <Copy size={15} /> نسخ
              </button>
            </div>
            <p className="hint">حوّل قيمة الاشتراك ({price}) على الرقم أعلاه، وارفع صورة إشعار التحويل من فودافون كاش أدناه.</p>
          </div>

          <h3 className="section-title">رفع إيصال التحويل</h3>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => upload(e.target.files[0])} />
          <button className="primary-btn" disabled={busy} onClick={() => fileRef.current.click()}>
            <Upload size={16} /> {busy ? "جارٍ الرفع…" : "اختيار صورة الإيصال"}
          </button>
        </>
      )}

      {receipts.length > 0 && (
        <>
          <h3 className="section-title">إيصالاتك السابقة</h3>
          <ul className="list">
            {receipts.map((r) => (
              <li key={r.id} className="list-row">
                <span className="flex1 small">{new Date(r.submittedAt).toLocaleString("ar-EG")}</span>
                <span className={"badge " + r.status}>
                  {r.status === "pending" ? "بانتظار المراجعة" : r.status === "approved" ? "تمت الموافقة" : "مرفوض"}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

// ================= Admin App =================
function AdminApp({ session, users, refreshUsers, view, setView, onLogout, showToast }) {
  const isSuper = !!session.isSuperAdmin;
  return (
    <div className="screen with-nav">
      {view === "ov" && <AdminOverview />}
      {view === "receipts" && <AdminReceipts refreshUsers={refreshUsers} showToast={showToast} />}
      {view === "accounts" && <AdminAccounts users={users} refreshUsers={refreshUsers} showToast={showToast} />}
      {view === "support" && <SupportView isAdmin={true} showToast={showToast} />}
      {view === "admins" && isSuper && (
        <AdminAdmins session={session} refreshUsers={refreshUsers} showToast={showToast} />
      )}
      <nav className="bottom-nav">
        <button className={"nav-item" + (view === "accounts" ? " active" : "")} onClick={() => setView("accounts")}>
          <Users size={20} /><span>الحسابات</span>
        </button>
        <button className={"nav-item" + (view === "receipts" ? " active" : "")} onClick={() => setView("receipts")}>
          <ClipboardCheck size={20} /><span>الإيصالات</span>
        </button>
        <button className={"nav-item" + (view === "ov" ? " active" : "")} onClick={() => setView("ov")}>
          <Shield size={20} /><span>نظرة عامة</span>
        </button>
        <button className={"nav-item" + (view === "support" ? " active" : "")} onClick={() => setView("support")}>
          <Send size={20} /><span>خدمة العملاء</span>
        </button>
        {isSuper && (
          <button className={"nav-item" + (view === "admins" ? " active" : "")} onClick={() => setView("admins")}>
            <Lock size={20} /><span>إدارة الأدمن</span>
          </button>
        )}
        <button className="nav-item" onClick={onLogout}>
          <LogOut size={20} /><span>خروج</span>
        </button>
      </nav>
    </div>
  );
}

function AdminOverview() {
  const [visits, setVisits] = useState({ total: 0, byDate: {} });
  const [counts, setCounts] = useState({ teachers: 0, secretaries: 0, pending: 0 });

  useEffect(() => {
    (async () => {
      const v = await loadKey("visits", { total: 0, byDate: {} }, true);
      setVisits(v);
      const u = await loadKey("users", [], true);
      const idx = await loadKey("receipts-index", [], true);
      setCounts({
        teachers: u.filter((x) => x.role === "teacher").length,
        secretaries: u.filter((x) => x.role === "secretary").length,
        pending: idx.filter((r) => r.status === "pending").length,
      });
    })();
  }, []);

  const today = todayISO();
  return (
    <div className="content">
      <h2 className="page-title">لوحة تحكم الأدمن</h2>
      <div className="stat-grid">
        <StatCard icon={Eye} color="#2f5fd6" label="الزوار اليوم" value={visits.byDate[today] || 0} />
        <StatCard icon={Eye} color="#2fb6c9" label="إجمالي الزوار" value={visits.total} />
        <StatCard icon={Users} color="#8b6fe0" label="المعلّمون" value={counts.teachers} />
        <StatCard icon={ClipboardCheck} color="#d4a017" label="إيصالات معلّقة" value={counts.pending} />
      </div>
      <p className="dim small">عدد حسابات السكرتارية: {counts.secretaries}</p>
    </div>
  );
}

function AdminReceipts({ refreshUsers, showToast }) {
  const [idx, setIdx] = useState([]);
  const [openReceipt, setOpenReceipt] = useState(null);

  const load = useCallback(async () => {
    const list = await loadKey("receipts-index", [], true);
    setIdx(list.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)));
  }, []);
  useEffect(() => { load(); }, [load]);

  const openFull = async (id) => {
    const full = await loadKey(`receipt:${id}`, null, true);
    setOpenReceipt(full);
  };

  const decide = async (receipt, approve) => {
    const status = approve ? "approved" : "rejected";
    const next = idx.map((r) => (r.id === receipt.id ? { ...r, status } : r));
    setIdx(next);
    await saveKey("receipts-index", next, true);
    const full = await loadKey(`receipt:${receipt.id}`, {}, true);
    await saveKey(`receipt:${receipt.id}`, { ...full, status }, true);

    if (approve) {
      const users = await refreshUsers();
      const updated = users.map((u) => (u.id === receipt.userId ? { ...u, subscribed: true } : u));
      await saveKey("users", updated, true);
      await refreshUsers();
    }
    setOpenReceipt(null);
    showToast(approve ? "تمت الموافقة على الاشتراك" : "تم رفض الإيصال");
  };

  return (
    <div className="content">
      <h2 className="page-title">مراجعة الإيصالات</h2>
      {idx.length === 0 && <p className="hint">لا توجد إيصالات مرسلة بعد.</p>}
      <ul className="list">
        {idx.map((r) => (
          <li key={r.id} className="list-row" onClick={() => openFull(r.id)}>
            <span className="flex1">{r.username}</span>
            <span className="dim small">{new Date(r.submittedAt).toLocaleDateString("ar-EG")}</span>
            <span className={"badge " + r.status}>
              {r.status === "pending" ? "معلّق" : r.status === "approved" ? "مقبول" : "مرفوض"}
            </span>
          </li>
        ))}
      </ul>

      {openReceipt && (
        <div className="modal-backdrop" onClick={() => setOpenReceipt(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setOpenReceipt(null)}><X size={18} /></button>
            <p className="dim small">{openReceipt.username} — {new Date(openReceipt.submittedAt).toLocaleString("ar-EG")}</p>
            <img src={openReceipt.imageBase64} alt="إيصال التحويل" className="receipt-img" />
            {openReceipt.status === "pending" ? (
              <div className="modal-actions">
                <button className="primary-btn" onClick={() => decide(openReceipt, true)}><Check size={16} /> موافقة</button>
                <button className="danger-btn" onClick={() => decide(openReceipt, false)}><XCircle size={16} /> رفض</button>
              </div>
            ) : (
              <span className={"badge " + openReceipt.status}>{openReceipt.status === "approved" ? "مقبول" : "مرفوض"}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function AdminAccounts({ users, refreshUsers, showToast }) {
  useEffect(() => { refreshUsers(); }, [refreshUsers]);

  const remove = async (id) => {
    const list = await refreshUsers();
    const next = list.filter((u) => u.id !== id);
    await saveKey("users", next, true);
    await refreshUsers();
    showToast("تم حذف الحساب");
  };

  const toggleSubscription = async (id, current) => {
    const list = await refreshUsers();
    const next = list.map((u) => (u.id === id ? { ...u, subscribed: !current } : u));
    await saveKey("users", next, true);
    await refreshUsers();
    showToast(!current ? "تم تفعيل الاشتراك يدويًا" : "تم إيقاف الاشتراك");
  };

  const teachers = users.filter((u) => u.role === "teacher");
  const secretaries = users.filter((u) => u.role === "secretary");
  const admins = users.filter((u) => u.role === "admin");

  return (
    <div className="content">
      <h2 className="page-title">الحسابات</h2>
      <p className="dim small">للأدمن صلاحية كاملة: تفعيل/إيقاف أي اشتراك يدويًا، وحذف أي حساب.</p>

      <h3 className="section-title">المعلّمون</h3>
      <ul className="list">
        {teachers.map((u) => (
          <li key={u.id} className="list-row acc-row">
            <span className="avatar">{u.username.charAt(0)}</span>
            <span className="flex1">{u.username}</span>
            <span className={"badge " + (u.subscribed ? "approved" : "pending")}>
              {u.subscribed ? "مشترك" : "تجربة"}
            </span>
            <button className="toggle-btn" onClick={() => toggleSubscription(u.id, u.subscribed)}>
              {u.subscribed ? <ToggleRight size={22} color="#1fae66" /> : <ToggleLeft size={22} color="#6b7385" />}
            </button>
            <button className="remove-btn" onClick={() => remove(u.id)}>حذف</button>
          </li>
        ))}
        {teachers.length === 0 && <p className="hint">لا يوجد معلّمون بعد.</p>}
      </ul>

      <h3 className="section-title">السكرتارية</h3>
      <ul className="list">
        {secretaries.map((u) => (
          <li key={u.id} className="list-row acc-row">
            <span className="avatar">{u.username.charAt(0)}</span>
            <span className="flex1">{u.username}</span>
            <button className="remove-btn" onClick={() => remove(u.id)}>حذف</button>
          </li>
        ))}
        {secretaries.length === 0 && <p className="hint">لا توجد حسابات سكرتارية بعد.</p>}
      </ul>

      <h3 className="section-title">الأدمن</h3>
      <ul className="list">
        {admins.map((u) => (
          <li key={u.id} className="list-row acc-row">
            <span className="avatar">{u.username.charAt(0)}</span>
            <span className="flex1">{u.username}</span>
            <span className="dim small">صلاحية كاملة</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AdminAdmins({ session, refreshUsers, showToast }) {
  const [admins, setAdmins] = useState([]);
  const [adminInvites, setAdminInvites] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [phone, setPhone] = useState("");
  const [genBusy, setGenBusy] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");

  const load = useCallback(async () => {
    const list = await refreshUsers();
    setAdmins(list.filter((u) => u.role === "admin"));
    const invites = await loadKey("admin-invites", [], true);
    setAdminInvites(invites.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  }, [refreshUsers]);

  useEffect(() => { load(); }, [load]);

  const generateInvite = async () => {
    if (!phone.trim()) return;
    setGenBusy(true);
    const code = Array.from({ length: 6 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]).join("");
    const all = await loadKey("admin-invites", [], true);
    const item = { code, phone: phone.trim(), createdAt: new Date().toISOString(), used: false };
    await saveKey("admin-invites", [...all, item], true);
    await load();
    setPhone(""); setShowAdd(false); setGenBusy(false);
    showToast("تم إنشاء كود دعوة الأدمن");
  };

  const startEdit = (u) => {
    setEditingId(u.id);
    setEditEmail(u.username);
    setEditPhone(u.phone || "");
  };

  const saveEdit = async (u) => {
    if (u.isSuperAdmin) return;
    if (!isEmail(editEmail.trim())) return;
    const list = await refreshUsers();
    const id = editEmail.trim().toLowerCase();
    if (list.find((x) => x.id !== u.id && (x.username || "").toLowerCase() === id)) {
      showToast("البريد الإلكتروني مستخدم بالفعل", "error");
      return;
    }
    const next = list.map((x) => (x.id === u.id ? { ...x, username: editEmail.trim(), phone: editPhone.trim() } : x));
    await saveKey("users", next, true);
    await load();
    setEditingId(null);
    showToast("تم تحديث بيانات الأدمن");
  };

  const revoke = async (u) => {
    if (u.isSuperAdmin) return;
    const list = await refreshUsers();
    const next = list.map((x) =>
      x.id === u.id ? { ...x, role: "teacher", isSuperAdmin: false, trialStart: new Date().toISOString(), subscribed: false } : x
    );
    await saveKey("users", next, true);
    await load();
    showToast("تم إلغاء صلاحية الأدمن");
  };

  const remove = async (u) => {
    if (u.isSuperAdmin) return;
    const list = await refreshUsers();
    const next = list.filter((x) => x.id !== u.id);
    await saveKey("users", next, true);
    await load();
    showToast("تم حذف حساب الأدمن");
  };

  return (
    <div className="content">
      <h2 className="page-title">إدارة الأدمن</h2>
      <p className="dim small">هذا القسم متاح فقط للأدمن الأساسي. الأدمن الأساسي محمي ولا يمكن حذفه أو إلغاء صلاحيته.</p>

      {!showAdd ? (
        <button className="primary-btn" onClick={() => setShowAdd(true)}>
          <UserPlus size={16} /> إضافة أدمن جديد (كود دعوة)
        </button>
      ) : (
        <div className="card auth-card">
          <label className="field-label">رقم هاتف الأدمن الجديد</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" placeholder="01xxxxxxxxx" />
          <p className="hint">هيتم إنشاء كود دعوة — شاركه مع الأدمن الجديد، وهو هيسجّل حسابه بنفسه (بريده وكلمة مروره الخاصة) من شاشة "لدي كود دعوة".</p>
          <div className="modal-actions">
            <button className="primary-btn full" disabled={genBusy || !phone.trim()} onClick={generateInvite}>إنشاء كود الدعوة</button>
            <button className="ghost-btn full" onClick={() => setShowAdd(false)}>إلغاء</button>
          </div>
        </div>
      )}

      {adminInvites.length > 0 && (
        <>
          <h3 className="section-title">أكواد الدعوة</h3>
          <ul className="list">
            {adminInvites.map((i) => (
              <li key={i.code} className="list-row">
                <span className="flex1" dir="ltr" style={{ fontWeight: 700, letterSpacing: 1 }}>{i.code}</span>
                <span className="dim small" dir="ltr">{i.phone}</span>
                <span className={"badge " + (i.used ? "rejected" : "approved")}>{i.used ? "مستخدم" : "متاح"}</span>
                {!i.used && (
                  <button className="copy-btn" onClick={() => { navigator.clipboard?.writeText(i.code); showToast("تم نسخ الكود"); }}>
                    <Copy size={14} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      <h3 className="section-title">الأدمن الحاليون</h3>
      <ul className="list">
        {admins.map((u) => (
          <li key={u.id} className="list-row acc-row" style={{ flexWrap: "wrap" }}>
            {editingId === u.id ? (
              <div className="card auth-card" style={{ width: "100%" }}>
                <label className="field-label">البريد الإلكتروني</label>
                <input value={editEmail} onChange={(e) => setEditEmail(e.target.value)} dir="ltr" />
                <label className="field-label">رقم الهاتف</label>
                <input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} dir="ltr" />
                <div className="modal-actions">
                  <button className="primary-btn full" onClick={() => saveEdit(u)}>حفظ</button>
                  <button className="ghost-btn full" onClick={() => setEditingId(null)}>إلغاء</button>
                </div>
              </div>
            ) : (
              <>
                <span className="avatar">{u.username.charAt(0)}</span>
                <span className="flex1">
                  {u.username}
                  {u.phone && <span className="dim small" dir="ltr"> — {u.phone}</span>}
                </span>
                {u.isSuperAdmin ? (
                  <span className="badge approved">الأدمن الأساسي</span>
                ) : (
                  <>
                    <button className="copy-btn" onClick={() => startEdit(u)} title="تعديل">
                      <Settings size={14} />
                    </button>
                    <button className="ghost-btn" onClick={() => revoke(u)}>إلغاء الصلاحية</button>
                    <button className="remove-btn" onClick={() => remove(u)}>حذف</button>
                  </>
                )}
              </>
            )}
          </li>
        ))}
        {admins.length === 0 && <p className="hint">لا يوجد أدمن حاليًا.</p>}
      </ul>
    </div>
  );
}

// ================= Styles =================
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;900&display=swap');
* { box-sizing: border-box; }
.app-root {
  min-height: 100vh;
  background: #0b1220;
  font-family: 'Tajawal', sans-serif;
  color: #eef1f7;
  direction: rtl;
}
.center-screen { display:flex; align-items:center; justify-content:center; }
.dim { color: #8b93a7; }
.dim.small, .small { font-size: 0.8rem; }

.screen { max-width: 480px; margin: 0 auto; padding: 24px 18px 20px; min-height: 100vh; position: relative; }
.screen.with-nav { padding-bottom: 90px; }
.content { padding-top: 4px; }

.brand { font-size: 1.9rem; font-weight: 900; margin: 6px 0 4px; }
.brand.small { font-size: 1.4rem; }
.brand.medium { font-size: 1.6rem; margin-top:0; }
.hero { text-align: center; margin: 30px 0 26px; }
.hero .dim { max-width: 320px; margin: 0 auto; line-height: 1.6; font-size: 0.9rem; }

.guest-grid { display:grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 18px; }
.guest-card {
  background: #141c30; border:1px solid rgba(255,255,255,0.06); border-radius: 16px;
  padding: 16px; display:flex; flex-direction:column; align-items:flex-start; gap:8px; cursor:pointer;
}
.guest-note { text-align:center; color:#8b93a7; font-size:0.82rem; margin: 10px 0 22px; }
.guest-actions { display:flex; flex-direction:column; gap: 10px; }

.icon-badge { width:42px; height:42px; border-radius:12px; display:flex; align-items:center; justify-content:center; }
.icon-badge.blueish { background: rgba(47,95,214,0.16); color:#6a8ef0; }

.primary-btn {
  background: #2f5fd6; color:#fff; border:none; padding:12px 18px; border-radius:12px;
  font-family:'Tajawal',sans-serif; font-weight:700; cursor:pointer; display:flex; align-items:center; gap:6px; justify-content:center;
  font-size:0.92rem;
}
.primary-btn:disabled { opacity:0.6; }
.primary-btn.full, .ghost-btn.full { width:100%; }
.ghost-btn {
  background: transparent; color:#c7cede; border:1px solid rgba(255,255,255,0.15); padding:12px 18px; border-radius:12px;
  font-family:'Tajawal',sans-serif; font-weight:700; cursor:pointer; display:flex; align-items:center; gap:6px; justify-content:center;
}
.danger-btn {
  background: rgba(224,82,96,0.16); color:#e05260; border:1px solid #e05260; padding:12px 18px; border-radius:12px;
  font-weight:700; cursor:pointer; display:flex; align-items:center; gap:6px; justify-content:center;
}

.back-btn { background:none; border:none; color:#8b93a7; display:flex; align-items:center; gap:4px; padding:0; margin-bottom:10px; cursor:pointer; font-family:'Tajawal',sans-serif; }
.auth-tabs { display:flex; gap:8px; margin: 14px 0; }
.auth-tabs button { flex:1; background:#141c30; border:1px solid rgba(255,255,255,0.06); color:#8b93a7; padding:10px; border-radius:10px; font-weight:700; cursor:pointer; font-family:'Tajawal',sans-serif;}
.auth-tabs button.active { background:#2f5fd6; color:#fff; border-color:#2f5fd6; }

.card { background:#141c30; border:1px solid rgba(255,255,255,0.06); border-radius:16px; padding:16px; margin-bottom:14px; }
.auth-card { display:flex; flex-direction:column; gap:8px; }
.field-label { font-size:0.78rem; color:#8b93a7; margin-top:4px; }

input {
  background: #0f1626; border:1px solid rgba(255,255,255,0.1); color:#eef1f7; padding:11px 12px;
  border-radius:10px; font-family:'Tajawal',sans-serif; outline:none; font-size:0.9rem;
}
input:focus { border-color:#2f5fd6; }
.max-input { width: 90px; }

.trial-banner {
  background: linear-gradient(90deg, rgba(47,95,214,0.18), rgba(139,111,224,0.18));
  border:1px solid rgba(106,142,240,0.35); border-radius:14px; padding:12px 14px;
  display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; cursor:pointer; font-size:0.85rem;
}
.trial-banner .pill { background:#2f5fd6; color:#fff; padding:5px 12px; border-radius:20px; font-weight:700; font-size:0.78rem; white-space:nowrap; }

.stat-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin: 14px 0 20px; }
.stat-card { display:flex; flex-direction:column; gap:8px; }
.stat-value { font-size:1.5rem; font-weight:900; }

.section-title { font-size:0.95rem; font-weight:700; margin: 20px 0 10px; color:#c7cede; }
.quick-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
.quick-card { display:flex; flex-direction:column; align-items:flex-start; gap:8px; cursor:pointer; font-family:'Tajawal',sans-serif; color:#eef1f7; font-size:0.88rem; font-weight:600; text-align:right; }
.quick-card.disabled { opacity:0.4; cursor:not-allowed; }
.menu-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom: 10px; }

.empty-note { display:flex; align-items:center; gap:8px; justify-content:center; }

.page-title { font-size:1.3rem; font-weight:900; margin: 4px 0 16px; }
.row-form { display:flex; gap:8px; align-items:center; flex-wrap:wrap; margin-bottom:14px; }
.date-label { display:flex; align-items:center; gap:8px; color:#8b93a7; font-size:0.85rem; }

.class-tabs { display:flex; gap:8px; flex-wrap:wrap; margin-bottom:16px; }
.class-chip { --c:#2f5fd6; background: rgba(255,255,255,0.04); border:1px solid var(--c); color:#eef1f7; padding:7px 14px; border-radius:20px; font-size:0.82rem; font-weight:600; cursor:pointer; font-family:'Tajawal',sans-serif;}
.class-chip.active { background: var(--c); }

.list { list-style:none; padding:0; margin:0; }
.list-row { display:flex; align-items:center; gap:10px; padding:12px 4px; border-bottom:1px solid rgba(255,255,255,0.06); cursor:pointer; }
.list-row.active { background: rgba(47,95,214,0.08); border-radius:10px; }
.flex1 { flex:1; }
.dot { width:10px; height:10px; border-radius:50%; flex-shrink:0; }
.avatar { width:30px; height:30px; border-radius:50%; background:rgba(47,95,214,0.2); color:#6a8ef0; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:0.8rem; flex-shrink:0; }
.remove-btn { background:none; border:none; color:#e05260; font-weight:700; font-size:0.78rem; cursor:pointer; font-family:'Tajawal',sans-serif; }
.status-pill { --c:#8b93a7; background: color-mix(in srgb, var(--c) 20%, transparent); color:var(--c); border:1px solid var(--c); font-weight:700; min-width:74px; padding:6px 10px; border-radius:10px; cursor:pointer; font-family:'Tajawal',sans-serif; font-size:0.8rem; }
.hint { color:#6b7385; font-size:0.85rem; margin: 10px 2px; }
.hint.center { text-align:center; margin-top: 18px; }

.table-wrap { overflow-x:auto; }
.grade-table { border-collapse:collapse; width:100%; min-width: 420px; }
.grade-table th, .grade-table td { padding:8px 10px; text-align:center; border-bottom:1px solid rgba(255,255,255,0.06); font-size:0.82rem; white-space:nowrap; }
.grade-table thead th { color:#8b93a7; border-bottom:2px solid rgba(255,255,255,0.14); }
.sticky-col { position:sticky; right:0; background:#0b1220; text-align:right !important; }
.assign-head { display:flex; align-items:center; gap:4px; justify-content:center; }
.remove-x { color:#e05260; opacity:0.6; cursor:pointer; font-size:0.7rem; }
.score-input { width:52px; text-align:center; background:transparent; border:none; border-bottom:1px solid rgba(255,255,255,0.2); padding:4px 2px; }
.avg-cell { font-weight:700; color:#d4a017; }

.badge { font-size:0.7rem; padding:4px 9px; border-radius:20px; font-weight:700; }
.badge.pending { background: rgba(212,160,23,0.16); color:#d4a017; }
.badge.approved { background: rgba(31,174,102,0.16); color:#1fae66; }
.badge.rejected { background: rgba(224,82,96,0.16); color:#e05260; }
.role-tag { min-width:56px; }

.lock-screen { display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; gap:10px; padding: 90px 20px; }
.lock-screen h2 { margin:0; font-size:1.2rem; }

.bottom-nav {
  position:fixed; bottom:0; left:0; right:0; max-width:480px; margin:0 auto;
  background:#0f1626; border-top:1px solid rgba(255,255,255,0.08);
  display:flex; justify-content:space-around; padding: 8px 4px calc(8px + env(safe-area-inset-bottom));
}
.nav-item { background:none; border:none; color:#6b7385; display:flex; flex-direction:column; align-items:center; gap:3px; font-size:0.68rem; cursor:pointer; font-family:'Tajawal',sans-serif; padding:4px 6px; }
.nav-item.active { color:#6a8ef0; }

.toast { position:fixed; top:16px; left:50%; transform:translateX(-50%); background:#141c30; border:1px solid rgba(255,255,255,0.15); color:#eef1f7; padding:10px 18px; border-radius:12px; z-index:50; font-size:0.85rem; }
.toast.error { border-color:#e05260; color:#e05260; }

.modal-backdrop { position:fixed; inset:0; background:rgba(0,0,0,0.6); display:flex; align-items:center; justify-content:center; z-index:60; padding:20px; }
.modal-card { background:#141c30; border-radius:16px; padding:18px; max-width:360px; width:100%; position:relative; }
.modal-close { position:absolute; top:10px; right:10px; background:none; border:none; color:#8b93a7; cursor:pointer; }
.receipt-img { width:100%; border-radius:10px; margin: 10px 0; }
.modal-actions { display:flex; gap:10px; margin-top:10px; }
.ok-icon { color:#1fae66; vertical-align:middle; margin-left:4px; }

@media (max-width:380px) {
  .guest-grid, .stat-grid, .quick-grid, .menu-grid { grid-template-columns: 1fr 1fr; }
}

.splash-screen {
  min-height: 100vh; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:14px;
  background: radial-gradient(circle at 50% 32%, #16213a 0%, #0b1220 70%);
  text-align:center; padding: 20px;
}
.splash-logo {
  width:84px; height:84px; border-radius:24px;
  background: linear-gradient(135deg, #2f5fd6, #8b6fe0);
  display:flex; align-items:center; justify-content:center; color:#fff;
  box-shadow: 0 0 40px rgba(47,95,214,0.4);
}
.splash-title { font-size:1.7rem; font-weight:900; margin:4px 0 0; letter-spacing:0.3px; }
.splash-sub { color:#8b93a7; font-size:0.85rem; margin:0; }
.splash-dots { display:flex; gap:6px; margin-top:18px; }
.splash-dots span { width:7px; height:7px; border-radius:50%; background:#2f5fd6; opacity:0.4; animation: dotPulse 1.1s infinite ease-in-out; }
.splash-dots span:nth-child(2) { animation-delay:0.15s; }
.splash-dots span:nth-child(3) { animation-delay:0.3s; }
@keyframes dotPulse { 0%,80%,100% { opacity:0.3; transform:scale(0.85);} 40% { opacity:1; transform:scale(1);} }

.vf-card { display:flex; flex-direction:column; gap:10px; }
.vf-row { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
.vf-badge { background: rgba(224,44,80,0.16); color:#e02c50; font-weight:700; font-size:0.75rem; padding:5px 10px; border-radius:8px; }
.vf-number { font-weight:900; font-size:1.05rem; letter-spacing:0.5px; }
.copy-btn { margin-inline-start:auto; background: rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.15); color:#eef1f7; padding:6px 10px; border-radius:8px; font-size:0.78rem; display:flex; align-items:center; gap:5px; cursor:pointer; font-family:'Tajawal',sans-serif; }

.ai-modal { display:flex; flex-direction:column; max-height:80vh; padding:0; overflow:hidden; }
.ai-header { display:flex; align-items:center; justify-content:space-between; padding:14px 16px; border-bottom:1px solid rgba(255,255,255,0.08); }
.ai-title { display:flex; align-items:center; gap:6px; font-weight:700; color:#8b6fe0; }
.modal-close-inline { background:none; border:none; color:#8b93a7; cursor:pointer; }
.ai-messages { flex:1; overflow-y:auto; padding:14px 16px; display:flex; flex-direction:column; gap:10px; }
.ai-bubble { max-width:85%; padding:9px 12px; border-radius:14px; font-size:0.86rem; line-height:1.6; white-space:pre-wrap; }
.ai-bubble.assistant { background:#1a2338; align-self:flex-start; border-bottom-left-radius:4px; }
.ai-bubble.user { background:#2f5fd6; color:#fff; align-self:flex-end; border-bottom-right-radius:4px; }
.ai-input-row { display:flex; gap:8px; padding:12px 14px; border-top:1px solid rgba(255,255,255,0.08); }
.ai-input-row input { flex:1; }

.acc-row { flex-wrap:wrap; }
.toggle-btn { background:none; border:none; cursor:pointer; display:flex; align-items:center; }
.admin-quick-btn { margin-top: 4px; }

.landing-screen { display:flex; flex-direction:column; justify-content:space-between; min-height: calc(100vh - 40px); }
.landing-center { display:flex; flex-direction:column; align-items:center; text-align:center; margin-top: 14vh; gap:6px; }
.landing-logo {
  width:80px; height:80px; border-radius:22px;
  background: linear-gradient(135deg, #2f5fd6, #4a7ae0);
  display:flex; align-items:center; justify-content:center; color:#fff;
  box-shadow: 0 10px 30px rgba(47,95,214,0.35);
  margin-bottom: 6px;
}
.landing-sub { max-width: 260px; font-size:0.88rem; line-height:1.6; }
.landing-badges { display:flex; gap:10px; margin-top:10px; }
.landing-badge { display:flex; align-items:center; gap:5px; background:#141c30; border:1px solid rgba(255,255,255,0.1); color:#c7cede; font-size:0.75rem; padding:5px 11px; border-radius:20px; }
.landing-actions { display:flex; flex-direction:column; gap:10px; padding-bottom: 20px; }
.link-btn { background:none; border:none; color:#8b93a7; font-size:0.85rem; display:flex; align-items:center; justify-content:center; gap:6px; padding:6px; cursor:pointer; font-family:'Tajawal',sans-serif; }

.otp-input { text-align:center; font-size:1.3rem; letter-spacing:6px; font-weight:900; }
.otp-demo-note { background: rgba(212,160,23,0.1); border:1px solid rgba(212,160,23,0.3); padding:10px; border-radius:10px; color:#d4a017; }

.plan-card { position:relative; }
.plan-name { margin:0 0 4px; font-size:1rem; }
.plan-price { font-size:1.4rem; font-weight:900; margin: 0 0 12px; }
.plan-price.gold { color:#d4a017; }
.plan-features { list-style:none; padding:0; margin:0 0 12px; display:flex; flex-direction:column; gap:7px; font-size:0.85rem; }
.plan-features li { display:flex; align-items:center; gap:7px; }
.pro-card { border:1px solid #d4a017; background: linear-gradient(160deg, rgba(212,160,23,0.08), #141c30 60%); }
.pro-badge { position:absolute; top:14px; right:14px; background:#d4a017; color:#1b1400; font-weight:900; font-size:0.68rem; padding:3px 9px; border-radius:8px; }
.billing-toggle { display:flex; gap:8px; margin-bottom:12px; }
.billing-toggle button { flex:1; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.12); color:#8b93a7; padding:7px; border-radius:8px; font-size:0.8rem; font-weight:700; cursor:pointer; font-family:'Tajawal',sans-serif; }
.billing-toggle button.active { background:#d4a017; color:#1b1400; border-color:#d4a017; }
.sub-toggle { border:none; cursor:pointer; }
.check-row { display:flex; align-items:center; gap:8px; font-size:0.85rem; color:#c7cede; margin: 10px 0; }
.check-row input { width:16px; height:16px; accent-color:#2f5fd6; }
.search-row { display:flex; align-items:center; gap:8px; background:#141c30; border:1px solid rgba(255,255,255,0.1); border-radius:12px; padding:9px 12px; margin-bottom:12px; }
.search-row input { flex:1; background:none; border:none; color:#eef1f7; font-family:'Tajawal',sans-serif; font-size:0.9rem; }
.search-row input:focus { outline:none; }
.sub-row { flex-wrap:wrap; gap:8px; }
.support-option { flex-direction:row !important; align-items:center; width:100%; margin-bottom:10px; text-decoration:none; border:none; }
`;
