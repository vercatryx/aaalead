/**
 * Get the API base URL for making requests
 * In development: uses environment variable or defaults to localhost:3001
 * In production: uses empty string for relative paths (same origin)
 */
export const getApiUrl = (): string => {
  // Check for environment variable first
  if (process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL;
  }
  
  // In development, default to localhost:3001 (API server)
  // In production, use empty string for relative paths
  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:3001';
  }
  
  // Production: use relative paths (server serves from same origin)
  return '';
};

/**
 * Get the full URL for a template file
 * In development: React dev server serves files from public/ at root, so use relative path
 * In production: server serves from same origin, so use relative path
 * @param templatePath - Path like '/templates/XHRTEMP.pdf'
 * @returns Full URL to fetch the template (or array of URLs to try)
 */
export const getTemplateUrl = (templatePath: string): string[] => {
  // In Create React App, files in public/ are served at root by dev server
  // So /templates/XHRTEMP.pdf works directly from React dev server
  // Try relative path first (works with React dev server and in production)
  const urls: string[] = [templatePath];
  
  // Also try API server as fallback (in case Express server is serving them)
  const apiUrl = getApiUrl();
  if (apiUrl) {
    const filename = templatePath.replace('/templates/', '');
    urls.push(`${apiUrl}/templates/${encodeURIComponent(filename)}`);
  }
  
  return urls;
};
