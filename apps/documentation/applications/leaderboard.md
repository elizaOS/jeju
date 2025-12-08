# Leaderboard

GitHub contributor tracking with AI summaries.

**URL**: https://jejunetwork.github.io

## Features

- Contribution tracking (PRs, reviews, issues, comments)
- Scoring: PR=10, review=5, issue=3, comment=1
- AI-powered summaries via OpenRouter
- Contributor profiles with expertise detection

## Pipeline

```bash
# Daily via GitHub Actions:
bun run pipeline ingest     # Fetch GitHub data
bun run pipeline process    # Calculate scores
bun run pipeline summarize  # AI summaries
bun run pipeline export     # JSON exports
```

## Configuration

```typescript
// config/pipeline.config.ts
export default {
  repositories: [{ owner: "JejuNetwork", name: "Jeju" }],
  scoring: { pullRequest: 10, codeReview: 5, issue: 3, comment: 1 },
};
```

## Environment

```bash
GITHUB_TOKEN=ghp_...
OPENROUTER_API_KEY=sk-or-...
```

## Development

```bash
cd apps/leaderboard
bun install
bun run db:migrate
bun run build
bunx serve@latest out
```

Data stored in `_data` branch (SQLite + JSON exports).
