/**
 * Foursquare Places API integration
 * 
 * Get API key at: https://developer.foursquare.com/
 * Set as FOURSQUARE_API_KEY in your environment
 */

import { PlatformReview } from '@/types';

const FOURSQUARE_API_KEY = process.env.FOURSQUARE_API_KEY;

interface FoursquarePlace {
  fsq_id: string;
  name: string;
  rating?: number;
  stats?: {
    total_ratings: number;
  };
  location: {
    formatted_address: string;
  };
  geocodes: {
    main: {
      latitude: number;
      longitude: number;
    };
  };
}

/**
 * Search Foursquare for a place by name and location
 */
export async function searchFoursquare(name: string, near: string): Promise<PlatformReview | null> {
  if (!FOURSQUARE_API_KEY) {
    return null;
  }

  try {
    const url = new URL('https://api.foursquare.com/v3/places/search');
    url.searchParams.set('query', name);
    url.searchParams.set('near', near);
    url.searchParams.set('categories', '13065'); // Restaurants category
    url.searchParams.set('limit', '1');
    url.searchParams.set('fields', 'fsq_id,name,rating,stats,location');

    // Foursquare v3 API key format
    const authKey = FOURSQUARE_API_KEY.startsWith('fsq') ? FOURSQUARE_API_KEY : `fsq${FOURSQUARE_API_KEY}`;
    
    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': authKey,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      // Silently fail - API key may be invalid or rate limited
      return null;
    }

    const data = await response.json();
    
    if (!data.results || data.results.length === 0) {
      return null;
    }

    const place: FoursquarePlace = data.results[0];
    
    // Foursquare ratings are out of 10, convert to 5
    const rating = place.rating ? place.rating / 2 : 0;
    
    return {
      platform: 'foursquare',
      rating,
      reviewCount: place.stats?.total_ratings || 0,
    };
  } catch (error) {
    console.error('Foursquare API error:', error);
    return null;
  }
}

/**
 * Search Foursquare for nearby restaurants
 */
export async function searchFoursquareNearby(
  latitude: number,
  longitude: number,
  radiusMeters: number = 5000,
  openNow: boolean = true
): Promise<FoursquarePlace[]> {
  if (!FOURSQUARE_API_KEY) {
    return [];
  }

  try {
    const url = new URL('https://api.foursquare.com/v3/places/search');
    url.searchParams.set('ll', `${latitude},${longitude}`);
    url.searchParams.set('radius', radiusMeters.toString());
    url.searchParams.set('categories', '13065'); // Restaurants
    url.searchParams.set('limit', '20');
    url.searchParams.set('sort', 'RATING');
    url.searchParams.set('fields', 'fsq_id,name,rating,stats,location,geocodes');
    if (openNow) {
      url.searchParams.set('open_now', 'true');
    }

    // Foursquare v3 API key format
    const authKey = FOURSQUARE_API_KEY.startsWith('fsq') ? FOURSQUARE_API_KEY : `fsq${FOURSQUARE_API_KEY}`;

    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': authKey,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    return data.results || [];
  } catch (error) {
    console.error('Foursquare nearby search error:', error);
    return [];
  }
}
