/**
 * Yelp Fusion API integration
 * 
 * Get API key at: https://www.yelp.com/developers/v3/manage_app
 * Set as YELP_API_KEY in your environment
 */

import { PlatformReview } from '@/types';

const YELP_API_KEY = process.env.YELP_API_KEY;

interface YelpBusiness {
  id: string;
  name: string;
  rating: number;
  review_count: number;
  url: string;
  location: {
    address1: string;
    city: string;
    state: string;
  };
  coordinates: {
    latitude: number;
    longitude: number;
  };
  is_closed: boolean;
}

interface YelpSearchResponse {
  businesses: YelpBusiness[];
  total: number;
}

/**
 * Search Yelp for a business by name and location
 */
export async function searchYelp(name: string, location: string): Promise<PlatformReview | null> {
  if (!YELP_API_KEY) {
    return null;
  }

  try {
    const url = new URL('https://api.yelp.com/v3/businesses/search');
    url.searchParams.set('term', name);
    url.searchParams.set('location', location);
    url.searchParams.set('limit', '1');
    url.searchParams.set('categories', 'restaurants,food');

    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${YELP_API_KEY}`,
      },
    });

    if (!response.ok) {
      if (response.status === 429) {
        // Rate limited - silently fail
        return null;
      }
      const errorBody = await response.text().catch(() => '');
      console.error(`Yelp API error: ${response.status}`, errorBody.substring(0, 200));
      return null;
    }

    const data: YelpSearchResponse = await response.json();
    
    if (data.businesses.length === 0) {
      console.log(`Yelp: No results for "${name}" in "${location}"`);
      return null;
    }

    const business = data.businesses[0];
    console.log(`Yelp found: ${business.name} - ${business.rating}★ (${business.review_count} reviews)`);
    
    return {
      platform: 'yelp',
      rating: business.rating,
      reviewCount: business.review_count,
      url: business.url,
    };
  } catch (error) {
    console.error('Yelp API error:', error);
    return null;
  }
}

/**
 * Search Yelp for nearby restaurants
 */
export async function searchYelpNearby(
  latitude: number,
  longitude: number,
  radiusMeters: number = 5000,
  openNow: boolean = true
): Promise<YelpBusiness[]> {
  if (!YELP_API_KEY) {
    return [];
  }

  try {
    const url = new URL('https://api.yelp.com/v3/businesses/search');
    url.searchParams.set('latitude', latitude.toString());
    url.searchParams.set('longitude', longitude.toString());
    url.searchParams.set('radius', Math.min(radiusMeters, 40000).toString()); // Max 40km
    url.searchParams.set('categories', 'restaurants,food');
    url.searchParams.set('sort_by', 'rating');
    url.searchParams.set('limit', '20');
    if (openNow) {
      url.searchParams.set('open_now', 'true');
    }

    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${YELP_API_KEY}`,
      },
    });

    if (!response.ok) {
      return [];
    }

    const data: YelpSearchResponse = await response.json();
    return data.businesses;
  } catch (error) {
    console.error('Yelp nearby search error:', error);
    return [];
  }
}
