const express = require('express');
const path = require('path');

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

// Registration API endpoint
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

  const record = {
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
    const response = await fetch(`${NOCODB_BASE_URL}/api/v2/tables/${NOCODB_TABLE_ID}/records`, {
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

    res.json({ success: true, message: 'Aanmelding ontvangen.' });
  } catch (error) {
    console.error('Registration error:', error.message);
    res.status(500).json({ error: 'Er is iets misgegaan bij het versturen. Probeer het later opnieuw.' });
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
});
