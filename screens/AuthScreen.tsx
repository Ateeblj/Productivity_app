// screens/AuthScreen.tsx
// Solo flow only:
//   New  → Database once → Create account → verify email → Log in
//   Return → Log in (database already saved on device)
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  Pressable,
  Share,
} from 'react-native';
import { useContext } from 'react';
import { useTheme } from '../context/ThemeContext';
import { AuthContext } from '../context/AuthContext';
import { signIn, signUp, resendConfirmationEmail } from '../services/authService';
import colors from '../utils/colors';
import {
  getSupabaseConfigSnapshot,
  hasUserDatabaseSetup,
  initSupabaseFromStorage,
  saveSupabaseCredentials,
  testSupabaseConnection,
  isSupabaseConfigured,
  SUPABASE_DASHBOARD_URL,
  SUPABASE_SIGNUP_URL,
} from '../services/supabaseClient';
import { SUPABASE_SETUP_SQL } from '../services/supabaseSchema';
import { openExternal } from '../utils/openExternal';

type Screen = 'welcome' | 'database' | 'create' | 'verify' | 'login';

export default function AuthScreen() {
  const { isDark } = useTheme();
  const palette = isDark ? colors.dark : colors.light;
  const { enterGuestMode } = useContext(AuthContext);

  const [screen, setScreen] = useState<Screen>('welcome');
  const [pendingAfterDb, setPendingAfterDb] = useState<'create' | 'login'>('create');

  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [supabaseKey, setSupabaseKey] = useState('');
  const [dbStatus, setDbStatus] = useState('');
  const [dbBusy, setDbBusy] = useState(false);
  const [dbReady, setDbReady] = useState(false);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [resendStatus, setResendStatus] = useState('');
  const [infoMsg, setInfoMsg] = useState('');

  useEffect(() => {
    (async () => {
      await initSupabaseFromStorage();
      const ready = await hasUserDatabaseSetup();
      setDbReady(ready);
      const snap = getSupabaseConfigSnapshot();
      if (snap.url) setSupabaseUrl(snap.url);
    })().catch(() => {});
  }, []);

  const inputStyle = {
    backgroundColor: isDark ? '#1a1a2e' : '#f5f5f5',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: palette.text,
    borderWidth: 1,
    borderColor: isDark ? '#2a2a3e' : '#e5e5e5',
    marginBottom: 12,
  } as const;

  async function goCreateAccount() {
    setErrorMsg('');
    setInfoMsg('');
    const ready = await hasUserDatabaseSetup();
    setDbReady(ready);
    if (!ready) {
      setPendingAfterDb('create');
      setDbStatus('One-time setup: connect your Supabase project, then create your account.');
      setScreen('database');
      return;
    }
    await initSupabaseFromStorage();
    setScreen('create');
  }

  async function goLogin() {
    setErrorMsg('');
    setInfoMsg('');
    const ready = await hasUserDatabaseSetup();
    setDbReady(ready);
    if (!ready) {
      setPendingAfterDb('login');
      setDbStatus('Paste the Project URL + anon key for the project where your account lives (once on this device).');
      setScreen('database');
      return;
    }
    await initSupabaseFromStorage();
    setScreen('login');
  }

  async function onTestDb() {
    setDbStatus('Testing…');
    setDbBusy(true);
    try {
      const r = await testSupabaseConnection(supabaseUrl, supabaseKey);
      setDbStatus(r.message);
    } catch (e: any) {
      setDbStatus(e?.message || 'Test failed');
    } finally {
      setDbBusy(false);
    }
  }

  async function onSaveDb() {
    setDbStatus('Saving…');
    setDbBusy(true);
    try {
      const r = await testSupabaseConnection(supabaseUrl, supabaseKey);
      if (!r.ok) {
        setDbStatus(r.message);
        return;
      }
      await saveSupabaseCredentials(supabaseUrl, supabaseKey);
      setDbReady(true);
      setDbStatus('Saved on this device. You won’t need to enter these again for normal logins.');
      setScreen(pendingAfterDb === 'login' ? 'login' : 'create');
    } catch (e: any) {
      setDbStatus(e?.message || 'Could not save');
    } finally {
      setDbBusy(false);
    }
  }

  async function onCopySql() {
    try {
      if (Platform.OS === 'web' && (navigator as any)?.clipboard?.writeText) {
        await (navigator as any).clipboard.writeText(SUPABASE_SETUP_SQL);
        Alert.alert('Copied', 'Supabase → SQL Editor → paste → Run (once).');
      } else {
        await Share.share({ message: SUPABASE_SETUP_SQL, title: 'Setup SQL' });
      }
    } catch {
      Alert.alert('SQL', 'Long-press the SQL text and copy.');
    }
  }

  async function onCreateAccount() {
    setErrorMsg('');
    if (!name.trim()) return setErrorMsg('Enter your name.');
    if (!email.trim()) return setErrorMsg('Enter your email.');
    if (password.length < 6) return setErrorMsg('Password must be at least 6 characters.');
    if (password !== confirmPassword) return setErrorMsg('Passwords do not match.');
    setLoading(true);
    try {
      const result = await signUp(email.trim(), password, name.trim());
      if (!result.success) {
        setErrorMsg(result.error ?? 'Could not create account.');
        return;
      }
      if (result.needsEmailConfirmation) {
        setInfoMsg('');
        setScreen('verify');
        return;
      }
      // Session created immediately (email confirm disabled on project)
    } finally {
      setLoading(false);
    }
  }

  async function onLogin() {
    setErrorMsg('');
    if (!email.trim() || !password) return setErrorMsg('Enter email and password.');
    setLoading(true);
    try {
      const result = await signIn(email.trim(), password);
      if (!result.success) setErrorMsg(result.error ?? 'Login failed.');
    } finally {
      setLoading(false);
    }
  }

  const projectHint = (() => {
    const u = getSupabaseConfigSnapshot().url;
    return u ? u.replace(/^https?:\/\//, '') : null;
  })();

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: palette.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={{ fontSize: 28, fontWeight: '800', color: palette.primary, textAlign: 'center' }}>
          Productivity
        </Text>
        <Text style={{ fontSize: 13, color: palette.textMuted, textAlign: 'center', marginTop: 8, marginBottom: 28, lineHeight: 19 }}>
          Your database · your account · email verification
        </Text>

        {/* WELCOME */}
        {screen === 'welcome' && (
          <View>
            <Text style={{ fontSize: 20, fontWeight: '800', color: palette.text, marginBottom: 8 }}>Welcome</Text>
            <Text style={{ fontSize: 13, color: palette.textMuted, lineHeight: 19, marginBottom: 20 }}>
              New here? Connect your Supabase database once, create an account, verify your email, then use the app.
              Returning? Just log in — database stays saved on this device.
            </Text>
            <Pressable
              onPress={goCreateAccount}
              style={{ backgroundColor: palette.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginBottom: 12 }}
            >
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>Create account</Text>
            </Pressable>
            <Pressable
              onPress={goLogin}
              style={{ borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginBottom: 12, borderWidth: 1, borderColor: palette.primary }}
            >
              <Text style={{ color: palette.primary, fontWeight: '800', fontSize: 15 }}>Log in</Text>
            </Pressable>
            <Pressable onPress={() => enterGuestMode()} style={{ paddingVertical: 14, alignItems: 'center' }}>
              <Text style={{ color: palette.textMuted, fontSize: 13 }}>Continue offline as guest</Text>
            </Pressable>
            {dbReady && projectHint ? (
              <Text style={{ marginTop: 16, fontSize: 11, color: palette.textMuted, textAlign: 'center' }}>
                Database on this device: {projectHint}
              </Text>
            ) : null}
          </View>
        )}

        {/* DATABASE — only when needed, once per device */}
        {screen === 'database' && (
          <View>
            <Text style={{ fontSize: 20, fontWeight: '800', color: palette.text, marginBottom: 8 }}>
              Database setup (once)
            </Text>
            <Text style={{ fontSize: 13, color: palette.textMuted, lineHeight: 19, marginBottom: 14 }}>
              Free Supabase project → paste Project URL + anon public key → Test → Save → run SQL once.
              After this, normal logins only need email and password.
            </Text>
            <Pressable
              onPress={() => openExternal(SUPABASE_SIGNUP_URL)}
              style={{ padding: 12, borderRadius: 10, backgroundColor: isDark ? 'rgba(167,139,250,0.15)' : '#ede9fe', marginBottom: 8 }}
            >
              <Text style={{ color: palette.primary, fontWeight: '700', fontSize: 13 }}>Open Supabase</Text>
            </Pressable>
            <Pressable
              onPress={() => openExternal(SUPABASE_DASHBOARD_URL)}
              style={{ padding: 12, borderRadius: 10, backgroundColor: isDark ? '#1a1a2e' : '#f3f4f6', marginBottom: 14 }}
            >
              <Text style={{ color: palette.text, fontWeight: '600', fontSize: 13 }}>API settings (URL + anon key)</Text>
            </Pressable>

            <Text style={{ fontSize: 11, fontWeight: '700', color: palette.textMuted, marginBottom: 4 }}>Project URL</Text>
            <TextInput
              style={inputStyle}
              value={supabaseUrl}
              onChangeText={setSupabaseUrl}
              placeholder="https://xxxx.supabase.co"
              placeholderTextColor={palette.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={{ fontSize: 11, fontWeight: '700', color: palette.textMuted, marginBottom: 4 }}>anon public key</Text>
            <TextInput
              style={inputStyle}
              value={supabaseKey}
              onChangeText={setSupabaseKey}
              placeholder="eyJhbGciOi…"
              placeholderTextColor={palette.textMuted}
              autoCapitalize="none"
              secureTextEntry
            />

            {!!dbStatus && (
              <Text
                style={{
                  marginBottom: 12,
                  fontSize: 13,
                  fontWeight: '600',
                  lineHeight: 18,
                  color: dbStatus.includes('OK') || dbStatus.includes('Saved') ? '#34d399' : '#f87171',
                }}
              >
                {dbStatus}
              </Text>
            )}

            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
              <Pressable onPress={onTestDb} disabled={dbBusy} style={{ flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: palette.primary, alignItems: 'center' }}>
                <Text style={{ color: palette.primary, fontWeight: '700' }}>{dbBusy ? '…' : 'Test'}</Text>
              </Pressable>
              <Pressable onPress={onSaveDb} disabled={dbBusy} style={{ flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: palette.primary, alignItems: 'center' }}>
                <Text style={{ color: '#fff', fontWeight: '700' }}>{dbBusy ? '…' : 'Save & continue'}</Text>
              </Pressable>
            </View>

            <Text style={{ fontSize: 13, fontWeight: '700', color: palette.text, marginBottom: 6 }}>SQL (run once in SQL Editor)</Text>
            <View style={{ maxHeight: 90, borderRadius: 10, borderWidth: 1, borderColor: isDark ? '#2a2a3e' : '#ddd', padding: 10, marginBottom: 8, backgroundColor: isDark ? '#0b0b14' : '#f8f8fa' }}>
              <Text selectable style={{ fontSize: 10, color: palette.textSecondary, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }}>
                {SUPABASE_SETUP_SQL}
              </Text>
            </View>
            <Pressable onPress={onCopySql} style={{ paddingVertical: 12, borderRadius: 10, backgroundColor: isDark ? 'rgba(52,211,153,0.15)' : '#ecfdf5', alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ color: '#34d399', fontWeight: '700' }}>Copy SQL</Text>
            </Pressable>

            <Pressable onPress={() => setScreen('welcome')} style={{ alignItems: 'center', paddingVertical: 10 }}>
              <Text style={{ color: palette.textMuted }}>← Back</Text>
            </Pressable>
          </View>
        )}

        {/* CREATE ACCOUNT */}
        {screen === 'create' && (
          <View>
            <Text style={{ fontSize: 20, fontWeight: '800', color: palette.text, marginBottom: 8 }}>Create account</Text>
            <Text style={{ fontSize: 13, color: palette.textMuted, marginBottom: 14, lineHeight: 19 }}>
              We’ll send a verification email. After you confirm, log in with the same email and password.
              {projectHint ? `\nDatabase: ${projectHint}` : ''}
            </Text>
            <TextInput style={inputStyle} value={name} onChangeText={setName} placeholder="Name" placeholderTextColor={palette.textMuted} />
            <TextInput style={inputStyle} value={email} onChangeText={setEmail} placeholder="Email" placeholderTextColor={palette.textMuted} autoCapitalize="none" keyboardType="email-address" />
            <TextInput style={inputStyle} value={password} onChangeText={setPassword} placeholder="Password (min 6)" placeholderTextColor={palette.textMuted} secureTextEntry />
            <TextInput style={inputStyle} value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Confirm password" placeholderTextColor={palette.textMuted} secureTextEntry />
            {!!errorMsg && <Text style={{ color: '#f87171', marginBottom: 12, fontWeight: '600' }}>{errorMsg}</Text>}
            <Pressable onPress={onCreateAccount} disabled={loading} style={{ backgroundColor: palette.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center', opacity: loading ? 0.6 : 1 }}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '800' }}>Create account</Text>}
            </Pressable>
            <Pressable onPress={() => setScreen('welcome')} style={{ alignItems: 'center', paddingVertical: 14 }}>
              <Text style={{ color: palette.textMuted }}>← Back</Text>
            </Pressable>
          </View>
        )}

        {/* VERIFY EMAIL */}
        {screen === 'verify' && (
          <View>
            <Text style={{ fontSize: 20, fontWeight: '800', color: palette.text, marginBottom: 8 }}>
              Verify your email
            </Text>
            <Text style={{ fontSize: 14, color: palette.textMuted, lineHeight: 21, marginBottom: 12 }}>
              {'Supabase should email a link to '}
              <Text style={{ fontWeight: '700', color: palette.text }}>{email.trim() || 'your email'}</Text>
              {'.'}
            </Text>
            <Text style={{ fontSize: 13, color: palette.textMuted, lineHeight: 20, marginBottom: 12 }}>
              No email? Check spam. Old links expire — use Resend below. Still nothing? In Supabase: Authentication → Providers → Email → turn OFF Confirm email, then Log in with the same email and password.
            </Text>
            {!!resendStatus && (
              <Text style={{ color: resendStatus.startsWith('Sent') ? '#34d399' : '#f87171', marginBottom: 12, fontWeight: '600' }}>
                {resendStatus}
              </Text>
            )}
            <Pressable
              onPress={async () => {
                setResendStatus('Sending…');
                const r = await resendConfirmationEmail(email.trim());
                setResendStatus(r.success ? 'Sent — check inbox and spam.' : (r.error || 'Could not resend'));
              }}
              style={{
                borderRadius: 14,
                paddingVertical: 14,
                alignItems: 'center',
                marginBottom: 10,
                borderWidth: 1,
                borderColor: palette.primary,
              }}
            >
              <Text style={{ color: palette.primary, fontWeight: '800' }}>Resend verification email</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setErrorMsg('');
                setResendStatus('');
                setScreen('login');
              }}
              style={{ backgroundColor: palette.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginBottom: 12 }}
            >
              <Text style={{ color: '#fff', fontWeight: '800' }}>I’ve verified — Log in</Text>
            </Pressable>
            <Pressable onPress={() => setScreen('welcome')} style={{ alignItems: 'center', paddingVertical: 10 }}>
              <Text style={{ color: palette.textMuted }}>← Back</Text>
            </Pressable>
          </View>
        )}

        {/* LOGIN */}
        {screen === 'login' && (
          <View>
            <Text style={{ fontSize: 20, fontWeight: '800', color: palette.text, marginBottom: 8 }}>Log in</Text>
            <Text style={{ fontSize: 13, color: palette.textMuted, marginBottom: 14, lineHeight: 19 }}>
              {projectHint
                ? `Using saved database: ${projectHint}`
                : 'No database saved yet — you’ll be asked once if needed.'}
            </Text>
            <TextInput style={inputStyle} value={email} onChangeText={setEmail} placeholder="Email" placeholderTextColor={palette.textMuted} autoCapitalize="none" keyboardType="email-address" />
            <TextInput style={inputStyle} value={password} onChangeText={setPassword} placeholder="Password" placeholderTextColor={palette.textMuted} secureTextEntry />
            {!!errorMsg && <Text style={{ color: '#f87171', marginBottom: 12, fontWeight: '600' }}>{errorMsg}</Text>}
            {!!infoMsg && <Text style={{ color: '#34d399', marginBottom: 12, fontWeight: '600' }}>{infoMsg}</Text>}
            <Pressable onPress={onLogin} disabled={loading} style={{ backgroundColor: palette.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center', opacity: loading ? 0.6 : 1 }}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '800' }}>Log in</Text>}
            </Pressable>
            <Pressable
              onPress={() => {
                setPendingAfterDb('login');
                setScreen('database');
              }}
              style={{ alignItems: 'center', paddingVertical: 14 }}
            >
              <Text style={{ color: palette.primary, fontWeight: '600', fontSize: 13 }}>Change database on this device</Text>
            </Pressable>
            <Pressable onPress={() => setScreen('welcome')} style={{ alignItems: 'center', paddingVertical: 6 }}>
              <Text style={{ color: palette.textMuted }}>← Back</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
