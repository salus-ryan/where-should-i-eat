import { Page } from 'playwright';
import { PlatformReview } from '@/types';
import { BaseScraper } from './base';

export class GoogleScraper extends BaseScraper {
  platform: PlatformReview['platform'] = 'google';

  searchUrl(query: string, location: string): string {
    const searchQuery = encodeURIComponent(`${query} ${location} restaurant`);
    return `https://www.google.com/search?q=${searchQuery}`;
  }

  async parseResults(page: Page): Promise<PlatformReview | null> {
    try {
      // Google shows ratings in the knowledge panel or local results
      // Look for rating spans with aria-label containing rating info
      const ratingSelectors = [
        '[data-attrid="kc:/local:lu attribute list"] span[aria-label*="rating"]',
        '.Aq14fc', // Rating value
        'span[aria-label*="Rated"]',
        '.yi40Hd', // Star rating container
      ];

      let rating: number | null = null;
      let reviewCount: number | null = null;

      // Try to find rating from various Google result formats
      for (const selector of ratingSelectors) {
        const element = await page.$(selector);
        if (element) {
          const text = await element.textContent();
          const ariaLabel = await element.getAttribute('aria-label');
          
          // Parse rating from text like "4.5" or aria-label like "Rated 4.5 out of 5"
          const ratingMatch = (text || ariaLabel || '').match(/(\d+\.?\d*)/);
          if (ratingMatch) {
            rating = parseFloat(ratingMatch[1]);
            if (rating > 5) rating = null; // Invalid rating
            break;
          }
        }
      }

      // Look for review count
      const reviewSelectors = [
        '[data-attrid="kc:/local:lu attribute list"] span:has-text("reviews")',
        '.hqzQac span',
        'span:has-text("Google reviews")',
        'a[href*="reviews"]',
      ];

      for (const selector of reviewSelectors) {
        try {
          const element = await page.$(selector);
          if (element) {
            const text = await element.textContent();
            // Parse review count from text like "(1,234 reviews)" or "1,234 reviews"
            const countMatch = (text || '').replace(/,/g, '').match(/(\d+)\s*(?:reviews?|Google reviews?)/i);
            if (countMatch) {
              reviewCount = parseInt(countMatch[1], 10);
              break;
            }
          }
        } catch {
          continue;
        }
      }

      // Alternative: try to get from structured data
      if (!rating || !reviewCount) {
        const scriptContent = await page.evaluate(() => {
          const scripts = document.querySelectorAll('script[type="application/ld+json"]');
          for (const script of scripts) {
            try {
              const data = JSON.parse(script.textContent || '');
              if (data.aggregateRating) {
                return data.aggregateRating;
              }
            } catch {
              continue;
            }
          }
          return null;
        });

        if (scriptContent) {
          rating = rating || parseFloat(scriptContent.ratingValue);
          reviewCount = reviewCount || parseInt(scriptContent.reviewCount, 10);
        }
      }

      if (rating === null) {
        return null;
      }

      return {
        platform: 'google',
        rating,
        reviewCount: reviewCount || 0,
        lastUpdated: new Date(),
      };
    } catch (error) {
      console.error('Google scraping error:', error);
      return null;
    }
  }
}
