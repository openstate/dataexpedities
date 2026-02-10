const express = require('express');
const path = require('path');
const sgMail = require('@sendgrid/mail');

const app = express();
const PORT = process.env.PORT || 3000;

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
