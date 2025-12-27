import { Page } from 'playwright';
import { PlatformReview } from '@/types';
import { BaseScraper } from './base';

export class YelpScraper extends BaseScraper {
  platform: PlatformReview['platform'] = 'yelp';

  searchUrl(query: string, location: string): string {
    const searchQuery = encodeURIComponent(query);
    const searchLocation = encodeURIComponent(location);
    return `https://www.yelp.com/search?find_desc=${searchQuery}&find_loc=${searchLocation}`;
  }

  async parseResults(page: Page): Promise<PlatformReview | null> {
    try {
      // Wait for search results to load
      await page.waitForSelector('[data-testid="serp-ia-card"]', { timeout: 10000 }).catch(() => null);

      // Get the first result's rating
      const firstResult = await page.$('[data-testid="serp-ia-card"]');
      if (!firstResult) {
        return null;
      }

      // Click to go to the restaurant page for more accurate data
      const linkElement = await firstResult.$('a[href*="/biz/"]');
      if (linkElement) {
        const href = await linkElement.getAttribute('href');
        if (href) {
          await page.goto(`https://www.yelp.com${href}`, { waitUntil: 'domcontentloaded' });
          await page.waitForTimeout(2000);
        }
      }

      // Parse rating from the business page
      let rating: number | null = null;
      let reviewCount: number | null = null;

      // Try to get rating from aria-label on rating element
      const ratingElement = await page.$('[aria-label*="star rating"]');
      if (ratingElement) {
        const ariaLabel = await ratingElement.getAttribute('aria-label');
        const match = ariaLabel?.match(/(\d+\.?\d*)\s*star/i);
        if (match) {
          rating = parseFloat(match[1]);
        }
      }

      // Alternative: look for rating in structured data
      if (!rating) {
        const structuredData = await page.evaluate(() => {
          const scripts = document.querySelectorAll('script[type="application/ld+json"]');
          for (const script of scripts) {
            try {
              const data = JSON.parse(script.textContent || '');
              if (data.aggregateRating) {
                return data.aggregateRating;
              }
              // Handle array format
              if (Array.isArray(data)) {
                for (const item of data) {
                  if (item.aggregateRating) {
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
      }

      // Get review count from page
      if (!reviewCount) {
        const reviewElement = await page.$('a[href*="reviews"]');
        if (reviewElement) {
          const text = await reviewElement.textContent();
          const match = text?.replace(/,/g, '').match(/(\d+)\s*reviews?/i);
          if (match) {
            reviewCount = parseInt(match[1], 10);
          }
        }
      }

      // Alternative review count selector
      if (!reviewCount) {
        const countText = await page.evaluate(() => {
          const elements = document.querySelectorAll('span, a');
          for (const el of elements) {
            const text = el.textContent || '';
            if (text.match(/\d+\s*reviews?/i)) {
              return text;
            }
          }
          return null;
        });
        if (countText) {
          const match = countText.replace(/,/g, '').match(/(\d+)\s*reviews?/i);
          if (match) {
            reviewCount = parseInt(match[1], 10);
          }
        }
      }

      if (rating === null) {
        return null;
      }

      return {
        platform: 'yelp',
        rating,
        reviewCount: reviewCount || 0,
        url: page.url(),
        lastUpdated: new Date(),
      };
    } catch (error) {
      console.error('Yelp scraping error:', error);
      return null;
    }
  }
}
