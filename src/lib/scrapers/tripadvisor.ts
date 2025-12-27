import { Page } from 'playwright';
import { PlatformReview } from '@/types';
import { BaseScraper } from './base';

export class TripAdvisorScraper extends BaseScraper {
  platform: PlatformReview['platform'] = 'tripadvisor';

  searchUrl(query: string, location: string): string {
    const searchQuery = encodeURIComponent(`${query} ${location}`);
    return `https://www.tripadvisor.com/Search?q=${searchQuery}&searchSessionId=&sid=&blockRedirect=true&ssrc=e&rf=1`;
  }

  async parseResults(page: Page): Promise<PlatformReview | null> {
    try {
      // Wait for search results
      await page.waitForSelector('[data-test-target="restaurants-list"]', { timeout: 10000 }).catch(() => null);

      // Try to find restaurant results
      const restaurantLink = await page.$('a[href*="/Restaurant_Review"]');
      if (restaurantLink) {
        const href = await restaurantLink.getAttribute('href');
        if (href) {
          const fullUrl = href.startsWith('http') ? href : `https://www.tripadvisor.com${href}`;
          await page.goto(fullUrl, { waitUntil: 'domcontentloaded' });
          await page.waitForTimeout(2000);
        }
      }

      let rating: number | null = null;
      let reviewCount: number | null = null;

      // Try structured data first (most reliable)
      const structuredData = await page.evaluate(() => {
        const scripts = document.querySelectorAll('script[type="application/ld+json"]');
        for (const script of scripts) {
          try {
            const data = JSON.parse(script.textContent || '');
            if (data['@type'] === 'Restaurant' && data.aggregateRating) {
              return data.aggregateRating;
            }
            // Handle array format
            if (Array.isArray(data)) {
              for (const item of data) {
                if (item['@type'] === 'Restaurant' && item.aggregateRating) {
                  return item.aggregateRating;
                }
              }
            }
          } catch {
            continue;
          }
        }
        return null;
      });

      if (structuredData) {
        rating = parseFloat(structuredData.ratingValue);
        reviewCount = parseInt(structuredData.reviewCount, 10);
      }

      // Fallback: parse from page elements
      if (!rating) {
        // TripAdvisor uses bubble ratings (1-5 scale shown as bubbles)
        const ratingElement = await page.$('[data-test-target="review-rating"] svg title');
        if (ratingElement) {
          const text = await ratingElement.textContent();
          const match = text?.match(/(\d+\.?\d*)\s*of\s*5/i);
          if (match) {
            rating = parseFloat(match[1]);
          }
        }
      }

      // Alternative rating selector
      if (!rating) {
        const ratingText = await page.evaluate(() => {
          // Look for rating in various places
          const ratingEl = document.querySelector('[class*="rating"], [class*="Rating"]');
          if (ratingEl) {
            const text = ratingEl.textContent || '';
            const ariaLabel = ratingEl.getAttribute('aria-label') || '';
            return text + ' ' + ariaLabel;
          }
          return null;
        });
        if (ratingText) {
          const match = ratingText.match(/(\d+\.?\d*)/);
          if (match) {
            const val = parseFloat(match[1]);
            if (val <= 5) {
              rating = val;
            }
          }
        }
      }

      // Get review count
      if (!reviewCount) {
        const reviewText = await page.evaluate(() => {
          const elements = document.querySelectorAll('a[href*="#REVIEWS"], span, div');
          for (const el of elements) {
            const text = el.textContent || '';
            if (text.match(/\d+\s*reviews?/i)) {
              return text;
            }
          }
          return null;
        });
        if (reviewText) {
          const match = reviewText.replace(/,/g, '').match(/(\d+)\s*reviews?/i);
          if (match) {
            reviewCount = parseInt(match[1], 10);
          }
        }
      }

      if (rating === null) {
        return null;
      }

      return {
        platform: 'tripadvisor',
        rating,
        reviewCount: reviewCount || 0,
        url: page.url(),
        lastUpdated: new Date(),
      };
    } catch (error) {
      console.error('TripAdvisor scraping error:', error);
      return null;
    }
  }
}
