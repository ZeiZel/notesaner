---
title: Reverse Proxy (Nginx / Caddy)
description: Nginx and Caddy configuration with WebSocket passthrough for Yjs.
---

# Reverse Proxy (Nginx / Caddy)

A reverse proxy handles TLS termination and routes traffic to the web and API services.

:::important
WebSocket proxying must be configured for Yjs real-time collaboration to work.
:::

## Nginx Configuration

```nginx
upstream web {
    server localhost:3000;
}

upstream api {
    server localhost:3001;
}

server {
    listen 443 ssl http2;
    server_name notesaner.example.com;

    ssl_certificate /etc/letsencrypt/live/notesaner.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/notesaner.example.com/privkey.pem;

    # Web app
    location / {
        proxy_pass http://web;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # API + WebSocket
    location /api/ {
        proxy_pass http://api;
        proxy_http_version 1.1;
        # WebSocket upgrade headers
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
}

server {
    listen 80;
    server_name notesaner.example.com;
    return 301 https://$host$request_uri;
}
```

## Caddy Configuration (Caddyfile)

```caddy
notesaner.example.com {
    reverse_proxy /api/* localhost:3001 {
        header_up Upgrade {>Upgrade}
        header_up Connection {>Connection}
    }

    reverse_proxy /* localhost:3000
}
```

Caddy handles HTTPS automatically via Let's Encrypt.
