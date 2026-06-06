# Blog Redesign — Architecture & Implementation Plan

> **Purpose:** Single reference for frontend + backend teams.  
> **Status:** Planning (not implemented)  
> **Last updated:** June 2026

---

## 1. Executive summary

Your direction is correct. The current blog is a **2010-style form** (title, excerpt, cover, giant textarea). For an artist platform it should feel closer to **Medium + Notion + Behance** — visual, structured, and safe to write in.

**Recommendation in one sentence:** Adopt a **block-based content model** in the database, implement the editor with **TipTap** (custom nodes for art-specific blocks), and ship in **three phases** so artists get value quickly without blocking on every feature at once.

---

## 2. Current state (this repo)

### Frontend today

| Area | Implementation |
|------|----------------|
| Create | `create-blog-modal.tsx` — react-hook-form + `<textarea>` |
| Edit | `EditBlog.tsx` — same pattern |
| Read | `BlogDetail.tsx` — `dangerouslySetInnerHTML` on `content` |
| API DTO | `{ title, content, excerpt?, featuredImage?, published? }` |
| Upload | Presigned S3 URL (same as artworks/collections) |
| Engagement | likes, dislikes, shares, comments, votes |
| Discovery | search, author filter, sort — **no tags/categories yet** |

### Backend assumption (inferred)

- `BlogPost.content` is a **plain string** (HTML or markdown stored as text).
- Single `featuredImage` field.
- No tags, categories, reading time, drafts/autosave, or structured media.

### What works and should stay

- Presigned S3 upload flow (`docs/UPLOAD_FLOW.md`)
- Slug-based URLs, publish/unpublish, moderation status (`PENDING` / `APPROVED` / `REJECTED`)
- Comments + like/dislike + share
- Author profile linkage

---

## 3. Opinion on your 15 proposals

| # | Feature | Verdict | Notes |
|---|---------|---------|-------|
| 1 | Rich text editor | **Do first** | TipTap (see §4) |
| 2 | Content blocks (+ Add Block) | **Do first** | Core architecture decision |
| 3 | Tags | **Do first** | High discovery value, low complexity |
| 4 | Reading time | **Do first** | Trivial to compute, big UX win |
| 5 | Multiple images | **Do first** | Via gallery block + `BlogMedia` table |
| 6 | Video support | **Phase 2** | YouTube/Vimeo embeds first; MP4 upload later |
| 7 | Artwork showcase | **Phase 2** | Custom block linking platform artworks |
| 8 | Draft + autosave | **Do first** | `status: DRAFT` + PATCH every 30s |
| 9 | Categories | **Do first** | Simpler than tags for browse UX |
| 10 | References | **Phase 2** | Nice for tutorials; not blocking |
| 11 | Polls | **Phase 3** | Needs voting UI + aggregation |
| 12 | Better cover picker | **Phase 2** | Drag-drop + pick from my artworks first; Unsplash/AI later |
| 13 | Extended reactions | **Phase 3** | Replace like/dislike gradually |
| 14 | Table of contents | **Phase 2** | Auto from heading blocks |
| 15 | Author card on post | **Do first** | Mostly frontend; data already exists |

**Defer intentionally:** AI cover generation, Unsplash integration, TikTok embeds, full Notion clone UX (slash commands everywhere on day one).

---

## 4. Editor choice — TipTap (recommended)

### Compared options

| Editor | Pros | Cons | Fit for Arthopia |
|--------|------|------|------------------|
| **TipTap** | React-first, ProseMirror power, custom nodes (artwork, gallery), extensions ecosystem, JSON output | Some setup for custom blocks | **Best fit** |
| Editor.js | Block UI out of the box | Weaker React integration, JSON block format differs from rich inline editing | Good but second choice |
| Lexical | Meta-backed, performant | Steeper learning curve, fewer ready-made extensions | Overkill for now |
| Plain textarea | Already have it | Not acceptable for artist UX | Replace |

### Why TipTap for an art platform

1. **Inline + blocks** — Artists want flowing prose *and* full-width images/galleries. TipTap handles both via block nodes.
2. **Custom nodes** — `ArtworkEmbed`, `ImageGallery`, `VideoEmbed`, `ReferenceList` as first-class editor blocks.
3. **JSON document** — Store `contentDocument` (TipTap/ProseMirror JSON). Render to HTML for SEO/cache optionally.
4. **Extensions** — Headings, bold, links, blockquote, code, horizontal rule, image upload, YouTube — all available.
5. **Same stack** — React 18 + TypeScript already in project.

