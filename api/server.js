const express = require('express');
const path = require('path');
const sgMail = require('@sendgrid/mail');

const app = express();
const PORT = process.env.PORT || 3000;

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

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
      max-width: 90vw;
      max-height: 80vh;
      width: auto;
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
  const { naam, email, organisatie, telefoon, functie, deelname, motivatie, onderzoeksvragen, technisch } = req.body;

  // Validate required fields
  if (!naam || !email || !functie || !motivatie) {
    return res.status(400).json({ error: 'Vul alle verplichte velden in (naam, email, functie, motivatie).' });
  }

  const deelnameList = Array.isArray(deelname) ? deelname.join(', ') : (deelname || 'niet opgegeven');

  const emailBody = `
Nieuwe aanmelding data/expedities

Persoonlijke gegevens:
- Naam: ${naam}
- E-mail: ${email}
- Organisatie: ${organisatie || 'niet opgegeven'}
- Telefoon: ${telefoon || 'niet opgegeven'}

Profiel:
- Rol: ${functie}

Deelname:
- ${deelnameList}

Achtergrond:
- Motivatie: ${motivatie}
- Onderzoeksvragen: ${onderzoeksvragen || 'niet opgegeven'}

Technische achtergrond:
- ${technisch || 'niet opgegeven'}
`.trim();

  const msg = {
    to: process.env.ADMIN_EMAIL,
    from: process.env.FROM_EMAIL || process.env.ADMIN_EMAIL,
    subject: `Aanmelding data/expedities: ${naam}`,
    text: emailBody,
  };

  try {
    await sgMail.send(msg);
    res.json({ success: true, message: 'Aanmelding ontvangen.' });
  } catch (error) {
    console.error('SendGrid error:', error.response?.body || error.message);
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
