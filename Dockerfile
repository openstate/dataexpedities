# Stage 1: Build Jekyll site
FROM ruby:3.3-slim AS builder

RUN apt-get update && apt-get install -y build-essential && rm -rf /var/lib/apt/lists/*

WORKDIR /site
COPY Gemfile Gemfile.lock ./
RUN bundle install --jobs 4

COPY . .
RUN bundle exec jekyll build

# Stage 2: Node.js runtime
FROM node:20-slim

WORKDIR /app

COPY api/package.json api/package-lock.json* ./api/
RUN cd api && npm ci --omit=dev

COPY api/server.js ./api/server.js
COPY --from=builder /site/_site ./_site

ENV PORT=3000
EXPOSE 3000

CMD ["node", "api/server.js"]
