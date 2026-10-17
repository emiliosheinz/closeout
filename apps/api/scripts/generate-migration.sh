#!/bin/sh
set -e

name=$1

if [ -z "$name" ]; then
  echo "Usage: migration:generate <MigrationName>"
  exit 1
fi

tsx node_modules/typeorm/cli.js migration:generate -d src/database/connection.ts src/database/migrations/"$name"
