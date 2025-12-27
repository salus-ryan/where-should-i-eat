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

// Simple delay helper
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Track last Yelp request time to avoid rate limits
let lastYelpRequest = 0;
const YELP_MIN_INTERVAL = 200; // 200ms between requests

/**
 * Fetch reviews from multiple platforms using APIs
 * Includes rate limiting for Yelp API
 */
export async function fetchAllPlatformReviews(
  restaurantName: string,
  location: string
): Promise<PlatformReview[]> {
  const reviews: PlatformReview[] = [];
  
  // Yelp with rate limiting
  const now = Date.now();
  const timeSinceLastYelp = now - lastYelpRequest;
  if (timeSinceLastYelp < YELP_MIN_INTERVAL) {
    await delay(YELP_MIN_INTERVAL - timeSinceLastYelp);
  }
  lastYelpRequest = Date.now();
  
  const yelpResult = await searchYelp(restaurantName, location);
  if (yelpResult) {
    reviews.push(yelpResult);
  }
  
  // Foursquare
  const foursquareResult = await searchFoursquare(restaurantName, location);
  if (foursquareResult) {
    reviews.push(foursquareResult);
  }

  // TripAdvisor
  const tripAdvisorResult = await searchTripAdvisor(restaurantName, location);
  if (tripAdvisorResult) {
    reviews.push(tripAdvisorResult);
  }

  return reviews;
}
