# data/expedities

![data/expedities](assets/og-image.png)

Journalistieke hackathons met CBS data. Een initiatief van Stichting Momus, Open State Foundation en het CBS.

## Project overview

Two hackathons bringing together 35 journalists, developers and CBS experts to find stories in public data. This website provides event information, registration, and programme details.

**Stack:** Jekyll (static site generation) + Express.js (form API with NocoDB) + Tailwind CSS (CDN)

## Structure

```
_config.yml              # Jekyll configuration
_layouts/                # Page templates (default, page, hackathon, form)
_includes/               # Reusable components (header, footer, event-bar, etc.)
_data/                   # Event details (events.yml) and navigation (navigation.yml)
api/                     # Express server + NocoDB registration endpoint
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
PORT=3000 node api/server.js
```

The site will be available at `http://localhost:3000`.

For live-reload during development, run `bundle exec jekyll build --watch` in a separate terminal.

### Environment variables

Copy `.env.example` to `.env` and fill in:

| Variable | Description |
|----------|-------------|
| `NOCODB_API_TOKEN` | NocoDB API token for registration storage |
| `NOCODB_BASE_URL` | NocoDB instance URL (required) |
| `NOCODB_TABLE_ID` | NocoDB table ID for registrations (required) |
| `PORT` | Server port (default: 3000) |
| `SHOW_LAUNCH_PAGE` | Set to `ON` to show splash page with OG image only |

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