### Packages (frontend, Phase 1)

```bash
pnpm add @tiptap/react @tiptap/starter-kit @tiptap/extension-link @tiptap/extension-image @tiptap/extension-placeholder @tiptap/extension-character-count
```

Phase 2 additions: `@tiptap/extension-youtube`, custom extensions for artwork/gallery/poll.

---

## 5. Architecture decision — block-based content

### Option A — Single TipTap JSON blob (recommended for Phase 1)

```prisma
model BlogPost {
  id              String   @id @default(uuid())
  contentDocument Json     // TipTap document
  contentHtml     String?  // optional cached HTML for fast read + SEO
  contentFormat   String   @default("tiptap/v1")
}
```

**Pros:** Fast to ship, one save payload, editor-native.  
**Cons:** Harder to query “all posts with artwork X embedded” without JSON search.

### Option B — Normalized `BlogContentBlock` rows (recommended long-term)

```prisma
model BlogContentBlock {
  id      String @id @default(uuid())
  blogId  String
  type    String // text | heading | image | gallery | video | quote | artwork | ...
  content Json   // type-specific payload
  order   Int
  blog    BlogPost @relation(...)
}
```

**Pros:** Analytics, reorder, partial updates, mobile editors, migrations per block type.  
**Cons:** More API surface, sync complexity with editor.

### **Hybrid (preferred overall strategy)**

1. **Phase 1:** Store TipTap JSON in `contentDocument`. Generate `contentHtml` on publish server-side.
2. **Phase 2:** On publish, **also** denormalize to `BlogContentBlock[]` for read-only rendering, TOC, and search indexing.
3. Keep `contentHtml` for backward compatibility and `<meta>` / Open Graph.

This avoids a big-bang migration while moving toward your Notion-style model.

---

## 6. Database schema (Prisma) — full proposal

### 6.1 Core post (extended)

```prisma
enum BlogPostStatus {
  DRAFT
  PENDING
  APPROVED
  REJECTED
  ARCHIVED
}

model BlogPost {
  id              String         @id @default(uuid())
  title           String
  slug            String         @unique
  excerpt         String?        @db.VarChar(500)

  // Content — hybrid model
  contentDocument Json?          // TipTap JSON (source of truth while editing)
  contentHtml     String?        @db.Text // rendered HTML for public read
  contentFormat   String         @default("tiptap/v1") // tiptap/v1 | blocks/v1 | legacy/html

  coverImage      String?        // renamed mentally from featuredImage; keep DB column name for migration

  authorId        String
  author          User           @relation(fields: [authorId], references: [id])

  status          BlogPostStatus @default(DRAFT)
  published       Boolean        @default(false)
  publishedAt     DateTime?

  readingTimeMin  Int?           // computed: ceil(wordCount / 200)

  views           Int            @default(0)
  likes           Int            @default(0)
  dislikes        Int            @default(0)
  shares          Int            @default(0)

  lastAutoSavedAt DateTime?
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt
  editedAt        DateTime?

  // Relations
  blocks          BlogContentBlock[]
  tags            BlogPostTag[]
  categories      BlogPostCategory[]
  media           BlogMedia[]
  references      BlogReference[]
  polls           BlogPoll[]

  @@index([authorId])
  @@index([published, publishedAt])
  @@index([status])
}
```

### 6.2 Content blocks (Phase 2 denormalization)

```prisma
model BlogContentBlock {
  id      String   @id @default(uuid())
  blogId  String
  type    String   // heading | paragraph | image | gallery | video | quote | divider | code | artwork | embed | reference_group
  content Json     // see §7 block payloads
  order   Int

  blog    BlogPost @relation(fields: [blogId], references: [id], onDelete: Cascade)

  @@index([blogId, order])
}
```

### 6.3 Tags

```prisma
model BlogTag {
  id    String @id @default(uuid())
  name  String @unique
  slug  String @unique

  posts BlogPostTag[]
}

model BlogPostTag {
  postId String
  tagId  String

  post BlogPost @relation(fields: [postId], references: [id], onDelete: Cascade)
  tag  BlogTag  @relation(fields: [tagId], references: [id], onDelete: Cascade)

  @@id([postId, tagId])
}
```

**Seed examples:** Digital Art, Oil Painting, Tutorial, Process, AI Art, Sketching, Art History.

