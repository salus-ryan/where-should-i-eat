import { Restaurant } from '@/types';

export interface RankedRestaurant extends Restaurant {
  distanceKm: number;
  travelTimeMin: number;
  isOpen: boolean;
  openUntil?: string;
  valueScore: number; // Combined score factoring quality vs time
  isExceptional: boolean; // Michelin-level quality worth extra travel
}

export interface RankingConfig {
  maxTravelTimeMin: number; // Default 20
  userLat: number;
  userLon: number;
  currentTime: Date;
  exceptionalThreshold: number; // Rating threshold to allow exceeding travel time (default 4.8)
  exceptionalReviewMin: number; // Min reviews to be considered exceptional (default 500)
}

/**
 * Calculate a "value score" that balances quality against travel time
 * 
 * Philosophy: Your time is valuable. A 4.5 star place 5 min away is often
 * better than a 4.7 star place 20 min away. But a true exceptional place
 * (Michelin-level, 4.8+ with lots of reviews) might be worth the trip.
 * 
 * Formula: valueScore = rating * timeFactor
 * Where timeFactor decreases as travel time increases
 */
export function calculateValueScore(
  rating: number,
  travelTimeMin: number,
  maxTravelTimeMin: number,
  isExceptional: boolean
): number {
  // Time penalty: closer = better
  // At 0 min: factor = 1.0
  // At maxTravelTime: factor = 0.7
  // Beyond maxTravelTime: factor drops more steeply (unless exceptional)
  
  let timeFactor: number;
  
  if (travelTimeMin <= maxTravelTimeMin) {
    // Linear decay within acceptable range
    timeFactor = 1 - (travelTimeMin / maxTravelTimeMin) * 0.3;
  } else if (isExceptional) {
    // Exceptional places get gentler penalty beyond threshold
    const overtime = travelTimeMin - maxTravelTimeMin;
    timeFactor = 0.7 - (overtime / maxTravelTimeMin) * 0.1;
  } else {
    // Non-exceptional places get steep penalty beyond threshold
    const overtime = travelTimeMin - maxTravelTimeMin;
    timeFactor = 0.7 - (overtime / maxTravelTimeMin) * 0.4;
  }
  
  // Ensure timeFactor doesn't go below 0.3
  timeFactor = Math.max(0.3, timeFactor);
  
  // Exceptional bonus: add 0.2 to rating for truly special places
  const effectiveRating = isExceptional ? rating + 0.2 : rating;
  
  return Math.round(effectiveRating * timeFactor * 100) / 100;
}

/**
 * Determine if a restaurant is "exceptional" - worth extra travel
 * 
 * Criteria:
 * - Rating >= threshold (default 4.8)
 * - Sufficient reviews to trust the rating (default 500+)
 * - OR has special indicators (Michelin, James Beard, etc.)
 */
export function isExceptionalRestaurant(
  restaurant: Restaurant,
  threshold: number = 4.8,
  minReviews: number = 500
): boolean {
  const totalReviews = restaurant.reviews.reduce((sum, r) => sum + r.reviewCount, 0);
  
  // High rating with sufficient reviews
  if (restaurant.aggregatedScore >= threshold && totalReviews >= minReviews) {
    return true;
  }
  
  // Very high rating (4.9+) with moderate reviews
  if (restaurant.aggregatedScore >= 4.9 && totalReviews >= 200) {
    return true;
  }
  
  // Check for special indicators in name/cuisine (would be enhanced with real data)
  const specialIndicators = ['michelin', 'james beard', 'award', 'starred'];
  const nameLower = restaurant.name.toLowerCase();
  if (specialIndicators.some(ind => nameLower.includes(ind))) {
    return true;
  }
  
  return false;
}

/**
 * Check if a restaurant is currently open
 * This is a simplified version - real implementation would use Google Places API
 * or scrape hours from the restaurant pages
 */
export function checkIfOpen(
  hours: string[] | undefined,
  currentTime: Date
): { isOpen: boolean; openUntil?: string } {
  // If we don't have hours data, assume open (will be filtered by real data later)
  if (!hours || hours.length === 0) {
    return { isOpen: true };
  }
  
  const dayOfWeek = currentTime.getDay(); // 0 = Sunday
  const currentHour = currentTime.getHours();
  const currentMinute = currentTime.getMinutes();
  const currentTimeNum = currentHour * 60 + currentMinute;
  
  // Parse hours for today (format expected: "Mon: 11:00 AM - 10:00 PM")
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const todayHours = hours.find(h => h.startsWith(dayNames[dayOfWeek]));
  
  if (!todayHours) {
    return { isOpen: true }; // Assume open if no data for today
  }
  
  if (todayHours.toLowerCase().includes('closed')) {
    return { isOpen: false };
  }
  
  // Parse time range
  const timeMatch = todayHours.match(/(\d{1,2}):?(\d{2})?\s*(AM|PM)?\s*-\s*(\d{1,2}):?(\d{2})?\s*(AM|PM)?/i);
  if (!timeMatch) {
    return { isOpen: true };
  }
  
  const parseTime = (hour: string, minute: string | undefined, ampm: string | undefined): number => {
    let h = parseInt(hour, 10);
    const m = minute ? parseInt(minute, 10) : 0;
    if (ampm?.toUpperCase() === 'PM' && h !== 12) h += 12;
    if (ampm?.toUpperCase() === 'AM' && h === 12) h = 0;
    return h * 60 + m;
  };
  
  const openTime = parseTime(timeMatch[1], timeMatch[2], timeMatch[3]);
  const closeTime = parseTime(timeMatch[4], timeMatch[5], timeMatch[6]);
  
  const isOpen = currentTimeNum >= openTime && currentTimeNum < closeTime;
  
  return {
    isOpen,
    openUntil: isOpen ? `${timeMatch[4]}:${timeMatch[5] || '00'} ${timeMatch[6] || 'PM'}` : undefined,
  };
}

/**
 * Rank restaurants by value score, filtering out closed ones
 */
export function rankRestaurants(
  restaurants: RankedRestaurant[],
  config: RankingConfig
): RankedRestaurant[] {
  return restaurants
    .filter(r => r.isOpen) // Must be open
    .filter(r => {
      // Within travel time OR exceptional
      return r.travelTimeMin <= config.maxTravelTimeMin || r.isExceptional;
    })
    .sort((a, b) => b.valueScore - a.valueScore);
}
