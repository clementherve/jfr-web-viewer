#!/bin/sh
# Opt-in Umami analytics. Run by the nginx image's entrypoint before nginx starts.
# Does nothing unless UMAMI_WEBSITE_ID is set, so the published image never tracks by default.
#
#   UMAMI_WEBSITE_ID  required to enable, the website's UUID from Umami
#   UMAMI_SCRIPT_URL  optional, defaults to Umami Cloud
#   UMAMI_DOMAINS     optional, comma-separated hostnames to restrict tracking to
set -eu

[ -n "${UMAMI_WEBSITE_ID:-}" ] || exit 0

INDEX=/usr/share/nginx/html/index.html
URL="${UMAMI_SCRIPT_URL:-https://cloud.umami.is/script.js}"
DOMAINS="${UMAMI_DOMAINS:-}"

fail() {
  echo "umami: $1, analytics not enabled" >&2
  exit 0
}

# Values end up inside an HTML attribute and a sed replacement, so reject anything that could escape either.
unsafe() {
  case "$1" in
    *[\"\<\>\'\|\&\\[:space:]]*) return 0 ;;
    *) return 1 ;;
  esac
}

echo "$UMAMI_WEBSITE_ID" | grep -Eq '^[0-9a-fA-F-]{36}$' || fail "UMAMI_WEBSITE_ID is not a UUID"
case "$URL" in
  https://*) ;;
  *) fail "UMAMI_SCRIPT_URL must start with https://" ;;
esac
unsafe "$URL" && fail "UMAMI_SCRIPT_URL contains invalid characters"
[ -z "$DOMAINS" ] || ! unsafe "$DOMAINS" || fail "UMAMI_DOMAINS contains invalid characters"

# A restarted container keeps its filesystem; don't inject twice.
if grep -q 'data-website-id=' "$INDEX"; then
  echo "umami: already enabled"
  exit 0
fi

TAG="<script defer src=\"$URL\" data-website-id=\"$UMAMI_WEBSITE_ID\""
[ -z "$DOMAINS" ] || TAG="$TAG data-domains=\"$DOMAINS\""
TAG="$TAG></script>"

sed -i "s|</head>|$TAG</head>|" "$INDEX"
echo "umami: analytics enabled for $UMAMI_WEBSITE_ID"