### 6.4 Categories

```prisma
model BlogCategory {
  id    String @id @default(uuid())
  name  String @unique
  slug  String @unique

  posts BlogPostCategory[]
}

model BlogPostCategory {
  postId     String
  categoryId String

  post     BlogPost     @relation(fields: [postId], references: [id], onDelete: Cascade)
  category BlogCategory @relation(fields: [categoryId], references: [id], onDelete: Cascade)

  @@id([postId, categoryId])
}
```

**Seed examples:** Tutorial, Behind the Scenes, Showcase, Story, Process, Review, News, Interview.

> **Rule:** Categories = broad browse buckets (1–2 per post). Tags = many fine-grained labels.

### 6.5 Media (images + videos)

```prisma
enum BlogMediaType {
  IMAGE
  VIDEO_FILE
  YOUTUBE
  VIMEO
  EMBED
}

model BlogMedia {
  id        String        @id @default(uuid())
  blogId    String
  type      BlogMediaType
  url       String
  caption   String?
  altText   String?
  order     Int           @default(0)
  metadata  Json?         // width, height, duration, embedId

  blog BlogPost @relation(fields: [blogId], references: [id], onDelete: Cascade)

  @@index([blogId])
}
```

Use for: process shots (sketch → final), gallery carousels, attached MP4 (Phase 2+).

### 6.6 References

```prisma
model BlogReference {
  id     String @id @default(uuid())
  blogId String
  title  String
  url    String
  order  Int    @default(0)

  blog BlogPost @relation(fields: [blogId], references: [id], onDelete: Cascade)
}
```

### 6.7 Polls (Phase 3)

```prisma
model BlogPoll {
  id       String @id @default(uuid())
  blogId   String @unique
  question String

  blog    BlogPost       @relation(...)
  options BlogPollOption[]
}

model BlogPollOption {
  id     String @id @default(uuid())
  pollId String
  label  String
  votes  Int    @default(0)

  poll BlogPoll @relation(...)
}

model BlogPollVote {
  id       String @id @default(uuid())
  pollId   String
  optionId String
  userId   String

  @@unique([pollId, userId])
}
```

### 6.8 Extended reactions (Phase 3 — optional replacement for like/dislike)

```prisma
enum BlogReactionType {
  LIKE
  INSPIRING
  HELPFUL
  EDUCATIONAL
  CREATIVE
}

model BlogReaction {
  id     String           @id @default(uuid())
  postId String
  userId String
  type   BlogReactionType

  @@unique([postId, userId])
}
```

Keep existing `likes`/`dislikes` counts during transition; aggregate from reactions later.

---

## 7. Block content JSON shapes

When denormalizing TipTap → `BlogContentBlock`, use consistent payloads:

```typescript
// heading
{ "level": 2, "text": "My Painting Process" }

// paragraph (plain text fallback)
{ "text": "Today I want to show..." }

// image
{ "url": "https://...", "alt": "...", "caption": "..." }

// gallery
{ "images": [{ "url": "...", "caption": "Sketch" }, { "url": "...", "caption": "Final" }] }

// video
{ "provider": "youtube", "url": "https://...", "videoId": "..." }

// artwork (platform link)
{ "artworkId": "uuid", "title": "Sunset Dreams", "year": 2026 }

// quote
{ "text": "...", "attribution": "..." }

// code
{ "language": "glsl", "code": "..." }

// reference_group (or separate BlogReference rows)
{ "references": [{ "title": "...", "url": "..." }] }
```

---

## 8. Reading time

### Algorithm

```typescript
function computeReadingTimeMinutes(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.ceil(words / 200))
}
```

- Run on **plain text** extracted from TipTap JSON or `contentHtml` (strip tags).
- Store in `readingTimeMin` on save/publish (don’t compute on every read).
- Display: **“5 min read”** on card + detail header.

---

## 9. Drafts & autosave

### State machine

```
DRAFT → (publish) → PENDING or APPROVED (depending on moderation rules)
APPROVED → (unpublish) → DRAFT
PENDING → APPROVED | REJECTED
```

### Autosave (frontend + backend)

| Concern | Approach |
|---------|----------|
| Interval | Every **30 seconds** while dirty |
| Endpoint | `PATCH /blog/:id/autosave` |
| Payload | `{ title?, excerpt?, contentDocument?, coverImage?, tagIds?, categoryIds? }` |
| Response | `{ id, lastAutoSavedAt, readingTimeMin }` |
| UI | “Saved” / “Saving…” indicator (Notion-style) |
| Conflict | Last-write-wins for MVP; `updatedAt` check later |

