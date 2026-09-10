// src/middleware/trial.js
// ─────────────────────────────────────────────────────────────
// Trial / License system — CURRENTLY DISABLED
// Running as fully licensed with no expiry.
// ─────────────────────────────────────────────────────────────
"use strict";

/**
 * checkTrial — pass-through middleware (trial disabled).
 */
function checkTrial(req, res, next) {
  return next();
}

/**
 * getTrialStatus — reports fully licensed for /health endpoint.
 */
function getTrialStatus() {
  return { mode: "licensed", enabled: false };
}

/**
 * activateLicense — no-op (trial disabled).
 */
function activateLicense(key) {
  return { valid: true, label: "licensed", expiredOn: null, daysRemaining: null };
}

const LICENSE_KEYS = {};

module.exports = { checkTrial, getTrialStatus, activateLicense, LICENSE_KEYS };
