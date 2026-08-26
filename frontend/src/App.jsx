import { useState, useEffect, useCallback } from 'react';

const API = import.meta.env.VITE_API_URL || '';

// ── Theme ─────────────────────────────────────────────────────────────────────
function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'light') {
    root.style.setProperty('--bg',      '#f1f5f9');
    root.style.setProperty('--card',    '#ffffff');
    root.style.setProperty('--card2',   '#f8fafc');
    root.style.setProperty('--border',  '#e2e8f0');
    root.style.setProperty('--t1',      '#0f172a');
    root.style.setProperty('--t2',      '#334155');
    root.style.setProperty('--t3',      '#94a3b8');
    root.style.setProperty('--accent',  '#0284c7');
  } else {
    root.style.setProperty('--bg',      '#0a0f1e');
    root.style.setProperty('--card',    '#111827');
    root.style.setProperty('--card2',   '#1f2937');
    root.style.setProperty('--border',  '#1f2937');
    root.style.setProperty('--t1',      '#e2e8f0');
    root.style.setProperty('--t2',      '#94a3b8');
    root.style.setProperty('--t3',      '#4b5563');
    root.style.setProperty('--accent',  '#00c8ff');
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const token = () => localStorage.getItem('wip_token');
const apiFetch = (url, opts={}) => fetch(API+url, {
  ...opts,
  headers: { 'Content-Type':'application/json', Authorization:`Bearer ${token()}`, ...(opts.headers||{}) },
  body: opts.body ? JSON.stringify(opts.body) : undefined,
}).then(r => r.json());

const ageColor = d => +d >= 90 ? '#ef4444' : +d >= 30 ? '#f59e0b' : +d >= 7 ? '#3b82f6' : '#10d97e';
const ageBg    = d => +d >= 90 ? '#ef444420' : +d >= 30 ? '#f59e0b20' : +d >= 7 ? '#3b82f620' : '#10d97e20';

const STATUS_COLORS = {
  'Complete but NOT Invoiced':                  '#ef4444',
  'Fully Costed and Invoiced':                  '#10d97e',
  'Awaiting Parts':                              '#f59e0b',
  'Awaiting Authority':                          '#f59e0b',
  'Awaiting Labour':                             '#f59e0b',
  'Vehicle Released & Waiting Auth to Close':   '#a855f7',
  'Checked In':                                  '#3b82f6',
  'In Progress':                                 '#00c8ff',
  'Booked':                                      '#6b7280',
};

// ── Styles ────────────────────────────────────────────────────────────────────
const S = {
  page:   { minHeight:'100vh', background:'var(--bg)', color:'var(--t1)' },
  card:   { background:'var(--card)', borderRadius:14, border:'1px solid var(--border)', padding:'16px' },
  btn:    (c='#00c8ff') => ({ background:c, color:'#0a0f1e', border:'none', borderRadius:10,
            padding:'12px 20px', fontWeight:700, fontSize:14, cursor:'pointer', width:'100%' }),
  input:  { background:'var(--card2)', border:'1px solid var(--border)', borderRadius:10, padding:'12px 14px',
            color:'var(--t1)', fontSize:15, width:'100%', outline:'none' },
  label:  { fontSize:11, color:'var(--t3)', letterSpacing:1.5, textTransform:'uppercase', marginBottom:6, display:'block' },
  pill:   (c) => ({ display:'inline-block', padding:'3px 10px', borderRadius:20, fontSize:11,
            fontWeight:700, background:c+'22', color:c, border:`1px solid ${c}44` }),
};

// ── Login Screen ──────────────────────────────────────────────────────────────
function Login({ onLogin }) {
  const [name, setName] = useState('');
  const [pin,  setPin]  = useState('');
  const [err,  setErr]  = useState('');
  const [loading, setLoading] = useState(false);

  const handlePin = v => { if (/^\d{0,4}$/.test(v)) setPin(v); };

  const submit = async () => {
    if (!name.trim()) return setErr('Enter your name');
    if (pin.length !== 4) return setErr('PIN must be 4 digits');
    setLoading(true); setErr('');
    const res = await apiFetch('/api/auth/login', { method:'POST', body:{ sa_name:name.trim(), pin } });
    setLoading(false);
    if (res.error) return setErr(res.error);
    localStorage.setItem('wip_token', res.token);
    onLogin({ sa_name: res.sa_name, role: res.role });
  };

  return (
    <div style={{...S.page, display:'flex', alignItems:'center', justifyContent:'center', padding:20}}>
      <div style={{ width:'100%', maxWidth:360 }}>
        {/* Logo */}
        <div style={{ textAlign:'center', marginBottom:32 }}>
          <div style={{ width:56, height:56, borderRadius:16, background:'linear-gradient(135deg,#00c8ff,#0055ff)',
            display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 12px',
            fontSize:20, fontWeight:900, color:'#fff', boxShadow:'0 0 24px #00c8ff44' }}>CK</div>
          <div style={{ fontSize:20, fontWeight:800, color:'var(--t1)' }}>WIP Tracker</div>
          <div style={{ fontSize:12, color:'var(--t3)', marginTop:4 }}>Changan Kuwait · Service</div>
        </div>

        <div style={{...S.card}}>
          <div style={{ marginBottom:16 }}>
            <label style={S.label}>Your Name</label>
            <input style={S.input} placeholder="e.g. Islam Mohammed" value={name}
              onChange={e=>setName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&submit()}/>
          </div>
          <div style={{ marginBottom:20 }}>
            <label style={S.label}>4-Digit PIN</label>
            <input style={{...S.input, letterSpacing:8, fontSize:22, textAlign:'center'}}
              type="password" inputMode="numeric" maxLength={4} placeholder="••••"
              value={pin} onChange={e=>handlePin(e.target.value)} onKeyDown={e=>e.key==='Enter'&&submit()}/>
          </div>
          {err && <div style={{ color:'#ef4444', fontSize:12, marginBottom:12, textAlign:'center' }}>{err}</div>}
          <button style={S.btn()} onClick={submit} disabled={loading}>
            {loading ? 'Signing in…' : '→ Sign In'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── WIP Card ──────────────────────────────────────────────────────────────────
function WIPCard({ wip, onUpdate, isSupervisor }) {
  const [open,      setOpen]      = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [note,      setNote]      = useState('');
  const [history,   setHistory]   = useState(null);
  const [saving,    setSaving]    = useState(false);
  const [showHist,  setShowHist]  = useState(false);

  const curStatus = wip.current_status || wip.status || '—';
  const statCol   = STATUS_COLORS[curStatus] || '#6b7280';
  const daysAged  = +wip.ageing_days || 0;

  const loadHistory = async () => {
    if (!showHist) {
      const res = await apiFetch(`/api/wips/${wip.wip_no}/history`);
      setHistory(res.history || []);
    }
    setShowHist(v => !v);
  };

  const save = async () => {
    if (!newStatus) return;
    setSaving(true);
    await apiFetch(`/api/wips/${wip.wip_no}/update`, { method:'POST', body:{ new_status:newStatus, note } });
    setSaving(false);
    setOpen(false); setNote(''); setNewStatus('');
    onUpdate();
  };

  return (
    <div style={{...S.card, marginBottom:12, borderLeft:`4px solid ${ageColor(daysAged)}`}}>
      {/* Header row */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
        <div>
          <div style={{ fontWeight:800, fontSize:17, color:'#00c8ff' }}>#{wip.wip_no}</div>
          <div style={{ fontSize:13, color:'#9ca3af', marginTop:2 }}>{wip.plate_no} · {wip.model}</div>
          {isSupervisor && <div style={{ fontSize:11, color:'var(--t3)', marginTop:2 }}>👤 {wip.sa_name}</div>}
        </div>
        <div style={{ textAlign:'right' }}>
          <div style={{ ...S.pill(ageColor(daysAged)), fontSize:13, fontWeight:900, padding:'4px 12px' }}>
            {daysAged}d
          </div>
          <div style={{ fontSize:10, color:'var(--t3)', marginTop:4 }}>{wip.branch?.toUpperCase()}</div>
        </div>
      </div>

      {/* Status */}
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10, flexWrap:'wrap' }}>
        <span style={S.pill(statCol)}>{curStatus}</span>
        {wip.last_updated && (
          <span style={{ fontSize:10, color:'var(--t3)' }}>
            Updated {new Date(wip.last_updated).toLocaleDateString('en-GB',{day:'2-digit',month:'short'})} by {wip.updated_by}
          </span>
        )}
      </div>

      {/* Latest note */}
      {wip.latest_note && (
        <div style={{ background:'var(--card2)', borderRadius:8, padding:'8px 12px', marginBottom:10,
          fontSize:12, color:'#9ca3af', fontStyle:'italic' }}>
          📋 {wip.latest_note}
        </div>
      )}

      {/* Actions */}
      <div style={{ display:'flex', gap:8 }}>
        <button onClick={() => setOpen(v=>!v)}
          style={{ flex:1, background:'var(--card2)', border:'1px solid var(--border)', borderRadius:8,
            padding:'9px', color:'var(--t1)', fontWeight:700, fontSize:13, cursor:'pointer' }}>
          {open ? '✕ Cancel' : '✏️ Update Status'}
        </button>
        <button onClick={loadHistory}
          style={{ background:'var(--card2)', border:'1px solid var(--border)', borderRadius:8,
            padding:'9px 14px', color:'var(--t3)', fontSize:12, cursor:'pointer' }}>
          🕐
        </button>
      </div>

      {/* Update form */}
      {open && (
        <div style={{ marginTop:12, borderTop:'1px solid var(--border)', paddingTop:12 }}>
          <label style={S.label}>New Status</label>
          <select value={newStatus} onChange={e=>setNewStatus(e.target.value)}
            style={{...S.input, marginBottom:10, cursor:'pointer'}}>
            <option value="">— Select status —</option>
            {wip.statusOptions?.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <label style={S.label}>Note (optional)</label>
          <textarea value={note} onChange={e=>setNote(e.target.value)} rows={2}
            placeholder="Add a note about the update..."
            style={{...S.input, resize:'vertical', marginBottom:10}}/>
          <button style={S.btn('#10d97e')} onClick={save} disabled={saving||!newStatus}>
            {saving ? 'Saving…' : '✓ Save Update'}
          </button>
        </div>
      )}

      {/* History */}
      {showHist && history && (
        <div style={{ marginTop:10, borderTop:'1px solid var(--border)', paddingTop:10 }}>
          <div style={{ fontSize:11, color:'var(--t3)', marginBottom:8, letterSpacing:1 }}>UPDATE HISTORY</div>
          {history.length === 0 && <div style={{ fontSize:12, color:'var(--t3)' }}>No updates yet</div>}
          {history.map((h,i) => (
            <div key={i} style={{ fontSize:12, marginBottom:8, paddingBottom:8,
              borderBottom: i<history.length-1 ? '1px solid #1f2937' : 'none' }}>
              <div style={{ display:'flex', justifyContent:'space-between' }}>
                <span style={{ color:'#00c8ff', fontWeight:700 }}>{h.new_status}</span>
                <span style={{ color:'var(--t3)', fontSize:11 }}>
                  {new Date(h.updated_at).toLocaleString('en-GB',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}
                </span>
              </div>
              <div style={{ color:'var(--t3)', marginTop:2 }}>by {h.updated_by}</div>
              {h.note && <div style={{ color:'#9ca3af', fontStyle:'italic', marginTop:3 }}>"{h.note}"</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Supervisor Panel ──────────────────────────────────────────────────────────
function SupervisorPanel({ onClose }) {
  const [users,   setUsers]   = useState([]);
  const [saNames, setSaNames] = useState([]);
  const [form,    setForm]    = useState({ sa_name:'', pin:'', role:'advisor' });
  const [msg,     setMsg]     = useState('');
  const [resetId, setResetId] = useState(null);
  const [newPin,  setNewPin]  = useState('');

  useEffect(() => {
    apiFetch('/api/users').then(r => setUsers(r.users || []));
    apiFetch('/api/sa-names').then(r => setSaNames(r.names || []));
  }, []);

  const createUser = async () => {
    if (!form.sa_name || form.pin.length!==4) return setMsg('Name and 4-digit PIN required');
    const res = await apiFetch('/api/users', { method:'POST', body: form });
    if (res.error) return setMsg(res.error);
    setMsg('User created ✅');
    setForm({ sa_name:'', pin:'', role:'advisor' });
    apiFetch('/api/users').then(r => setUsers(r.users || []));
  };

  const toggleUser = async (id) => {
    await apiFetch(`/api/users/${id}/toggle`, { method:'PUT', body:{} });
    apiFetch('/api/users').then(r => setUsers(r.users || []));
  };

  const resetPin = async (id) => {
    if (newPin.length !== 4) return setMsg('PIN must be 4 digits');
    await apiFetch(`/api/users/${id}/pin`, { method:'PUT', body:{ pin: newPin } });
    setResetId(null); setNewPin(''); setMsg('PIN reset ✅');
  };

  return (
    <div style={{ position:'fixed', inset:0, background:'color-mix(in srgb, var(--bg) 92%, transparent)', zIndex:100,
      overflowY:'auto', padding:16 }}>
      <div style={{ maxWidth:500, margin:'0 auto' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
          <div style={{ fontWeight:800, fontSize:18 }}>👥 User Management</div>
          <button onClick={onClose} style={{ background:'var(--card2)', border:'none', color:'#9ca3af',
            borderRadius:8, padding:'6px 12px', cursor:'pointer', fontSize:14 }}>✕</button>
        </div>

        {/* Create user */}
        <div style={{...S.card, marginBottom:16}}>
          <div style={{ fontWeight:700, marginBottom:12, color:'#00c8ff' }}>+ Add User</div>
          <label style={S.label}>SA Name</label>
          <select value={form.sa_name} onChange={e=>setForm(f=>({...f,sa_name:e.target.value}))}
            style={{...S.input, marginBottom:10, cursor:'pointer'}}>
            <option value="">— Select SA —</option>
            {saNames.map(n=><option key={n} value={n}>{n}</option>)}
          </select>
          <label style={S.label}>4-Digit PIN</label>
          <input style={{...S.input, marginBottom:10}} type="password" inputMode="numeric"
            maxLength={4} placeholder="••••" value={form.pin}
            onChange={e=>{ if(/^\d{0,4}$/.test(e.target.value)) setForm(f=>({...f,pin:e.target.value})); }}/>
          <label style={S.label}>Role</label>
          <select value={form.role} onChange={e=>setForm(f=>({...f,role:e.target.value}))}
            style={{...S.input, marginBottom:12, cursor:'pointer'}}>
            <option value="advisor">Advisor (own WIPs only)</option>
            <option value="supervisor">Supervisor (all WIPs)</option>
          </select>
          {msg && <div style={{ fontSize:12, color:'#10d97e', marginBottom:10 }}>{msg}</div>}
          <button style={S.btn()} onClick={createUser}>Create User</button>
        </div>

        {/* User list */}
        <div style={{...S.card}}>
          <div style={{ fontWeight:700, marginBottom:12, color:'#00c8ff' }}>Current Users</div>
          {users.map(u => (
            <div key={u.id} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10,
              paddingBottom:10, borderBottom:'1px solid var(--border)' }}>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:700, fontSize:14 }}>{u.sa_name}</div>
                <div style={{ fontSize:11, color:'var(--t3)' }}>{u.role} · {u.active?'Active':'Inactive'}</div>
              </div>
              {resetId===u.id ? (
                <div style={{ display:'flex', gap:6 }}>
                  <input style={{...S.input, width:70, textAlign:'center'}} type="password"
                    inputMode="numeric" maxLength={4} placeholder="PIN"
                    value={newPin} onChange={e=>{ if(/^\d{0,4}$/.test(e.target.value)) setNewPin(e.target.value); }}/>
                  <button onClick={()=>resetPin(u.id)}
                    style={{ background:'#10d97e', border:'none', borderRadius:8, padding:'6px 10px',
                      color:'#0a0f1e', fontWeight:700, cursor:'pointer', fontSize:12 }}>✓</button>
                  <button onClick={()=>setResetId(null)}
                    style={{ background:'var(--card2)', border:'none', borderRadius:8, padding:'6px 10px',
                      color:'#9ca3af', cursor:'pointer', fontSize:12 }}>✕</button>
                </div>
              ) : (
                <div style={{ display:'flex', gap:6 }}>
                  <button onClick={()=>setResetId(u.id)}
                    style={{ background:'var(--card2)', border:'1px solid var(--border)', borderRadius:8,
                      padding:'5px 10px', color:'#9ca3af', cursor:'pointer', fontSize:11 }}>🔑 PIN</button>
                  <button onClick={()=>toggleUser(u.id)}
                    style={{ background: u.active?'#ef444420':'#10d97e20',
                      border:`1px solid ${u.active?'#ef4444':'#10d97e'}44`, borderRadius:8,
                      padding:'5px 10px', color: u.active?'#ef4444':'#10d97e', cursor:'pointer', fontSize:11 }}>
                    {u.active?'Disable':'Enable'}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
function Dashboard({ user, onLogout, theme, onToggleTheme }) {
  const [wips,       setWips]       = useState([]);
  const [opts,       setOpts]       = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState('');
  const [filterAge,  setFilterAge]  = useState('all');
  const [filterStat, setFilterStat] = useState('all');
  const [showPanel,  setShowPanel]  = useState(false);

  const isSupervisor = user.role === 'supervisor';

  const load = useCallback(async () => {
    setLoading(true);
    const res = await apiFetch('/api/wips');
    const wipList = (res.wips || []).map(w => ({ ...w, statusOptions: res.statusOptions || [] }));
    setWips(wipList);
    setOpts(res.statusOptions || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = wips.filter(w => {
    const d = +w.ageing_days;
    if (filterAge === '7+'  && d <  7) return false;
    if (filterAge === '30+' && d < 30) return false;
    if (filterAge === '90+' && d < 90) return false;
    const cur = w.current_status || w.status || '';
    if (filterStat !== 'all' && cur !== filterStat) return false;
    const s = search.toLowerCase();
    if (s && !w.wip_no?.toString().includes(s) && !w.plate_no?.toLowerCase().includes(s) &&
        !w.model?.toLowerCase().includes(s) && !w.sa_name?.toLowerCase().includes(s)) return false;
    return true;
  });

  // Summary counts
  const cni  = wips.filter(w => (w.current_status||w.status||'').includes('NOT Invoiced')).length;
  const aged = wips.filter(w => +w.ageing_days >= 30).length;

  return (
    <div style={{ ...S.page, paddingBottom:32 }}>
      {showPanel && <SupervisorPanel onClose={()=>setShowPanel(false)}/>}

      {/* Top bar */}
      <div style={{ background:'var(--card)', borderBottom:'1px solid var(--border)', padding:'12px 16px',
        display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:50 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:32, height:32, borderRadius:8, background:'linear-gradient(135deg,#00c8ff,#0055ff)',
            display:'flex', alignItems:'center', justifyContent:'center', fontWeight:900, fontSize:11, color:'#fff' }}>CK</div>
          <div>
            <div style={{ fontWeight:800, fontSize:14 }}>WIP Tracker</div>
            <div style={{ fontSize:10, color:'var(--t3)' }}>{user.sa_name} · {user.role}</div>
          </div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          {isSupervisor && (
            <button onClick={()=>setShowPanel(true)}
              style={{ background:'var(--card2)', border:'1px solid var(--border)', borderRadius:8,
                padding:'6px 12px', color:'#9ca3af', cursor:'pointer', fontSize:12 }}>👥</button>
          )}
          <button onClick={load}
            style={{ background:'var(--card2)', border:'1px solid var(--border)', borderRadius:8,
              padding:'6px 12px', color:'#9ca3af', cursor:'pointer', fontSize:12 }}>↻</button>
          <button onClick={()=>{ localStorage.removeItem('wip_token'); onLogout(); }}
            style={{ background:'#ef444420', border:'1px solid #ef444444', borderRadius:8,
              padding:'6px 12px', color:'#ef4444', cursor:'pointer', fontSize:12 }}>Exit</button>
        </div>
      </div>

      <div style={{ padding:'16px' }}>
        {/* KPI strip */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginBottom:16 }}>
          {[
            { label:'Total WIPs', value: wips.length, color:'#00c8ff' },
            { label:'Not Invoiced', value: cni, color:'#ef4444' },
            { label:'30+ Days', value: aged, color:'#f59e0b' },
          ].map(k => (
            <div key={k.label} style={{...S.card, textAlign:'center', padding:'12px 8px'}}>
              <div style={{ fontWeight:900, fontSize:24, color:k.color }}>{k.value}</div>
              <div style={{ fontSize:10, color:'var(--t3)', marginTop:2 }}>{k.label}</div>
            </div>
          ))}
        </div>

        {/* Search */}
        <input style={{...S.input, marginBottom:10}} placeholder="🔍  Search WIP#, plate, model…"
          value={search} onChange={e=>setSearch(e.target.value)}/>

        {/* Filters */}
        <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap' }}>
          {[['all','All'],['7+','7d+'],['30+','30d+'],['90+','90d+']].map(([v,l])=>(
            <button key={v} onClick={()=>setFilterAge(v)}
              style={{ padding:'6px 14px', borderRadius:20, fontSize:12, fontWeight:700, cursor:'pointer',
                background: filterAge===v ? '#00c8ff' : '#1f2937',
                color: filterAge===v ? '#0a0f1e' : '#9ca3af', border:'none' }}>{l}</button>
          ))}
          <select value={filterStat} onChange={e=>setFilterStat(e.target.value)}
            style={{...S.input, width:'auto', padding:'6px 12px', fontSize:12, cursor:'pointer'}}>
            <option value="all">All Statuses</option>
            {opts.map(o=><option key={o} value={o}>{o}</option>)}
          </select>
        </div>

        {/* WIP count */}
        <div style={{ fontSize:12, color:'var(--t3)', marginBottom:12 }}>
          Showing {filtered.length} of {wips.length} WIPs
        </div>

        {/* WIP cards */}
        {loading ? (
          <div style={{ textAlign:'center', color:'var(--t3)', padding:40 }}>Loading WIPs…</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign:'center', color:'var(--t3)', padding:40 }}>No WIPs found</div>
        ) : (
          filtered.map(w => (
            <WIPCard key={w.id} wip={w} onUpdate={load} isSupervisor={isSupervisor}/>
          ))
        )}
      </div>
    </div>
  );
}

// ── Root App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem('wip_theme') || 'dark');

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem('wip_theme', theme);
  }, [theme]);

  const [user, setUser] = useState(() => {
    const t = localStorage.getItem('wip_token');
    if (!t) return null;
    try {
      const payload = JSON.parse(atob(t.split('.')[1]));
      if (payload.exp * 1000 < Date.now()) { localStorage.removeItem('wip_token'); return null; }
      return { sa_name: payload.sa_name, role: payload.role };
    } catch { return null; }
  });

  if (!user) return <Login onLogin={setUser}/>;
  return <Dashboard user={user} onLogout={()=>setUser(null)} theme={theme} onToggleTheme={()=>setTheme(t=>t==='dark'?'light':'dark')}/>;
}
