#!/usr/bin/env bash
# video-to-site installer — https://github.com/arjav1181/video-to-site
# Usage: curl -fsSL https://raw.githubusercontent.com/arjav1181/video-to-site/main/install.sh | bash
set -euo pipefail

VERSION="latest"
REPO="arjav1181/video-to-site"

info()  { printf '\033[0;36m▸\033[0m %s\n' "$1"; }
ok()    { printf '\033[0;32m✓\033[0m %s\n' "$1"; }
fatal() { printf '\033[0;31m✗\033[0m %s\n' "$1" >&2; exit 1; }

while [ $# -gt 0 ]; do
  case "$1" in
    --version) VERSION="${2:?Missing value for --version}"; shift 2 ;;
    *) fatal "Unknown option: $1 (usage: install.sh [--version x.y.z])" ;;
  esac
done

info "Installing video-to-site@${VERSION}..."

# Node 18+ required (sharp + CLI runtime)
command -v node >/dev/null 2>&1 || fatal "node not found — install Node.js 18+ from https://nodejs.org"
NODE_MAJOR="$(node -p "process.versions.node.split('.')[0]")"
[ "$NODE_MAJOR" -ge 18 ] || fatal "node 18+ required (found $(node -v))"

# ffmpeg + ffprobe do the video work
command -v ffmpeg >/dev/null 2>&1 || fatal "ffmpeg not found — install it (https://ffmpeg.org/download.html)"
command -v ffprobe >/dev/null 2>&1 || fatal "ffprobe not found — it ships with ffmpeg"

# Prefer npm for global installs, fall back to bun
if command -v npm >/dev/null 2>&1; then
  PM="npm"
elif command -v bun >/dev/null 2>&1; then
  PM="bun"
else
  fatal "neither npm nor bun found — install Node.js (includes npm)"
fi

if [ "$PM" = "npm" ]; then
  npm install -g "video-to-site@${VERSION}"
else
  bun add -g "video-to-site@${VERSION}"
fi

command -v video-to-site >/dev/null 2>&1 || fatal "install succeeded but video-to-site is not on PATH (check your npm global bin dir)"

ok "Installed $(video-to-site --version)"
echo ""
echo "Try it:"
echo "  video-to-site my-video.mp4"
echo ""
echo "Docs: https://github.com/${REPO}"
