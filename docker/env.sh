#!/bin/sh
# Inject runtime environment variables into env.js.
# ENV_JS_DIR allows overriding the output directory (defaults to nginx html root).
ENV_JS_DIR="${ENV_JS_DIR:-/usr/share/nginx/html}"
cat <<EOF > "${ENV_JS_DIR}/env.js"
window.__env = {
  wsHost: '${WS_HOST-http://localhost:3000}'
};
EOF

# Derive the runtime server origin for use in the Content-Security-Policy header.
# Both the HTTP origin (for fetch/XHR auth calls) and the WebSocket origin (for
# Socket.IO upgrades) must appear in connect-src. We derive the WS form by
# replacing the scheme: http -> ws, https -> wss.
WS_HOST="${WS_HOST:-http://localhost:3000}"
WS_CONNECT_SRC=$(echo "$WS_HOST" | sed 's|^http://|ws://|; s|^https://|wss://|')

# Write a generated Nginx include file with all security headers. This file is
# included by the server block in nginx.conf and is regenerated on every
# container start, so the CSP always reflects the current WS_HOST value.
#
# Directives:
#   default-src 'self'         -- block anything not explicitly allowed
#   script-src 'self'          -- only scripts from same origin
#   style-src 'self' 'unsafe-inline' -- Angular injects component styles as
#                                       <style> tags at runtime; nonces would be
#                                       required to remove 'unsafe-inline' here
#   img-src 'self' data:       -- allow inline SVG/data URIs used by Angular Material
#   font-src 'self'            -- local fonts only
#   connect-src 'self' ...     -- same-origin fetch + both HTTP and WS forms of
#                                 the game server so auth API and Socket.IO work
#   frame-ancestors 'none'     -- equivalent to X-Frame-Options: DENY
#   base-uri 'self'            -- prevent base-tag injection attacks
#   form-action 'self'         -- prevent form hijacking
#
# X-Content-Type-Options: nosniff -- prevent MIME-type sniffing
# Referrer-Policy               -- limit referrer info to same-origin requests
# Permissions-Policy            -- disable unused browser features
cat <<NGINX_EOF > /etc/nginx/conf.d/security-headers.conf
# Generated at container start by env.sh — do not edit by hand.
add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' ${WS_HOST} ${WS_CONNECT_SRC}; frame-ancestors 'none'; base-uri 'self'; form-action 'self';" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
NGINX_EOF
