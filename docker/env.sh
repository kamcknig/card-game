#!/bin/sh
# Inject runtime environment variables into env.js.
# ENV_JS_DIR allows overriding the output directory (defaults to nginx html root).
ENV_JS_DIR="${ENV_JS_DIR:-/usr/share/nginx/html}"
cat <<EOF > "${ENV_JS_DIR}/env.js"
window.__env = {
  wsHost: '${WS_HOST-http://localhost:3000}'
};
EOF
