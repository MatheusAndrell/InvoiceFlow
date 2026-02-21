#!/bin/sh
set -e

echo "Running database migrations..."
npx prisma migrate deploy

echo "Running database seed..."
node dist/prisma/seed.js

echo "Starting API server..."
exec node dist/src/index.js
