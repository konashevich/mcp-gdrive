import { authenticate } from "@google-cloud/local-auth";
import { google } from "googleapis";
import fs from "fs";
import path from "path";
import { debugLog } from "./log.js";

export const SCOPES = [
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/documents",
  "https://www.googleapis.com/auth/presentations",
  "https://www.googleapis.com/auth/spreadsheets",
];

function parseGrantedScopes(scopeValue: unknown): Set<string> {
  if (typeof scopeValue !== "string") {
    return new Set();
  }

  return new Set(
    scopeValue
      .split(/\s+/)
      .map((scope) => scope.trim())
      .filter(Boolean),
  );
}

function findMissingScopes(scopeValue: unknown): string[] {
  const grantedScopes = parseGrantedScopes(scopeValue);
  if (grantedScopes.size === 0) {
    return [];
  }

  return SCOPES.filter((scope) => !grantedScopes.has(scope));
}

// Get credentials directory from environment variable or use default
const CREDS_DIR =
  process.env.GDRIVE_CREDS_DIR ||
  path.join(path.dirname(new URL(import.meta.url).pathname), "../../../");


// Ensure the credentials directory exists
function ensureCredsDirectory() {
  try {
    fs.mkdirSync(CREDS_DIR, { recursive: true });
    debugLog(`Ensured credentials directory exists at: ${CREDS_DIR}`);
  } catch (error) {
    console.error(
      `Failed to create credentials directory: ${CREDS_DIR}`,
      error,
    );
    throw error;
  }
}

const credentialsPath = path.join(CREDS_DIR, ".gdrive-server-credentials.json");

async function authenticateWithTimeout(
  keyfilePath: string,
  SCOPES: string[],
  timeoutMs = 30000,
): Promise<any | null> {
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error("Authentication timed out")), timeoutMs),
  );

  const authPromise = authenticate({
    keyfilePath,
    scopes: SCOPES,
  });

  try {
    return await Promise.race([authPromise, timeoutPromise]);
  } catch (error) {
    console.error(error);
    return null;
  }
}

async function authenticateAndSaveCredentials() {
  debugLog("Launching auth flow…");
  debugLog("Using credentials path:", credentialsPath);

  const keyfilePath = path.join(CREDS_DIR, "gcp-oauth.keys.json");
  debugLog("Using keyfile path:", keyfilePath);

  // Basic validations to give clearer feedback instead of module not found errors
  if (!process.env.CLIENT_ID || !process.env.CLIENT_SECRET) {
    console.error(
      "ERROR: CLIENT_ID or CLIENT_SECRET not set. Populate them in your environment or .env file before running the server.",
    );
    throw new Error("Missing CLIENT_ID/CLIENT_SECRET environment variables");
  }

  if (!fs.existsSync(keyfilePath)) {
    console.error(
      `ERROR: OAuth key file not found at ${keyfilePath}. Place your downloaded Desktop OAuth client JSON here and rename it to gcp-oauth.keys.json.`,
    );
    throw new Error("Missing gcp-oauth.keys.json key file");
  }

  const auth = await authenticateWithTimeout(keyfilePath, SCOPES);
  if (!auth) {
    throw new Error("Authentication timed out or was cancelled");
  }

  if (auth) {
    const newAuth = new google.auth.OAuth2();
    newAuth.setCredentials(auth.credentials);
  }

  try {
    const { credentials } = await auth.refreshAccessToken();
    debugLog("Received new credentials with scopes:", credentials.scope);

    // Ensure directory exists before saving
    ensureCredsDirectory();

    fs.writeFileSync(credentialsPath, JSON.stringify(credentials, null, 2));
    debugLog(
      "Credentials saved successfully with refresh token to:",
      credentialsPath,
    );
    auth.setCredentials(credentials);
    return auth;
  } catch (error) {
    console.error("Error refreshing token during initial auth:", error);
    return auth;
  }
}

// Try to load credentials without prompting for auth
export async function loadCredentialsQuietly() {
  debugLog("Attempting to load credentials from:", credentialsPath);

  const oauth2Client = new google.auth.OAuth2(
    process.env.CLIENT_ID,
    process.env.CLIENT_SECRET,
  );

  if (!fs.existsSync(credentialsPath)) {
    debugLog("No credentials file found");
    return null;
  }

  try {
    const savedCreds = JSON.parse(fs.readFileSync(credentialsPath, "utf-8"));
    debugLog("Loaded existing credentials with scopes:", savedCreds.scope);
    const missingScopes = findMissingScopes(savedCreds.scope);
    if (missingScopes.length > 0) {
      console.error(
        "Saved credentials are missing required scopes; reauthentication required:",
        missingScopes,
      );
      return null;
    }

    oauth2Client.setCredentials(savedCreds);

    const expiryDate = new Date(savedCreds.expiry_date);
    const now = new Date();
    const fiveMinutes = 5 * 60 * 1000;
    const timeToExpiry = expiryDate.getTime() - now.getTime();

    debugLog("Token expiry status:", {
      expiryDate: expiryDate.toISOString(),
      timeToExpiryMinutes: Math.floor(timeToExpiry / (60 * 1000)),
      hasRefreshToken: !!savedCreds.refresh_token,
    });

    if (timeToExpiry < fiveMinutes && savedCreds.refresh_token) {
      debugLog("Attempting to refresh token using refresh_token");
      try {
        const response = await oauth2Client.refreshAccessToken();
        const newCreds = response.credentials;
        ensureCredsDirectory();
        fs.writeFileSync(credentialsPath, JSON.stringify(newCreds, null, 2));
        const refreshedMissingScopes = findMissingScopes(newCreds.scope);
        if (refreshedMissingScopes.length > 0) {
          console.error(
            "Refreshed credentials are still missing required scopes; reauthentication required:",
            refreshedMissingScopes,
          );
          return null;
        }

        oauth2Client.setCredentials(newCreds);
        debugLog("Token refreshed and saved successfully");
      } catch (error) {
        console.error("Failed to refresh token:", error);
        return null;
      }
    }

    return oauth2Client;
  } catch (error) {
    console.error("Error loading credentials:", error);
    return null;
  }
}

// Get valid credentials, prompting for auth if necessary
export async function getValidCredentials(forceAuth = false) {
  if (!forceAuth) {
    const quietAuth = await loadCredentialsQuietly();
    if (quietAuth) {
      return quietAuth;
    }
  }

  return await authenticateAndSaveCredentials();
}

// Background refresh that never prompts for auth
export function setupTokenRefresh() {
  debugLog("Setting up automatic token refresh interval (45 minutes)");
  return setInterval(
    async () => {
      try {
        debugLog("Running scheduled token refresh check");
        const auth = await loadCredentialsQuietly();
        if (auth) {
          google.options({ auth });
          debugLog("Completed scheduled token refresh");
        } else {
          debugLog("Skipping token refresh - no valid credentials");
        }
      } catch (error) {
        console.error("Error in automatic token refresh:", error);
      }
    },
    45 * 60 * 1000,
  );
}
