# Engagement Data Seed Script

This script seeds engagement data (views, likes, comments, favorites) for artworks to enable the trending artists feature.

## What it seeds

- **Interactions (Views)**: 5-50 views per artwork (randomly distributed)
- **Interactions (Likes)**: 1-15 likes per artwork (70% of artworks get likes)
- **Comments**: 1-8 comments per artwork (60% of artworks get comments)
- **Favorites**: 1-10 favorites per artwork (50% of artworks get favorited)

## Engagement Score Calculation

The trending algorithm uses a weighted formula:
- **Views**: 1x weight
- **Likes**: 3x weight
- **Comments**: 2x weight
- **Favorites**: 2x weight
- **Artwork Count**: 1x weight

## Prerequisites

1. **Run the landing page seed first**:
   ```bash
   npm run db:seed:landing
   ```
   This ensures you have artworks and users in the database.

2. **Ensure database is accessible**:
   - Check your `env/local.env` file has the correct `DATABASE_URL`
   - Make sure your database server is running and accessible

## How to Run

```bash
# From the art-store-backend directory
npm run db:seed:engagement

# Or with pnpm
pnpm db:seed:engagement
```

## What happens

1. Fetches all approved artworks
2. Creates random views for each artwork (5-50 views)
3. Creates random likes for 70% of artworks (1-15 likes each)
4. Creates random comments for 60% of artworks (1-8 comments each)
5. Creates random favorites for 50% of artworks (1-10 favorites each)
6. Displays a summary showing engagement metrics per artist
7. Shows artists sorted by engagement score

## After Running

The trending artists section will display artists based on their engagement scores:
- Artists with more views, likes, comments, and favorites will appear first
- The section will show the top 10 most engaged artists

## Notes

- The script is **idempotent** for favorites (checks for duplicates)
- Views and likes can have duplicates (same user can view multiple times, but likes are unique per user)
- Comments use generic author names
- The script shows a detailed summary at the end with engagement scores

## Troubleshooting

If you get a database connection error:
1. Check your `env/local.env` file has `DATABASE_URL` set correctly
2. Ensure your database server is running
3. Verify network connectivity to your database
4. Try running `npm run db:seed:landing` first to test the connection


