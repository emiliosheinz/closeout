# 7. Production media in a Railway Bucket

Date: 2026-10-18

## Status

Accepted

Supersedes [4. Processed images on local disk behind a storage interface](0004-local-media-storage-behind-an-interface.md)
for production storage. The image pipeline, file names and `/media` serving are
unchanged.

## Context

Production runs on Railway with zero-downtime deploys. A Railway volume attaches to
one deployment at a time, so every api deploy would stop the old instance first,
and the files would have no backups.

## Decision

- Production stores media in a private Railway Bucket (S3-compatible, region `iad`)
  through `BucketStorage`, a second `MediaStorage` built on `@aws-sdk/client-s3`.
  Development, tests and end-to-end keep `LocalDiskStorage` under `MEDIA_DIR`.
- `S3_*` variables select the bucket (all five required, never a fallback to
  disk); otherwise `MEDIA_DIR`. Credentials are Railway references, not repository
  values.
- The api keeps serving `/media/:file`, so URLs stay same-origin and the bucket
  stays private.

## Consequences

- api deploys keep zero downtime and uploads survive them.
- Image bytes pass through the api; fine at this traffic, and variants are cached
  as immutable.
- The bucket has no backups; the Deploy infrastructure workflow refuses any plan that
  touches it.
- The plan-only GitHub Environment holds a token for the same Railway environment
  as the apply (Railway project tokens cannot be limited to planning); accepted
  with one maintainer and fork pull requests skipped.
