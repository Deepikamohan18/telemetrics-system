export const sanitizeData = (data) => {
  return JSON.stringify(data).replace(/</g, "&lt;");
};

// Mock encryption (for demo)
export const encryptData = (data) => {
  return btoa(data);
};