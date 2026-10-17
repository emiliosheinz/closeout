# 4. Processed images on local disk behind a storage interface

Date: 2026-10-17

## Status

Accepted

## Context

Photos sell the items. Uploads come from phones (large, with GPS EXIF). The app must
run locally with no cloud credentials, and may later run on several hosts.

## Decision

- The API decodes every upload with sharp (rejecting anything that is not JPEG, PNG
  or WebP, or over 40 megapixels or 10 MB) and stores three re-encoded variants:
  640px WebP for cards, 1600px WebP for the gallery and a 1200x630 JPEG for link
  previews. Re-encoding drops EXIF, including location. Originals are not kept.
- Files are named by a random UUID plus variant and written through `MediaStorage`;
  the local implementation writes to a directory backed by a Docker volume.
- The API serves files at `/media/:file` with immutable caching; the web app rewrites
  that path so image URLs are same-origin.

## Consequences

- No MinIO or S3 is needed to run; files survive container restarts.
- Moving to object storage means one new `MediaStorage` implementation and copying the
  files; names and database rows stay the same.
- HEIC is not accepted (sharp's prebuilt libvips lacks HEVC); Safari converts to JPEG.
