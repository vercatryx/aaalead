/**
 * Get the API base URL for making requests
 * In Next.js, API routes are served from the same origin
 */
export const getApiUrl = (): string => {
  // Check for environment variable first
  if (typeof window !== 'undefined' && (window as any).NEXT_PUBLIC_API_URL) {
    return (window as any).NEXT_PUBLIC_API_URL;
  }
  
  // In Next.js, API routes are at /api, so use relative paths
  return '';
};

/**
 * Get the full URL for a template file
 * In Next.js, files in public/ are served at root, so use relative path
 * @param templatePath - Path like '/templates/XHRTEMP.pdf'
 * @returns Full URL to fetch the template (or array of URLs to try)
 */
export const getTemplateUrl = (templatePath: string): string[] => {
  // In Next.js, files in public/ are served at root
  // So /templates/XHRTEMP.pdf works directly
  const urls: string[] = [templatePath];
  
  return urls;
};
