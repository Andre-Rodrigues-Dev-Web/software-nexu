function requireConfirmation(payload, message) {
  if (!payload || payload.confirmed !== true) {
    const error = new Error(message || "User confirmation is required.");
    error.statusCode = 400;
    throw error;
  }
}

function ensureArray(value, field) {
  if (!Array.isArray(value)) {
    const error = new Error(`${field} must be an array.`);
    error.statusCode = 400;
    throw error;
  }
}

function ensureObject(value, field) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    const error = new Error(`${field} must be an object.`);
    error.statusCode = 400;
    throw error;
  }
}

module.exports = {
  requireConfirmation,
  ensureArray,
  ensureObject
};
