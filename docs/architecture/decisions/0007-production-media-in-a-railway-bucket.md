# 7. Production media in a Railway Bucket

Date: 2026-10-18

## Status

Accepted

Supersedes [4. Processed images on local disk behind a storage interface](0004-local-media-storage-behind-an-interface.md)
for production storage. The image pipeline, file names and `/media` serving from ADR 4
are unchanged.

## Context

Production runs on Railway with zero-downtime deploys: the new api starts beside the
old one and traffic moves only after its health check passes. A Railway volume
attaches to one deployment at a time, so every api deploy would stop the old instance
before starting the new one, and media would live on a disk with no backups. The
store needs uploaded photos to survive every deploy and stay private apart from what
the storefront serves.

## Decision

- Production stores media in a private Railway Bucket (S3-compatible, region `iad`)
  through a second `MediaStorage` implementation, `BucketStorage`, built on
  `@aws-sdk/client-s3`. Local development, tests and the end-to-end stack keep
  `LocalDiskStorage` under `MEDIA_DIR`.
- The implementation is chosen from configuration: any `S3_*` variable selects the
  bucket and then all five are required; with none set, `MEDIA_DIR` selects local
  disk; anything else stops the api at boot. A partial bucket configuration never
  falls back to disk, and the production image declares no `MEDIA_DIR`.
- Bucket credentials reach the api as Railway references to the bucket, never as
  values in the repository.
- The api keeps proxying reads at `/media/:file`, so image URLs stay same-origin and
  the bucket stays private.

## Consequences

- api deploys keep zero downtime; uploads survive redeploys and rollbacks (verified by
  hashing a photo across a redeploy, and an anonymous bucket read returns 403).
- Every image byte still passes through the api; acceptable at this traffic, and the
  `Cache-Control: immutable` header lets browsers keep variants.
- There are no bucket backups; deleting the bucket loses every photo. The
  infrastructure workflow refuses any plan that touches the bucket.
- Moving existing local files to the bucket is a one-time copy with the same names.
- The plan-only GitHub Environment that previews infrastructure changes on pull
  requests holds a token for the same Railway environment as the apply; Railway
  project tokens cannot be limited to planning. With one maintainer and fork pull
  requests skipped, that risk is accepted.
