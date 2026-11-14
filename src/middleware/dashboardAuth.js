import { config } from "../config.js";
import { logger } from "../services/logger.js";

const { username, password } = config.dashboard;
const configured = Boolean(username && password);

if (!configured) {
  logger.warn(
    "[dashboard-auth] DASHBOARD_USERNAME / DASHBOARD_PASSWORD are not set — " +
      "the owner dashboard and its API are UNPROTECTED. Anyone with the URL " +
      "can read customer conversations and send messages as the business. " +
      "Set both env vars before deploying anywhere reachable from the internet."
  );
}

function timingSafeEqual(a, b) {
  // Simple constant-time-ish comparison without pulling in the crypto module
  // for two short strings; good enough to avoid trivial timing leaks here.
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

export function dashboardAuth(req, res, next) {
  if (!configured) {
    // No credentials set — fail open in local/dev so the dashboard is usable
    // out of the box, but this is logged loudly above on startup.
    return next();
  }

  const header = req.headers.authorization || "";
  const [scheme, encoded] = header.split(" ");

  if (scheme === "Basic" && encoded) {
    const decoded = Buffer.from(encoded, "base64").toString("utf8");
    const separatorIndex = decoded.indexOf(":");
    const suppliedUser = decoded.slice(0, separatorIndex);
    const suppliedPass = decoded.slice(separatorIndex + 1);

    if (timingSafeEqual(suppliedUser, username) && timingSafeEqual(suppliedPass, password)) {
      return next();
    }
  }

  res.set("WWW-Authenticate", 'Basic realm="AI Secretary Dashboard"');
  return res.status(401).send("Authentication required.");
}
