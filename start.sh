#!/bin/sh
echo "Running Prisma migrations..."
npx prisma migrate deploy

echo "Starting application..."
node dist/src/main.js
