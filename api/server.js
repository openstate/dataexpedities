const express = require('express');
const path = require('path');
const fs = require('fs');

// Laad .env uit de projectroot (indien aanwezig). dotenv is optioneel:
// bij deployment kunnen env-vars ook direct worden meegegeven (bv. docker-compose).
try {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
} catch (e) {
  console.warn('dotenv niet geladen (optioneel):', e.message);
}

const app = express();
const PORT = process.env.PORT || 3000;
const NOCODB_BASE_URL = process.env.NOCODB_BASE_URL;
const NOCODB_TABLE_ID = process.env.NOCODB_TABLE_ID;

if (!NOCODB_BASE_URL || !NOCODB_TABLE_ID) {
  console.warn('Warning: NOCODB_BASE_URL and NOCODB_TABLE_ID must be set for registration to work.');
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Launch page: show only the OG image when SHOW_LAUNCH_PAGE=ON
if (process.env.SHOW_LAUNCH_PAGE === 'ON') {
  app.use((req, res, next) => {
    // Allow the image and favicon to be served normally
    if (req.path === '/assets/og-image.png' || req.path === '/assets/favicon.png') {
      return next();
    }
    res.send(`<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>data/expedities</title>
  <link rel="icon" type="image/png" href="/assets/favicon.png">
  <meta property="og:title" content="data/expedities">
  <meta property="og:description" content="Journalistieke hackathons met CBS data">
  <meta property="og:image" content="${process.env.SITE_URL || ''}/assets/og-image.png">
  <meta property="og:type" content="website">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:image" content="${process.env.SITE_URL || ''}/assets/og-image.png">
  <style>
    body {
      margin: 0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #f2e9e7;
    }
    img {
      max-width: 40vw;
      height: auto;
    }
  </style>
</head>
<body>
  <img src="/assets/og-image.png" alt="data/expedities">
</body>
</html>`);
  });
}

// Serve Jekyll _site as static files
app.use(express.static(path.join(__dirname, '..', '_site')));

const HACKATHON_CAPACITY = parseInt(process.env.HACKATHON_CAPACITY || '40', 10);
const NOCODB_WAITLIST_TABLE_ID = process.env.NOCODB_WAITLIST_TABLE_ID || 'mkichklpyr0re83';
// Vooraanmeldingen voor hackathon #2 (november 2026) — aparte NocoDB-tabel.
const NOCODB_PREREGISTER_TABLE_ID = process.env.NOCODB_PREREGISTER_TABLE_ID || 'mvaviytk173s944';

const ROL_MAPPING = {
  'journalist': 'Journalist',
  'datajournalist': 'Datajournalist',
  'developer': 'Developer / Programmeur',
  'data-analist': 'Data-analist',
  'onderzoeker': 'Onderzoeker',
  'anders': 'Anders',
};

// Is NocoDB geconfigureerd? Zo niet, dan gebruiken we een lokale fallback zodat
// formulieren ook zonder externe database werken (bv. lokaal draaien of demo).
const NOCODB_CONFIGURED = !!(NOCODB_BASE_URL && process.env.NOCODB_API_TOKEN);
const LOCAL_STORE_DIR = path.join(__dirname, '.submissions');

// Schrijf een record naar NocoDB, of val terug op lokale opslag als NocoDB
// niet is geconfigureerd. Gooit alleen bij een échte NocoDB-fout.
async function persistRecord(tableId, record, localName) {
  if (!NOCODB_CONFIGURED) {
    try {
      if (!fs.existsSync(LOCAL_STORE_DIR)) fs.mkdirSync(LOCAL_STORE_DIR, { recursive: true });
      fs.appendFileSync(path.join(LOCAL_STORE_DIR, `${localName}.jsonl`), JSON.stringify(record) + '\n');
      console.warn(`NocoDB niet geconfigureerd — ${localName} LOKAAL opgeslagen in api/.submissions/${localName}.jsonl (niet in NocoDB!)`);
    } catch (e) {
      console.error('Lokale opslag mislukt:', e.message);
    }
    return 'local';
  }

  const response = await fetch(`${NOCODB_BASE_URL}/api/v2/tables/${tableId}/records`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'xc-token': process.env.NOCODB_API_TOKEN,
    },
    body: JSON.stringify(record),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error(`NocoDB error (tabel ${tableId}):`, response.status, JSON.stringify(errorData));
    throw new Error(errorData.msg || errorData.message || 'NocoDB request failed');
  }
  console.log(`Record opgeslagen in NocoDB-tabel ${tableId}.`);
  return 'nocodb';
}

// Only count participants who registered for Hackathon #1
// (field id c5r06uetdkx7rkc = "Deelname Hackathon #1" set to true).
const HACKATHON_DEELNAME_FIELD = 'c5r06uetdkx7rkc';

async function fetchRegistrationCount() {
  const where = encodeURIComponent(`(${HACKATHON_DEELNAME_FIELD},eq,true)`);
  const response = await fetch(`${NOCODB_BASE_URL}/api/v2/tables/${NOCODB_TABLE_ID}/records/count?where=${where}`, {
    headers: { 'xc-token': process.env.NOCODB_API_TOKEN },
  });
  if (!response.ok) throw new Error('Failed to fetch count');
  const data = await response.json();
  return data.count;
}

// Registration status endpoint (used by aanmeldformulier to decide UI mode)
app.get('/api/registration-status', async (req, res) => {
  try {
    const count = await fetchRegistrationCount();
    res.json({ count, capacity: HACKATHON_CAPACITY, full: count >= HACKATHON_CAPACITY });
  } catch (error) {
    console.error('Status error:', error.message);
    res.status(500).json({ error: 'Kon status niet ophalen.' });
  }
});

