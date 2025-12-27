import { PlatformReview, ScrapingResult } from '@/types';
import { GoogleScraper } from './google';
import { YelpScraper } from './yelp';
import { TripAdvisorScraper } from './tripadvisor';
import { FoursquareScraper } from './foursquare';
import { BaseScraper } from './base';

export { GoogleScraper, YelpScraper, TripAdvisorScraper, FoursquareScraper };

export async function scrapeAllPlatforms(
  query: string,
  location: string,
  platforms: PlatformReview['platform'][] = ['google', 'yelp', 'tripadvisor', 'foursquare']
): Promise<{ results: PlatformReview[]; errors: Record<string, string> }> {
  const scraperMap: Record<string, BaseScraper> = {
    google: new GoogleScraper(),
    yelp: new YelpScraper(),
    tripadvisor: new TripAdvisorScraper(),
    foursquare: new FoursquareScraper(),
  };

  const results: PlatformReview[] = [];
  const errors: Record<string, string> = {};

  // Run scrapers in parallel for speed
  const scrapePromises = platforms.map(async (platform) => {
    const scraper = scraperMap[platform];
    if (!scraper) {
      errors[platform] = `Unknown platform: ${platform}`;
      return;
    }

    try {
      const result: ScrapingResult = await scraper.scrape(query, location);
      if (result.success && result.data) {
        results.push(result.data);
      } else {
        errors[platform] = result.error || 'Unknown error';
      }
    } catch (error) {
      errors[platform] = error instanceof Error ? error.message : 'Unknown error';
    } finally {
      await scraper.close();
    }
  });

  await Promise.all(scrapePromises);

  return { results, errors };
}
