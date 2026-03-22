#!/bin/sh
cat <<EOF > /usr/share/nginx/html/env.js
window.__env = {
  wsHost: '${WS_HOST:-http://localhost:3000}'
};
EOF
