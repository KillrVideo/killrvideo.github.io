# POST /api/v1/videos/preview

## Metadata
- Service: Video Catalog
- Auth: None (public)
- Status Codes: 200, 400, 422

## Request Schema
```json
{ "youtubeUrl": "string(uri, required)" }
```

## Response Schema (200)
```json
{ "title": "string" }
```

## Error Responses
- 400: YouTube video not found, video is private, or YouTube API unavailable
- 422: Validation error (malformed youtubeUrl)

## Data Model
- No Cassandra tables accessed

## Key Patterns
- External API integration (YouTube oEmbed/Data API), no database write, preflight validation, caching recommended
