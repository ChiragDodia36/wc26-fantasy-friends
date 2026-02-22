#!/usr/bin/env bash
set -e
cd "$(dirname "$0")/../apps/backend"
alembic upgrade head