// Registration API endpoint — routes to waitlist table when hackathon is full
app.post('/api/register', async (req, res) => {
  const { naam, email, organisatie, functie, deelname, motivatie, onderzoeksvragen, technisch } = req.body;

  // Validate required fields
  if (!email || !functie || !motivatie) {
    return res.status(400).json({ error: 'Vul alle verplichte velden in (email, functie, motivatie).' });
  }

  const deelnameList = Array.isArray(deelname) ? deelname : (deelname ? [deelname] : []);

  const rolMapping = {
    'journalist': 'Journalist',
    'datajournalist': 'Datajournalist',
    'developer': 'Developer / Programmeur',
    'data-analist': 'Data-analist',
    'onderzoeker': 'Onderzoeker',
    'anders': 'Anders',
  };

  let isWaitlist = false;
  try {
    const count = await fetchRegistrationCount();
    isWaitlist = count >= HACKATHON_CAPACITY;
  } catch (error) {
    console.error('Capacity check failed, falling through to registration:', error.message);
  }

  const targetTableId = isWaitlist ? NOCODB_WAITLIST_TABLE_ID : NOCODB_TABLE_ID;
  const record = isWaitlist ? {
    'Naam': naam || null,
    'Email': email,
    'Organisatie / Medium': organisatie || null,
    'Rol': rolMapping[functie] || functie,
    'Waarom wil je meedoen?': motivatie,
    'Heb je al onderzoeksvragen of thema\'s in gedachten?': onderzoeksvragen || null,
    'Technische achtergrond': technisch || null,
  } : {
    'Naam': naam || null,
    'Email': email,
    'Organisatie / Medium': organisatie || null,
    'Rol': rolMapping[functie] || functie,
    'Deelname Hackathon #1': deelnameList.includes('hackathon'),
    'Deelname workshop #1': deelnameList.includes('workshop'),
    'Waarom wil je meedoen?': motivatie,
    'Heb je al onderzoeksvragen of thema\'s in gedachten?': onderzoeksvragen || null,
    'Technische achtergrond': technisch || null,
  };

  try {
    const response = await fetch(`${NOCODB_BASE_URL}/api/v2/tables/${targetTableId}/records`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xc-token': process.env.NOCODB_API_TOKEN,
      },
      body: JSON.stringify(record),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('NocoDB error:', response.status, errorData);
      throw new Error(errorData.message || 'NocoDB request failed');
    }

    res.json({
      success: true,
      waitlist: isWaitlist,
      message: isWaitlist ? 'Je staat op de wachtlijst.' : 'Aanmelding ontvangen.',
    });
  } catch (error) {
    console.error('Registration error:', error.message);
    res.status(500).json({ error: 'Er is iets misgegaan bij het versturen. Probeer het later opnieuw.' });
  }
});

// Pre-registration endpoint for hackathon #2 (november 2026).
// Vrijblijvende vooraanmelding — schrijft naar een aparte NocoDB-tabel.
app.post('/api/preregister', async (req, res) => {
  const { naam, email, organisatie, functie, onderzoeksvragen, technisch } = req.body;

  if (!email || !functie) {
    return res.status(400).json({ error: 'Vul in elk geval je e-mailadres en rol in.' });
  }

  const record = {
    'Naam': naam || null,
    'Email': email,
    'Organisatie / Medium': organisatie || null,
    'Rol': ROL_MAPPING[functie] || functie,
    'Heb je al onderzoeksvragen of thema\'s in gedachten?': onderzoeksvragen || null,
    'Technische achtergrond': technisch || null,
  };

  try {
    const stored = await persistRecord(NOCODB_PREREGISTER_TABLE_ID, record, 'preregistrations');
    res.json({ success: true, stored: stored, message: 'Vooraanmelding ontvangen.' });
  } catch (error) {
    console.error('Preregister error:', error.message);
    res.status(500).json({ error: 'Er is iets misgegaan bij het versturen. Probeer het later opnieuw.' });
  }
});

// Waitlist API endpoint (used by event-bar waitlist button — minimal fields)
app.post('/api/waitlist', async (req, res) => {
  const { naam, email, event_name } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'E-mailadres is verplicht.' });
  }

  const record = {
    'Naam': naam || null,
    'Email': email,
  };

  try {
    const response = await fetch(`${NOCODB_BASE_URL}/api/v2/tables/${NOCODB_WAITLIST_TABLE_ID}/records`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xc-token': process.env.NOCODB_API_TOKEN,
      },
      body: JSON.stringify(record),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('NocoDB waitlist error:', response.status, errorData);
      throw new Error(errorData.message || 'NocoDB request failed');
    }

    res.json({ success: true, message: 'Je staat op de wachtlijst.' });
  } catch (error) {
    console.error('Waitlist error:', error.message);
    res.status(500).json({ error: 'Er is iets misgegaan. Probeer het later opnieuw.' });
  }
});

// SPA fallback: serve index.html for clean URLs
app.get('*', (req, res) => {
  const reqPath = req.path.endsWith('/') ? req.path + 'index.html' : req.path + '/index.html';
  const filePath = path.join(__dirname, '..', '_site', reqPath);
  res.sendFile(filePath, (err) => {
    if (err) {
      res.status(404).sendFile(path.join(__dirname, '..', '_site', 'index.html'));
    }
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  if (NOCODB_CONFIGURED) {
    console.log(`NocoDB geconfigureerd (${NOCODB_BASE_URL}). Vooraanmeldingen -> tabel ${NOCODB_PREREGISTER_TABLE_ID}.`);
  } else {
    console.warn('LET OP: NocoDB is NIET geconfigureerd (NOCODB_BASE_URL / NOCODB_API_TOKEN ontbreken).');
    console.warn('Inzendingen worden LOKAAL bewaard in api/.submissions/ en komen NIET in NocoDB.');
  }
});
