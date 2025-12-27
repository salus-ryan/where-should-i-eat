import { Page } from 'playwright';
import { PlatformReview } from '@/types';
import { BaseScraper } from './base';

export class FoursquareScraper extends BaseScraper {
  platform: PlatformReview['platform'] = 'foursquare';

  searchUrl(query: string, location: string): string {
    const searchQuery = encodeURIComponent(`${query} ${location}`);
    return `https://foursquare.com/explore?mode=url&q=${searchQuery}`;
  }

  async parseResults(page: Page): Promise<PlatformReview | null> {
    try {
      // Wait for results to load
      await page.waitForSelector('[class*="venue"], [class*="Venue"]', { timeout: 10000 }).catch(() => null);

      // Try to find and click on first venue result
      const venueLink = await page.$('a[href*="/v/"]');
      if (venueLink) {
        const href = await venueLink.getAttribute('href');
        if (href) {
          const fullUrl = href.startsWith('http') ? href : `https://foursquare.com${href}`;
          await page.goto(fullUrl, { waitUntil: 'domcontentloaded' });
          await page.waitForTimeout(2000);
        }
      }

      let rating: number | null = null;
      let reviewCount: number | null = null;

      // Foursquare uses a 10-point scale, we need to convert to 5
      const ratingElement = await page.$('[class*="rating"], [class*="Rating"], [class*="score"], [class*="Score"]');
      if (ratingElement) {
        const text = await ratingElement.textContent();
        const match = text?.match(/(\d+\.?\d*)/);
        if (match) {
          const rawRating = parseFloat(match[1]);
          // Foursquare uses 10-point scale
          if (rawRating > 5) {
            rating = rawRating / 2; // Convert to 5-point scale
          } else {
            rating = rawRating;
          }
        }
      }

      // Try structured data
      if (!rating) {
        const structuredData = await page.evaluate(() => {
          const scripts = document.querySelectorAll('script[type="application/ld+json"]');
          for (const script of scripts) {
            try {
              const data = JSON.parse(script.textContent || '');
              if (data.aggregateRating) {
                return {
                  rating: data.aggregateRating.ratingValue,
                  count: data.aggregateRating.reviewCount,
                  bestRating: data.aggregateRating.bestRating || 10,
                };
              }
            } catch {
              continue;
            }
          }
          return null;
        });

        if (structuredData) {
          const rawRating = parseFloat(structuredData.rating);
          const bestRating = parseFloat(structuredData.bestRating);
          rating = (rawRating / bestRating) * 5; // Normalize to 5-point scale
          reviewCount = parseInt(structuredData.count, 10);
        }
      }

      // Get review/tip count
      if (!reviewCount) {
        const countText = await page.evaluate(() => {
          const elements = document.querySelectorAll('span, div');
          for (const el of elements) {
            const text = el.textContent || '';
            if (text.match(/\d+\s*(tips?|reviews?)/i)) {
              return text;
            }
          }
          return null;
        });
        if (countText) {
          const match = countText.replace(/,/g, '').match(/(\d+)\s*(tips?|reviews?)/i);
          if (match) {
            reviewCount = parseInt(match[1], 10);
          }
        }
      }

      if (rating === null) {
        return null;
      }

      return {
        platform: 'foursquare',
        rating: Math.round(rating * 100) / 100,
        reviewCount: reviewCount || 0,
        url: page.url(),
        lastUpdated: new Date(),
      };
    } catch (error) {
      console.error('Foursquare scraping error:', error);
      return null;
    }
  }
}
