# 🚀 Your MCP Google Drive Server is Ready!

## ✅ Installation Complete

Your MCP Google Drive server has been successfully configured for network access across your home network.

### Your Server Details
- **Server IP**: `192.168.1.114`
- **Default Port**: `3000`
- **Base URL**: `http://192.168.1.114:3000`

## 🎯 Next Steps

### Step 1: Run the Setup Script

The easiest way to get started:

```bash
cd /mnt/merged_ssd/mcp-gdrive
./setup-network-server.sh
```

This interactive script will:
1. ✅ Create and configure your `.env` file
2. ✅ Help you set up OAuth credentials
3. ✅ Generate a secure API key
4. ✅ Authenticate with Google Drive
5. ✅ Optionally install as a system service

### Step 2: Manual Setup (Alternative)

If you prefer manual setup:

1. **Create configuration file**:
   ```bash
   cp .env.example .env
   nano .env
   ```

2. **Configure these required values**:
   - `GDRIVE_CREDS_DIR`: Path to store credentials (e.g., `/home/pi/.config/mcp-gdrive`)
   - `CLIENT_ID`: Your Google OAuth Client ID
   - `CLIENT_SECRET`: Your Google OAuth Client Secret
   - `MCP_API_KEY`: Generate with: `openssl rand -hex 32`

3. **Place OAuth credentials file**:
   - Download from Google Cloud Console
   - Save as: `$GDRIVE_CREDS_DIR/gcp-oauth.keys.json`

4. **Initial authentication**:
   ```bash
   npm run start:http
   ```
   Follow the browser prompts, then Ctrl+C after authentication.

5. **Install as service** (optional but recommended):
   ```bash
   # Edit service file with your username
   sudo nano mcp-gdrive.service
   
   # Install
   sudo cp mcp-gdrive.service /etc/systemd/system/
   sudo systemctl daemon-reload
   sudo systemctl enable mcp-gdrive
   sudo systemctl start mcp-gdrive
   ```

## 🧪 Test Your Installation

### From the Server
```bash
curl http://localhost:3000/health
```

### From Any Device on Your Network
```bash
curl -H "X-API-Key: YOUR_API_KEY" http://192.168.1.114:3000/health
```

**Expected response:**
```json
{"status":"ok","service":"mcp-gdrive"}
```

## 📡 Connect Clients

### Endpoint Information
- **SSE Endpoint**: `http://192.168.1.114:3000/sse`
- **Authentication**: Include header `X-API-Key: YOUR_API_KEY`

### Example Client Configuration
```json
{
  "mcpServers": {
    "gdrive": {
      "url": "http://192.168.1.114:3000/sse",
      "transport": "sse",
      "headers": {
        "X-API-Key": "your-api-key-here"
      }
    }
  }
}
```

## 🔧 Service Management

### Control the Service
```bash
sudo systemctl start mcp-gdrive      # Start
sudo systemctl stop mcp-gdrive       # Stop
sudo systemctl restart mcp-gdrive    # Restart
sudo systemctl status mcp-gdrive     # Check status
```

### View Logs
```bash
sudo journalctl -u mcp-gdrive -f           # Follow logs in real-time
sudo journalctl -u mcp-gdrive -n 100       # Last 100 lines
```

### Manual Start (Testing)
```bash
npm run start:http
```

## 🔐 Security Notes

### Firewall Configuration

**Option 1: Local Network Only (Recommended)**
```bash
# Allow only from your home network
# Adjust network range as needed (e.g., 192.168.1.0/24)
sudo ufw allow from 192.168.1.0/24 to any port 3000
sudo ufw enable
```

**Option 2: Allow All (Less Secure)**
```bash
sudo ufw allow 3000/tcp
sudo ufw enable
```

### API Key
- Always set a strong `MCP_API_KEY` in your `.env` file
- Generate with: `openssl rand -hex 32`
- Never share your API key publicly
- Include in all client requests

## 📚 Documentation

- **Quick Start**: [`QUICKSTART_NETWORK.md`](QUICKSTART_NETWORK.md)
- **Detailed Setup**: [`NETWORK_SETUP.md`](NETWORK_SETUP.md)
- **Complete Summary**: [`INSTALLATION_SUMMARY.md`](INSTALLATION_SUMMARY.md)
- **Original README**: [`README.md`](README.md)

## 🐛 Troubleshooting

### Service Won't Start
```bash
# Check what's wrong
sudo journalctl -u mcp-gdrive -n 50

# Try manual start to see errors
cd /mnt/merged_ssd/mcp-gdrive
npm run start:http
```

### Can't Connect from Other Devices
1. Check firewall: `sudo ufw status`
2. Verify server is running: `sudo systemctl status mcp-gdrive`
3. Test locally first: `curl http://localhost:3000/health`
4. Check IP is correct: `hostname -I`

### Port Already in Use
```bash
# Find what's using it
sudo lsof -i :3000

# Change port in .env
echo "MCP_PORT=3001" >> .env
sudo systemctl restart mcp-gdrive
```

### Need to Re-authenticate
```bash
# Remove old token
rm ~/.config/mcp-gdrive/token.json  # Adjust path

# Restart service (will trigger auth flow)
sudo systemctl restart mcp-gdrive

# Check logs for auth URL
sudo journalctl -u mcp-gdrive -f
```

## 🎉 What's Working Now

✅ MCP server compiled and built
✅ Network mode with HTTP/SSE transport
✅ Multiple simultaneous client support
✅ API key authentication
✅ CORS enabled for cross-origin requests
✅ Systemd service configuration ready
✅ Automatic setup script
✅ Comprehensive documentation

## 🚦 Quick Status Check

```bash
# Is the service running?
sudo systemctl is-active mcp-gdrive

# What's the current status?
sudo systemctl status mcp-gdrive

# Any recent errors?
sudo journalctl -u mcp-gdrive --since "5 minutes ago"

# Test the endpoint
curl http://192.168.1.114:3000/health
```

## 📞 Support

If you need help:
1. Check the logs: `sudo journalctl -u mcp-gdrive -f`
2. Review documentation in this directory
3. Test with manual start: `npm run start:http`
4. Verify `.env` configuration

## 🔄 What's Different from Before

| Before | Now |
|--------|-----|
| Local stdio only | Network HTTP/SSE |
| Single client | Multiple clients |
| Manual start | Auto-start service |
| No authentication | API key auth |
| Local machine only | Entire home network |

The original stdio mode is still available with `npm run start:stdio` if needed!

---

## Ready to Go? 🎊

Run the setup script to get started:

```bash
./setup-network-server.sh
```

Or follow the manual steps above. Your server will be available at:

**`http://192.168.1.114:3000`**

Enjoy your network-accessible MCP Google Drive server! 🚀
