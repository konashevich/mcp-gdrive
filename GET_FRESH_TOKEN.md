# HOW TO GET FRESH OAUTH TOKEN

## The Problem
The OAuth token you copied from Windows has expired and cannot be refreshed.
You need to generate a FRESH token from your Windows machine.

## SOLUTION: Get Fresh Token from Windows

### On Your Windows Machine:

1. Open PowerShell and navigate to your MCP GDrive directory:
   ```powershell
   cd c:\Users\akona\OneDrive\Dev\Google_Drive_MCP\mcp-gdrive
   ```

2. Delete the old token:
   ```powershell
   Remove-Item .gdrive-server-credentials.json -ErrorAction SilentlyContinue
   ```

3. Run the server to trigger fresh authentication:
   ```powershell
   npm run build
   node dist\index.js
   ```

4. A browser window will open - sign in with Google and authorize

5. After successful authentication, find the NEW token file:
   ```powershell
   Get-Content .gdrive-server-credentials.json
   ```

6. Copy this ENTIRE FILE content

### Back on Linux Server:

7. Create the file with the NEW token:
   ```bash
   nano /home/pi/.config/mcp-gdrive/.gdrive-server-credentials.json
   ```
   
8. Paste the content, save (Ctrl+X, Y, Enter)

9. Restart the service:
   ```bash
   sudo systemctl restart mcp-gdrive
   sudo systemctl status mcp-gdrive
   ```

10. Test it:
    ```bash
    curl http://localhost:9547/health
    ```

## Alternative: Use SCP to Copy

From Windows PowerShell (after step 5 above):
```powershell
scp .gdrive-server-credentials.json pi@192.168.1.114:/home/pi/.config/mcp-gdrive/
```

Then restart the service on Linux.

## Why This Happens

OAuth refresh tokens can expire for several reasons:
- Token was revoked in Google Account settings
- Token exceeded its maximum lifetime
- Security policy changes
- App was de-authorized

A fresh authentication creates a new, valid refresh token.
