/**
 * TripAdvisor Content API integration
 * 
 * Get API key at: https://www.tripadvisor.com/developers
 * Set as TRIPADVISOR_API_KEY in your environment
 */

import { PlatformReview } from '@/types';

const TRIPADVISOR_API_KEY = process.env.TRIPADVISOR_API_KEY;

interface TripAdvisorLocation {
  location_id: string;
  name: string;
  rating: string;
  num_reviews: string;
  web_url: string;
}

/**
 * Search TripAdvisor for a restaurant by name and location
 */
export async function searchTripAdvisor(name: string, location: string): Promise<PlatformReview | null> {
  if (!TRIPADVISOR_API_KEY) {
    return null;
  }

  try {
    // First, search for the location
    const searchUrl = new URL('https://api.content.tripadvisor.com/api/v1/location/search');
    searchUrl.searchParams.set('key', TRIPADVISOR_API_KEY);
    searchUrl.searchParams.set('searchQuery', `${name} ${location}`);
    searchUrl.searchParams.set('category', 'restaurants');
    searchUrl.searchParams.set('language', 'en');

    const searchResponse = await fetch(searchUrl.toString(), {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!searchResponse.ok) {
      return null;
    }

    const searchData = await searchResponse.json();
    
    if (!searchData.data || searchData.data.length === 0) {
      return null;
    }

    const locationId = searchData.data[0].location_id;

    // Get details for the location
    const detailsUrl = new URL(`https://api.content.tripadvisor.com/api/v1/location/${locationId}/details`);
    detailsUrl.searchParams.set('key', TRIPADVISOR_API_KEY);
    detailsUrl.searchParams.set('language', 'en');
    detailsUrl.searchParams.set('currency', 'USD');

    const detailsResponse = await fetch(detailsUrl.toString(), {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!detailsResponse.ok) {
      return null;
    }

    const details: TripAdvisorLocation = await detailsResponse.json();
    
    const rating = parseFloat(details.rating);
    const reviewCount = parseInt(details.num_reviews, 10);

    if (isNaN(rating) || rating === 0) {
      return null;
    }

    return {
      platform: 'tripadvisor',
      rating,
      reviewCount: isNaN(reviewCount) ? 0 : reviewCount,
      url: details.web_url,
    };
  } catch (error) {
    return null;
  }
}
