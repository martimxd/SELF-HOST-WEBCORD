#!/bin/sh
set -eu

if [ -e .env ]; then
  echo ".env already exists; refusing to overwrite it." >&2
  exit 1
fi

if ! command -v openssl >/dev/null 2>&1; then
  echo "openssl is required to generate secure secrets." >&2
  exit 1
fi

umask 077
cp .env.example .env

database_password="$(openssl rand -hex 24)"
jwt_secret="$(openssl rand -hex 32)"
livekit_key="webcord_$(openssl rand -hex 8)"
livekit_secret="$(openssl rand -hex 32)"

sed -i \
  -e "s/CHANGE_ME_DATABASE_PASSWORD/$database_password/" \
  -e "s/CHANGE_ME_JWT_SECRET/$jwt_secret/" \
  -e "s/CHANGE_ME_LIVEKIT_KEY/$livekit_key/" \
  -e "s/CHANGE_ME_LIVEKIT_SECRET/$livekit_secret/" \
  .env

echo "Created .env with unique random secrets."
echo "Review WEB_ORIGIN before exposing WebCord outside localhost."
