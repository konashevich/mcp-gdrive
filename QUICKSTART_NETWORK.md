# Quick Start - Network Setup

This guide will get your MCP Google Drive server running on your network in minutes.

## Prerequisites

1. Node.js installed (v16 or higher)
2. Google Cloud OAuth credentials (see main README.md for setup)
3. Your OAuth credentials JSON file downloaded

## Quick Setup

Run the automated setup script:

```bash
./setup-network-server.sh
```

The script will:
1. Create `.env` configuration file
2. Help you configure OAuth credentials
3. Generate a secure API key
4. Authenticate with Google
5. Install as a systemd service (optional)

## Manual Setup (Alternative)

If you prefer manual setup:

### 1. Configure Environment

```bash
# Copy example configuration
cp .env.example .env

# Edit configuration
nano .env
```

Set these values:
- `GDRIVE_CREDS_DIR`: `/home/yourusername/.config/mcp-gdrive`
- `CLIENT_ID`: Your Google OAuth Client ID
- `CLIENT_SECRET`: Your Google OAuth Client Secret
- `MCP_API_KEY`: Generate with `openssl rand -hex 32`

### 2. Place OAuth Credentials

Download your OAuth client credentials from Google Cloud Console and save as:
```
~/.config/mcp-gdrive/gcp-oauth.keys.json
```

### 3. Authenticate

```bash
npm run start:http
```

Follow the browser prompt to authenticate with Google. After authentication, press Ctrl+C.

### 4. Install as Service

```bash
# Edit service file with your username
nano mcp-gdrive.service

# Install
sudo cp mcp-gdrive.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable mcp-gdrive
sudo systemctl start mcp-gdrive
```

## Verify Installation

Check service status:
```bash
sudo systemctl status mcp-gdrive
```

Test from any device on your network:
```bash
curl -H "X-API-Key: YOUR_API_KEY" http://YOUR_SERVER_IP:3000/health
```

Expected response:
```json
{"status":"ok","service":"mcp-gdrive"}
```

## Connect from Other Devices

Use the SSE endpoint with your MCP client:

**URL**: `http://YOUR_SERVER_IP:3000/sse`

**Required Header**: `X-API-Key: YOUR_API_KEY`

## Troubleshooting

### Can't connect from other devices?

Check firewall:
```bash
# Allow port 3000
sudo ufw allow 3000/tcp
```

### Service won't start?

Check logs:
```bash
sudo journalctl -u mcp-gdrive -n 50
```

### Need to re-authenticate?

```bash
rm ~/.config/mcp-gdrive/token.json
sudo systemctl restart mcp-gdrive
# Then check logs and follow auth URL
```

## Next Steps

See [NETWORK_SETUP.md](NETWORK_SETUP.md) for:
- Detailed configuration options
- Security best practices
- Advanced networking setup
- HTTPS configuration
- Client configuration examples

## Support

For issues and questions, see the main [README.md](README.md) or check the project repository.
