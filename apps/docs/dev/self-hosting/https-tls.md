---
title: HTTPS & TLS
description: Configure HTTPS with Let's Encrypt, Certbot, or self-signed certificates.
---

# HTTPS & TLS

:::info Coming Soon
This page is under construction. Complete documentation will be available soon.
:::

## Let's Encrypt with Certbot (Nginx)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d notesaner.example.com
```

Certbot automatically configures Nginx and sets up auto-renewal.

## Let's Encrypt with Caddy

Caddy handles TLS automatically — no extra configuration needed. Just set your domain in the Caddyfile:

```caddy
notesaner.example.com {
    # Caddy automatically gets and renews Let's Encrypt certs
    reverse_proxy localhost:3000
}
```

## Self-Signed Certificate (Development)

```bash
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /etc/ssl/private/notesaner.key \
  -out /etc/ssl/certs/notesaner.crt
```