**Important:** Autosave must **not** set `published: true`. Only explicit “Publish” does.

---

## 10. API contract (backend)

### 10.1 Create draft

```http
POST /blog
Authorization: Bearer …

{
  "title": "Untitled post",
  "contentDocument": { "type": "doc", "content": [] },
  "status": "DRAFT"
}

→ 201 { id, slug, status, lastAutoSavedAt, ... }
```

Creating should immediately return a draft so autosave has an `id` (avoid creating on every keystroke).

### 10.2 Autosave

```http
PATCH /blog/:id/autosave
{ "title", "excerpt", "contentDocument", "coverImage", "tagIds", "categoryIds" }
```

### 10.3 Publish

```http
POST /blog/:id/publish
```

Server-side on publish:

1. Validate required fields (title, min content length).
2. Compute `readingTimeMin`.
3. Render `contentHtml` from TipTap JSON.
4. Optionally build `BlogContentBlock[]` + `BlogMedia[]`.
5. Set `published: true`, `publishedAt`, `status` per moderation rules.
6. Regenerate slug if title changed (optional policy).

### 10.4 Read public post

```http
GET /blog/slug/:slug
```

Response (extended):

```typescript
{
  id, title, slug, excerpt, coverImage,
  contentHtml,           // for render
  contentDocument?,      // omit on public if you prefer; include for author edit view
  readingTimeMin,
  publishedAt,
  author: { id, name, image, bio?, artworkCount?, followerCount? },
  tags: { id, name, slug }[],
  categories: { id, name, slug }[],
  references: { title, url }[],
  tableOfContents?: { id, level, text }[],  // derived from headings
  views, likes, ...
}
```

### 10.5 List / filter

Extend query params:

```
GET /blog?tag=digital-art&category=tutorial&search=…&sortBy=publishedAt
```

### 10.6 Tags & categories admin

```
GET  /blog/tags
GET  /blog/categories
POST /blog/tags        (admin or auto-create on write)
```

---

## 11. Frontend structure (proposed)

```
src/
  components/blog/
    editor/
      blog-editor.tsx           # TipTap shell
      blog-editor-toolbar.tsx
      extensions/
        artwork-embed.ts        # Phase 2
        image-gallery.ts
        video-embed.ts
      nodes/                    # React node views
    blog-author-card.tsx        # Phase 1 read view
    blog-table-of-contents.tsx  # Phase 2
    blog-cover-picker.tsx       # Phase 2
    blog-tag-input.tsx
    blog-category-select.tsx
  pages/
    BlogEditor.tsx              # full-page create/edit (replace modal-only flow)
    BlogDetail.tsx              # read view upgrades
```

### Editor UX (Phase 1)

- Full-page `/blog/new` and `/blog/:slug/edit` (modal OK for “quick start” but editor should be full page).
- Sticky toolbar: H2/H3, bold, italic, link, quote, image, divider.
- Slash command `/` for block insertion (Phase 2 polish).
- Cover image zone at top (drag-drop in Phase 2).
- Sidebar or bottom sheet: tags, category, excerpt, publish settings.

### Read view (Phase 1)

- Author card under title.
- `{readingTimeMin} min read` · date · views.
- Render `contentHtml` in styled `.blog-content` **or** render from `contentDocument` via TipTap read-only.
- Tags as links → `/blog?tag=…`.

---

## 12. Migration from current `content: string`

### Step 1 — Add columns (non-breaking)

- Add `contentDocument`, `contentHtml`, `contentFormat`, `readingTimeMin`, `status`, `lastAutoSavedAt`.
- Backfill: `contentFormat = 'legacy/html'`, `contentHtml = content`.

### Step 2 — Dual write

- New posts: save TipTap JSON + generated HTML.
- Old posts: still served from `contentHtml`.

### Step 3 — Optional conversion job

- Script: HTML → TipTap JSON (lossy for complex HTML; manual review for top posts).

### Step 4 — Deprecate raw `content`

- Stop writing to legacy column; keep read fallback for 1–2 releases.

---

## 13. Phased rollout

### Phase 1 — “Medium for artists” (4–6 weeks)

**Goal:** Replace textarea; artists can write rich posts without losing work.

