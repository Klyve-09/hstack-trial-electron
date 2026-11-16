#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/../.."
case "${1:-}" in
  '') build=true ;;
  --skip-build) build=false ;;
  *) echo "Usage: $0 [--skip-build]" >&2; exit 2 ;;
esac
if (( $# > 1 )); then
  echo "Usage: $0 [--skip-build]" >&2
  exit 2
fi

if "$build"; then
  owner_uid=$(id -u)
  owner_gid=$(id -g)
  # Root in a rootless daemon maps to the host user who owns this checkout.
  if docker info --format '{{json .SecurityOptions}}' | grep -q 'name=rootless'; then
    owner_uid=0
    owner_gid=0
  fi
  docker run --rm --init \
    -v "$PWD:/work" -w /work \
    -e HOST_UID="$owner_uid" -e HOST_GID="$owner_gid" \
    node:22-bookworm bash -euc '
      trap '\''for path in /work/out /work/node_modules /work/.vite; do
        if [ -e "$path" ]; then chown -R "$HOST_UID:$HOST_GID" "$path"; fi
      done'\'' EXIT
      apt-get update
      apt-get install -y --no-install-recommends rpm fakeroot dpkg-dev libgtk-3-0 libnss3 libasound2
      npm ci
      npm run make
    '
fi

for kind in deb rpm; do
  mapfile -d '' packages < <(find out/make -type f -name "*.$kind" -print0)
  if (( ${#packages[@]} != 1 )); then
    echo "FAIL: expected one .$kind package in out/make, found ${#packages[@]}" >&2
    exit 1
  fi
  package=${packages[0]}
  echo "=== Artifact: $package ==="
  stat -c 'Size: %s bytes' "$package"
  sha256sum "$package"
  case "$kind" in
    deb) image=ubuntu:24.04 ;;
    rpm) image=fedora:41 ;;
  esac
  echo 'Install-check container: seccomp=unconfined to permit the non-root Chromium namespace sandbox.'
  docker run --rm --init --security-opt seccomp=unconfined \
    -v "$PWD/out/make:/packages:ro" \
    -v "$PWD/scripts/release:/checks:ro" \
    "$image" bash /checks/linux-install-check.sh "$kind" "/packages/${package#out/make/}"
done
echo 'PASS: Linux deb and rpm built, installed, and launched with renderer processes.'
