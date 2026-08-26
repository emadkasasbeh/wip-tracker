require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const { Pool } = require('pg');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');

const app  = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'wip-tracker-secret-2026';

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

app.use(cors());
app.use(express.json());

// ── DB Init ──────────────────────────────────────────────────────────────────
async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS wip_tracker_users (
      id         SERIAL PRIMARY KEY,
      sa_name    TEXT UNIQUE NOT NULL,
      pin_hash   TEXT NOT NULL,
      role       TEXT DEFAULT 'advisor',   -- 'advisor' | 'supervisor'
      active     BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS wip_updates (
      id         SERIAL PRIMARY KEY,
      wip_no     TEXT NOT NULL,
      sa_name    TEXT NOT NULL,
      old_status TEXT,
      new_status TEXT NOT NULL,
      note       TEXT,
      updated_by TEXT NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_wip_updates_wip ON wip_updates(wip_no);
    CREATE INDEX IF NOT EXISTS idx_wip_updates_sa  ON wip_updates(sa_name);
  `);
  console.log('✅ WIP Tracker DB ready');
}

// ── Auth middleware ───────────────────────────────────────────────────────────
function auth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch { res.status(401).json({ error: 'Invalid token' }); }
}

function supervisor(req, res, next) {
  if (req.user.role !== 'supervisor') return res.status(403).json({ error: 'Supervisors only' });
  next();
}

// ── AUTH ROUTES ───────────────────────────────────────────────────────────────

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { sa_name, pin } = req.body;
    if (!sa_name || !pin) return res.status(400).json({ error: 'Name and PIN required' });
    const { rows } = await pool.query(
      `SELECT * FROM wip_tracker_users WHERE LOWER(sa_name)=LOWER($1) AND active=true`, [sa_name]
    );
    if (!rows.length) return res.status(401).json({ error: 'User not found' });
    const user = rows[0];
    const ok = await bcrypt.compare(String(pin), user.pin_hash);
    if (!ok) return res.status(401).json({ error: 'Wrong PIN' });
    const token = jwt.sign({ id: user.id, sa_name: user.sa_name, role: user.role }, JWT_SECRET, { expiresIn: '12h' });
    res.json({ token, sa_name: user.sa_name, role: user.role });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// ── WIP ROUTES ────────────────────────────────────────────────────────────────

const WIP_STATUS_OPTIONS = [
  'Awaiting Parts',
  'Awaiting Authority',
  'Awaiting Labour',
  'Checked In',
  'In Progress',
  'Complete but NOT Invoiced',
  'Fully Costed and Invoiced',
  'Vehicle Released & Waiting Auth to Close',
  'Booked',
];

// Get WIPs (advisor: own only; supervisor: all)
app.get('/api/wips', auth, async (req, res) => {
  try {
    // Get latest service upload
    const { rows: up } = await pool.query(
      `SELECT id FROM uploads WHERE type='service' ORDER BY uploaded_at DESC LIMIT 1`
    );
    if (!up.length) return res.json({ wips: [], statusOptions: WIP_STATUS_OPTIONS });
    const uid = up[0].id;

    let q, params;
    if (req.user.role === 'supervisor') {
      q = `SELECT w.*, 
              COALESCE(u.new_status, w.status) AS current_status,
              u.note AS latest_note, u.updated_at AS last_updated, u.updated_by
           FROM service_wip w
           LEFT JOIN LATERAL (
             SELECT new_status, note, updated_at, updated_by
             FROM wip_updates WHERE wip_no=CAST(w.wip_no AS TEXT) ORDER BY updated_at DESC LIMIT 1
           ) u ON true
           WHERE w.upload_id=$1 ORDER BY w.ageing_days DESC`;
      params = [uid];
    } else {
      q = `SELECT w.*,
              COALESCE(u.new_status, w.status) AS current_status,
              u.note AS latest_note, u.updated_at AS last_updated, u.updated_by
           FROM service_wip w
           LEFT JOIN LATERAL (
             SELECT new_status, note, updated_at, updated_by
             FROM wip_updates WHERE wip_no=CAST(w.wip_no AS TEXT) ORDER BY updated_at DESC LIMIT 1
           ) u ON true
           WHERE w.upload_id=$1 AND LOWER(w.sa_name) LIKE LOWER($2)
           ORDER BY w.ageing_days DESC`;
      params = [uid, `%${req.user.sa_name.split(' ')[0]}%`];
    }

    const { rows: wips } = await pool.query(q, params);
    res.json({ wips, statusOptions: WIP_STATUS_OPTIONS, total: wips.length });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// Update WIP status
app.post('/api/wips/:wipNo/update', auth, async (req, res) => {
  try {
    const { wipNo } = req.params;
    const { new_status, note } = req.body;
    if (!new_status) return res.status(400).json({ error: 'Status required' });

    // Get current status
    const { rows: cur } = await pool.query(
      `SELECT status FROM service_wip WHERE wip_no=$1 ORDER BY id DESC LIMIT 1`, [wipNo]
    );
    const old_status = cur[0]?.status || null;

    await pool.query(
      `INSERT INTO wip_updates(wip_no, sa_name, old_status, new_status, note, updated_by)
       VALUES($1,$2,$3,$4,$5,$6)`,
      [wipNo, req.user.sa_name, old_status, new_status, note || null, req.user.sa_name]
    );
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// Get update history for a WIP
app.get('/api/wips/:wipNo/history', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM wip_updates WHERE wip_no=$1 ORDER BY updated_at DESC`, [req.params.wipNo]
    );
    res.json({ history: rows });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// ── SUPERVISOR ROUTES ─────────────────────────────────────────────────────────

// List all tracker users
app.get('/api/users', auth, supervisor, async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT id,sa_name,role,active,created_at FROM wip_tracker_users ORDER BY sa_name`);
    res.json({ users: rows });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// Create user
app.post('/api/users', auth, supervisor, async (req, res) => {
  try {
    const { sa_name, pin, role='advisor' } = req.body;
    if (!sa_name || !pin) return res.status(400).json({ error: 'Name and PIN required' });
    if (String(pin).length !== 4) return res.status(400).json({ error: 'PIN must be 4 digits' });
    const pin_hash = await bcrypt.hash(String(pin), 10);
    await pool.query(
      `INSERT INTO wip_tracker_users(sa_name,pin_hash,role) VALUES($1,$2,$3)`, [sa_name, pin_hash, role]
    );
    res.json({ success: true });
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'User already exists' });
    res.status(500).json({ error: 'Server error' });
  }
});

// Reset PIN
app.put('/api/users/:id/pin', auth, supervisor, async (req, res) => {
  try {
    const { pin } = req.body;
    if (String(pin).length !== 4) return res.status(400).json({ error: 'PIN must be 4 digits' });
    const pin_hash = await bcrypt.hash(String(pin), 10);
    await pool.query(`UPDATE wip_tracker_users SET pin_hash=$1 WHERE id=$2`, [pin_hash, req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// Toggle active
app.put('/api/users/:id/toggle', auth, supervisor, async (req, res) => {
  try {
    await pool.query(`UPDATE wip_tracker_users SET active=NOT active WHERE id=$1`, [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// Get SA names from service_sa for autocomplete
app.get('/api/sa-names', auth, supervisor, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT DISTINCT sa_name FROM service_sa WHERE sa_name IS NOT NULL ORDER BY sa_name`
    );
    res.json({ names: rows.map(r => r.sa_name) });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Serve frontend
const path = require('path');
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'public')));
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });
}

initDB().then(() => {
  app.listen(PORT, () => console.log(`WIP Tracker API on port ${PORT}`));
}).catch(err => { console.error(err); process.exit(1); });
