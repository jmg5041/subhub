/**
 * Shared email building utilities.
 * Import emailHeader() wherever you build HTML emails so all emails
 * automatically pick up the logo from platform_settings.logoUrl.
 */

/**
 * Returns the blue header block for all SubHub emails.
 * If logoUrl is set (from platform_settings), renders the logo image.
 * Falls back to "SubHub" text so emails never look broken if the URL
 * is missing or slow to load.
 */
export function emailHeader(logoUrl?: string | null): string {
  const inner = logoUrl
    ? `<img src="${logoUrl}" alt="SubHub" style="height:40px;display:block;" />`
    : `<h1 style="color:white;margin:0;font-size:20px;">SubHub</h1>
       <p style="color:#bfdbfe;margin:4px 0 0;font-size:13px;">substitutes.us</p>`

  return `<div style="background:#2563eb;padding:20px 24px;">${inner}</div>`
}
