/**
 * OpenTable integration via web search
 * OpenTable doesn't have a public API, so we use their search endpoint
 * 
 * Note: This is a best-effort integration without official API access
 */

import { PlatformReview } from '@/types';

/**
 * Search OpenTable for a restaurant
 * Returns null as OpenTable requires partner API access
 */
export async function searchOpenTable(name: string, location: string): Promise<PlatformReview | null> {
  // OpenTable requires partner API access which isn't publicly available
  // This is a placeholder for future integration
  return null;
}