| Backend | Frontend |
|---------|----------|
| `contentDocument`, `contentHtml`, `contentFormat` | TipTap editor |
| `readingTimeMin` | Display on card + detail |
| `BlogTag`, `BlogPostTag` | Tag input on editor |
| `BlogCategory`, `BlogPostCategory` | Category select |
| `status: DRAFT`, autosave endpoint | Autosave + status indicator |
| Publish pipeline generates HTML | Full-page editor route |
| | Author card on detail |

**Exit criteria:** Create → autosave → publish → read with formatting, tags, reading time.

### Phase 2 — “Behance inside the post” (4–6 weeks)

| Backend | Frontend |
|---------|----------|
| `BlogContentBlock` denormalize on publish | Gallery + video blocks |
| `BlogMedia` | Multi-image process posts |
| `BlogReference` | Sources section |
| TOC generation from headings | Sticky TOC on detail |
| Artwork embed validation | Pick artwork from user’s listings |
| Cover from artwork library | Cover picker upgrade |

### Phase 3 — Engagement & polish (later)

- Polls (`BlogPoll*`)
- Extended reactions
- Unsplash / AI cover (if product wants)
- Advanced search on block content
- Email publish notifications (Substack-style)

---

## 14. What I would **not** do

1. **Editor.js + TipTap together** — pick one editor framework.
2. **Store only HTML** — you lose structured blocks for TOC, artwork embeds, and galleries.
3. **Ship all 15 features before any release** — artists wait months; nothing launches.
4. **Autosave without draft `id`** — always `POST /blog` once, then PATCH.
5. **Replace like/dislike on day one** — add extended reactions alongside, migrate later.

---

## 15. Security & moderation

- **Sanitize HTML** on server when generating `contentHtml` (DOMPurify or similar).
- **Validate embed URLs** (YouTube/Vimeo allowlist only).
- **Image uploads** — existing presigned flow; max size/type checks unchanged.
- **Published posts** — keep `PENDING` / `APPROVED` workflow for moderated platforms.
- **Rate limit** autosave: e.g. max 1 request / 15s per post per user.

---

## 16. SEO & sharing

- Generate `contentHtml` on publish for crawlers.
- Open Graph: `coverImage`, `title`, `excerpt`.
- JSON-LD `Article` with `author`, `datePublished`, `wordCount`.
- Slug remains canonical URL: `/blog/:slug`.

---

## 17. Open questions for product/backend

1. **Moderation:** Does every publish go to `PENDING` or only first-time authors?
2. **Tags:** User-created free tags vs curated list only?
3. **Categories:** One per post or multiple?
4. **Legacy posts:** Auto-convert HTML → TipTap or leave as HTML forever?
5. **Comments:** Keep flat or add threading (already has `parentId` in types)?
6. **Merge conflict:** Remote blog UI redesign vs local pagination — resolve `Blog.tsx` and align on one layout before editor work.

---

## 18. Immediate next steps

### Backend

1. Review and approve schema (§6).
2. Add migration for new columns + tag/category tables.
3. Implement `POST /blog` (draft), `PATCH /blog/:id/autosave`, publish pipeline with HTML render.
4. Extend `GET /blog/slug/:slug` response shape (§10.4).

### Frontend

1. Resolve git merge on `src/pages/Blog.tsx` (`git add` after review).
2. Add TipTap dependencies.
3. Build `BlogEditor` page and wire create/edit routes.
4. Update `BlogDetail` for author card + reading time + tags.
5. Deprecate textarea in `create-blog-modal` → redirect to `/blog/new`.

---

## 19. Summary recommendation

| Topic | Choice |
|-------|--------|
| Content model | **Block-based** (TipTap JSON now, `BlogContentBlock` on publish later) |
| Editor | **TipTap** |
| Phase 1 scope | Rich editor, drafts/autosave, tags, categories, reading time, author card |
| Phase 2 | Galleries, video, artwork embeds, TOC, references, cover picker |
| Phase 3 | Polls, extended reactions, AI/Unsplash |
| Keep from today | S3 uploads, slugs, comments, votes, publish flow, pagination |

Your instinct to move away from a single `content String` is the right long-term call for an art platform. TipTap gives the best balance of **shipping speed** and **room to grow** into Notion/Behance-style blocks without rewriting the editor in a year.

---

*This document should be shared with backend as the source of truth for schema and API design. Update it when decisions in §17 are finalized.*
