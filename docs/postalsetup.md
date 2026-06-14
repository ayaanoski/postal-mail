# Postal Self-Hosted Mail Server — VPS Setup Guide

This guide walks through setting up [Postal](https://postal.atech.media) on a clean Ubuntu VPS, then connecting it to our Mailer-US app as a sending provider.

---

## 1. VPS Requirements

| Requirement | Minimum | Recommended |
|------------|---------|-------------|
| CPU | 2 cores | 4 cores |
| RAM | 2 GB | 4 GB |
| Disk | 20 GB SSD | 40 GB SSD |
| OS | Ubuntu 20.04+ | Ubuntu 22.04 LTS |
| Ports open | 25, 465, 587, 443, 80 | Same |

Make sure your VPS provider **allows outbound port 25** (some block it by default — check with support).

Point a DNS A record to your VPS IP:
```
mail.yourdomain.com  A  <VPS_IP>
```

---

## 2. Install Postal (Modern Docker Method)

Postal v3 uses a Docker-based installation. SSH into your VPS as root and run:

```bash
# 1. Install Docker & Docker Compose (if not already installed)
curl -fsSL https://get.docker.com | sh
apt install -y nano

# 2. Start a MariaDB container for Postal
docker run -d --name postal-mariadb \
  -p 127.0.0.1:3306:3306 \
  --restart always \
  -e MARIADB_ROOT_PASSWORD=postal_root_password \
  -e MARIADB_DATABASE=postal \
  -e MARIADB_USER=postal \
  -e MARIADB_PASSWORD=postal_password \
  mariadb:10.11

# 3. Clone the official Postal installation helper
git clone https://github.com/postalserver/install.git /opt/postal/install
ln -s /opt/postal/install/bin/postal /usr/bin/postal

# 4. Bootstrap Postal (Replace with your actual domain, e.g., mail.mailer-us.com)
postal bootstrap mail.yourdomain.com

# 5. Configure the Database Connection
# You must edit the generated config file:
nano /opt/postal/config/postal.yml
# Under main_db and message_db, set:
# host: 127.0.0.1
# username: postal
# password: postal_password

# 6. Initialize the Database and Start Postal
postal initialize
postal make-user
postal start

# 7. Start Caddy Web Proxy (For HTTPS and Web UI)
# Make sure your domain's A record points to your VPS IP before running this
docker run -d \
  --name postal-caddy \
  --restart always \
  --network host \
  -v /opt/postal/config/Caddyfile:/etc/caddy/Caddyfile \
  -v /opt/postal/caddy-data:/data \
  caddy
```

---

## 3. Create a Postal Admin User

```bash
# Open the Postal management interface
postal make-user
```

Fill in:
- **First name / Last name** — e.g. `Anthony`, `Wille`
- **Email** — your email (for login)
- **Initial password** — save this securely

---

## 4. Create a Server / Organization

1. Open `https://mail.yourdomain.com` in a browser
2. Log in with the credentials from step 3
3. Create an **Organization** (name it e.g. `MyOrg`)
4. Inside the org, create a **Server** (name it e.g. `main`)
5. Copy the **server API key** from the server settings page

---

## 5. Generate SMTP Credentials

On the VPS, generate SMTP credentials for your server:

```bash
sudo postal make-credential -p <server-name> -t smtp
# Example: sudo postal make-credential -p main -t smtp
```

Output looks like:
```
Key ID:      12345
Key:         abc123def456...
SMTP Key:    abc123def456...
SMTP Secret: xyz789...
```

- **SMTP Username** = `abc123def456...@main` (the SMTP Key + `@` + server name)
- **SMTP Password** = `xyz789...` (the SMTP Secret)

---

## 6. Generate API Credentials (for HTTP API)

```bash
sudo postal make-credential -p <server-name> -t api
```

The `Key` value is your **API key** for HTTP API calls.

---

## 7. Add a Sending Domain in Postal

1. In the Postal web UI, go to your server → **Domains** → **Add Domain**
2. Enter your domain (e.g. `yourdomain.com`)
3. Click **Add Domain**

Postal will show DNS records you need to add (SPF, DKIM, DMARC).

---

## 8. Add DNS Records to Your Domain Provider

Go to your DNS provider (Cloudflare, Namecheap, etc.) and add these **TXT records**:

| Type | Name | Value |
|------|------|-------|
| TXT | `@` | `v=spf1 a mx include:mail.yourdomain.com ~all` |
| TXT | `dkim._domainkey` | (copy from Postal UI — unique per domain) |
| TXT | `_dmarc` | `v=DMARC1; p=quarantine; rua=mailto:dmarc@yourdomain.com` |

Also add:
| Type | Name | Value |
|------|------|-------|
| MX | `@` | `mail.yourdomain.com` |
| A | `mail` | `<VPS_IP>` |

DNS propagation can take a few minutes. In Postal, click **Check DNS** to verify.

---

## 9. Connect to Mailer-US

### A. In Settings → SMTP Settings

| Field | Value |
|-------|-------|
| Provider | **VPS (Postal)** |
| SMTP Host | `mail.yourdomain.com` |
| SMTP Port | `587` |
| SMTP Username | `{SMTP_Key}@{server_name}` (from step 5) |
| SMTP Password | `{SMTP_Secret}` (from step 5) |
| Postal HTTP API URL | `https://mail.yourdomain.com` |
| Is Active | ✅ |

Click **Test Connection** to verify.

### B. In Domains

**Option 1 — Add manually:**
- Click **Add Domain**
- Enter your domain name, sender email, etc.
- Set **SMTP Provider** to **VPS (Postal)**

**Option 2 — Import from VPS:**
- Click **Import from VPS**
- Enter `https://mail.yourdomain.com` as the URL
- Enter the API key from step 6
- Postal domains will be auto-discovered and imported

---

## 10. Verify Delivery

1. Go to **Domains** → click the **Test** button on your domain
2. Send a test to your own email
3. Check inbox. You should receive it within a few seconds.

You're now ready to send campaigns through your own Postal VPS.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Port 25 blocked by VPS provider | Contact support to unblock, or use port 587 for sending |
| DNS not propagating | Use `dig TXT yourdomain.com` to check; wait up to 48h |
| Emails landing in spam | Add DKIM + DMARC records; warm up the domain gradually |
| Postal service not starting | `sudo systemctl status postal` to check logs |
| "Relay access denied" | Ensure your SMTP credentials are correct and the IP isn't blocked |
