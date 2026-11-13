#!/usr/bin/env bash
set -euo pipefail

# Keep the key in the existing named data volume; never replace a pre-existing key.
keyfile=/data/db/.unarchive-replica-key
if [ ! -s "$keyfile" ]; then
  umask 077
  head -c 756 /dev/urandom | base64 | tr -d '\n' > "$keyfile"
fi
chown mongodb:mongodb "$keyfile"
chmod 400 "$keyfile"
exec /usr/local/bin/docker-entrypoint.sh mongod --replSet rs0 --bind_ip_all --keyFile "$keyfile"
