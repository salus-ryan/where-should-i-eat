/**
 * Fast API-based data fetching for multiple platforms
 * These use official APIs instead of slow Playwright scraping
 */

import { PlatformReview } from '@/types';
import { searchYelp } from './yelp';
import { searchFoursquare } from './foursquare';
import { searchTripAdvisor } from './tripadvisor';

export { searchYelp, searchYelpNearby } from './yelp';
export { searchFoursquare, searchFoursquareNearby } from './foursquare';
export { searchTripAdvisor } from './tripadvisor';

const API_TIMEOUT = 5000; // 5 second timeout per API call

/**
 * Wrap a promise with a timeout
 */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms))
  ]);
}

/**
 * Fetch reviews from multiple platforms in PARALLEL
 * Each API call has a timeout to prevent slow responses from blocking
 */
export async function fetchAllPlatformReviews(
  restaurantName: string,
  location: string
): Promise<PlatformReview[]> {
  // Run all API calls in parallel with timeouts
  const [yelpResult, foursquareResult, tripAdvisorResult] = await Promise.all([
    withTimeout(searchYelp(restaurantName, location), API_TIMEOUT),
    withTimeout(searchFoursquare(restaurantName, location), API_TIMEOUT),
    withTimeout(searchTripAdvisor(restaurantName, location), API_TIMEOUT),
  ]);

  const reviews: PlatformReview[] = [];
  
  if (yelpResult) reviews.push(yelpResult);
  if (foursquareResult) reviews.push(foursquareResult);
  if (tripAdvisorResult) reviews.push(tripAdvisorResult);

  return reviews;
}
