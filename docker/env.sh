#!/bin/sh
# Runtime container init for the frontend image. Runs once at container start.
#
# Responsibilities:
#   1. Generate env.js so the Angular bundle picks up WS_HOST overrides.
#      With nginx proxying enabled (see proxy-locations.conf below) the
#      browser only ever talks to the frontend origin, so wsHost defaults
#      to '' which makes Angular fetch/io() use relative URLs. Setting
#      WS_HOST_OVERRIDE to a full URL is still supported for the rare case
#      of running the static bundle directly against a remote backend
#      without nginx in front.
#   2. Generate the security-headers nginx include with a CSP whose
#      connect-src is just 'self' (same-origin to nginx, which proxies
#      backwards to the game server).
#   3. Generate the proxy-locations include with proxy_pass directives for
#      the auth, socket.io, debug, and status routes. WS_HOST must be set
#      to the backend's external URL (e.g. the Azure Container App FQDN);
#      env.sh extracts the host portion for SNI / Host header use.

# ENV_JS_DIR allows overriding the output directory (defaults to nginx html root).
ENV_JS_DIR="${ENV_JS_DIR:-/usr/share/nginx/html}"

# Default to '' so Angular issues relative requests handled by nginx proxying.
# Set WS_HOST_OVERRIDE to force a full URL in env.js (rare — bypasses the
# nginx proxy and goes cross-origin to the backend).
WS_HOST_BROWSER="${WS_HOST_OVERRIDE-}"
cat <<EOF > "${ENV_JS_DIR}/env.js"
window.__env = {
  wsHost: '${WS_HOST_BROWSER}'
};
EOF

# Resolve the upstream backend URL for nginx proxying. WS_HOST is required
# in any environment where nginx is fronting the backend.
WS_HOST="${WS_HOST:-http://localhost:3000}"
# Strip the scheme from WS_HOST to derive the backend host name. nginx needs
# this for the upstream Host header (so the backend sees its own hostname,
# matching what TLS / Host-based routing expects) and for SNI on HTTPS
# upstreams.
BACKEND_HOST=$(echo "$WS_HOST" | sed -E 's|^[a-zA-Z]+://||; s|/.*$||')

# Only emit nginx config when running inside an nginx image.
if [ -d /etc/nginx/conf.d ]; then
  # Generated security-headers include. Regenerated on every container start.
  #
  # Directives:
  #   default-src 'self'         -- block anything not explicitly allowed
  #   script-src 'self'          -- only scripts from same origin
  #   style-src 'self' 'unsafe-inline' https://fonts.googleapis.com
  #                              -- Angular component styles + Google Fonts
  #   img-src 'self' data:       -- allow inline SVG / data URIs
  #   font-src 'self' https://fonts.gstatic.com -- local + Google Fonts files
  #   connect-src 'self'         -- nginx proxies /auth, /socket.io, /debug,
  #                                 and /status, so all XHR/WS targets are
  #                                 same-origin and no remote URL needs to
  #                                 be allow-listed
  #   frame-ancestors 'none'     -- equivalent to X-Frame-Options: DENY
  #   base-uri 'self'            -- prevent base-tag injection attacks
  #   form-action 'self'         -- prevent form hijacking
  cat <<NGINX_EOF > /etc/nginx/conf.d/security-headers.conf
# Generated at container start by env.sh — do not edit by hand.
add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data:; font-src 'self' https://fonts.gstatic.com; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self';" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
NGINX_EOF

  # Generated proxy-locations include. nginx forwards backend-bound paths
  # to ${WS_HOST} so the Angular app can issue relative-URL requests and
  # everything stays same-origin in the browser. Each location reuses the
  # same proxy_set_header block; Socket.IO additionally needs the upgrade
  # headers and an extended read timeout for long-lived WebSocket frames.
  cat <<NGINX_EOF > /etc/nginx/conf.d/proxy-locations.conf
# Generated at container start by env.sh — do not edit by hand.
# Upstream: ${WS_HOST}

# Auth API: forwards /auth/* (login, logout, sessions, register, etc.) to the
# game server. The browser sees these as same-origin, so CORS preflight is
# avoided entirely.
location /auth/ {
    proxy_pass ${WS_HOST};
    proxy_http_version 1.1;
    proxy_ssl_server_name on;
    proxy_set_header Host ${BACKEND_HOST};
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
}

# Socket.IO: requires the Upgrade/Connection headers so nginx hands off the
# TCP stream to the backend for WebSocket framing. proxy_read_timeout is
# extended to a day so idle game connections are not dropped by nginx.
location /socket.io/ {
    proxy_pass ${WS_HOST};
    proxy_http_version 1.1;
    proxy_ssl_server_name on;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host ${BACKEND_HOST};
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_read_timeout 86400s;
}

# Debug routes (/debug/match-state and friends). The backend gates these on
# the same admin auth as the rest of the API; nginx just forwards.
location /debug/ {
    proxy_pass ${WS_HOST};
    proxy_http_version 1.1;
    proxy_ssl_server_name on;
    proxy_set_header Host ${BACKEND_HOST};
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
}

# Health endpoint. Exact-match so it never collides with the SPA fallback.
location = /status {
    proxy_pass ${WS_HOST};
    proxy_http_version 1.1;
    proxy_ssl_server_name on;
    proxy_set_header Host ${BACKEND_HOST};
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
}
NGINX_EOF
fi
