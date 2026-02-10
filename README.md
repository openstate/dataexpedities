# data/expedities

![data/expedities](assets/og-image.png)

Journalistieke hackathons met CBS data. Een initiatief van Stichting Momus, Open State Foundation en het CBS.

## Project overview

Two hackathons bringing together 35 journalists, developers and CBS experts to find stories in public data. This website provides event information, registration, and programme details.

**Stack:** Jekyll (static site generation) + Express.js (form API with SendGrid) + Tailwind CSS (CDN)

## Structure

```
_config.yml              # Jekyll configuration
_layouts/                # Page templates (default, page, hackathon, form)
_includes/               # Reusable components (header, footer, event-bar, etc.)
_data/                   # Event details (events.yml) and navigation (navigation.yml)
api/                     # Express server + SendGrid registration endpoint
assets/                  # SVG logos and illustrations
```

### Pages

| Page | Layout | Description |
|------|--------|-------------|
| `index.html` | default | Homepage with event previews |
| `workshop.html` | page | Workshop programme details |
| `hackathon-wonen.html` | hackathon | Hackathon #1: Wonen (two-column with data sidebar) |
| `hackathon-energie.html` | hackathon | Hackathon #2: Energie (two-column with data sidebar) |
| `overons.html` | page | About the project and partners |
| `aanmeldformulier.html` | form | Registration form |

## Local development

### Prerequisites

- Ruby 3.0+ with Bundler
- Node.js 18+

### Setup

```bash
# Install Jekyll
bundle install

# Build the site
bundle exec jekyll build

# Install API dependencies
cd api && npm install && cd ..

# Start the server
PORT=4000 node api/server.js
```

The site will be available at `http://localhost:4000`.

For live-reload during development, run `bundle exec jekyll build --watch` in a separate terminal.

### Environment variables

Copy `.env.example` to `.env` and fill in:

| Variable | Description |
|----------|-------------|
| `SENDGRID_API_KEY` | SendGrid API key for sending registration emails |
| `ADMIN_EMAIL` | Email address that receives registration submissions |
| `FROM_EMAIL` | Sender email address (must be verified in SendGrid) |
| `PORT` | Server port (default: 3000) |

## Docker deployment

```bash
docker compose up --build
```

The multi-stage Dockerfile builds the Jekyll site with Ruby, then serves it with Node.js. Configure environment variables in `docker-compose.yml` or via your deployment platform (e.g. Coolify).

## Editing content

- **Event details** (dates, locations, registration status): edit `_data/events.yml`
- **Navigation**: edit `_data/navigation.yml`
- **Page content**: edit the corresponding `.html` file directly
- **Sidebar datasets/research**: edit the `sidebar` section in `_data/events.yml`
