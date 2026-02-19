# Marketplace Milestones

Last updated: 2026-02-12

## Milestone 1 - Museum Context Flow

- Make selected museum a global context
- Auto-filter artworks, items, visits by selected museum
- UI indicator + quick change

### Progress log

- 2026-02-11: Verified routes/UX flow, kept general navigation visible without museum, filtered visits by museum, added museum CTA in visit editor.
- 2026-02-11: Removed general menu section, left dashboard only; added museum selection banners on artworks/contents/visits.
- 2026-02-12: Redirect to dashboard on museum deselection to avoid museum-scoped pages without context.
- 2026-02-12: Seeded items now include museumId so contents page shows results under museum filter.
- 2026-02-12: Locked artwork museum selection to the active museum with prefill and CTA.
- 2026-02-12: Wikidata artwork search filters to artworks in the selected museum.
- 2026-02-12: Wikidata author/movement search added; artwork selection now fills author/movement IDs.
- 2026-02-12: Removed forceRemote/local fallback: Wikidata search is always remote, museum-filtered by museum Wikidata ID when available.
- 2026-02-12: Fixed museum-filtered remote search reliability (SPARQL filter on museum dataset + safe museumId resolution).
- 2026-02-12: Added remote fallback strategy for museum search (shortlist + mwapi museum-constrained fallback) to avoid empty results.
- 2026-02-12: Boosted museum search recall/performance with dual-language shortlist (it+en) and larger candidate pool.
- 2026-02-12: Added final remote museum fallback with CONTAINS text match (partial titles like "adorazione").
- 2026-02-12: Improved museum search ranking for partial queries by fetching wider candidate sets and re-ranking by title/author relevance.

## Milestone 2 - Item Creator Complete

- Integrate content-matrix-editor (multi-duration + multi-level)
- Support multiple versions per reference
- Validation + save UX

## Milestone 3 - Visit Editor Complete

- Align editor to spec (metadata, language UI)
- Refine logistic/navigation step UX
- Improve item selection per artwork

## Milestone 4 - Items Browser Advanced

- Advanced filters (museum, author, style, language, license, price)
- Server pagination + performance (optional virtual scroll)
- Better selection UX for large lists

## Milestone 5 - Content Marketplace View

- Marketplace listing view
- Paid/free preview logic
- Mock purchase + sales summary

## Milestone 6 - Unified Images

- Use image-editor for items, artworks, visits
- Local upload + URL + crop/resize
- Replace base64-only flows

## Milestone 7 - Translations and TTS

- AI translation UI
- Text-to-speech preview

## Milestone 8 - Responsive and UX Polish

- Desktop/tablet/mobile checks
- Loading/error/empty states consistency
- Visual polish and accessibility
