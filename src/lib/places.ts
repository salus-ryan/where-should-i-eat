/**
 * Google Places API integration for discovering nearby restaurants
 * 
 * To use this, you need a Google Places API key.
 * Set it as GOOGLE_PLACES_API_KEY in your environment.
 */

export interface OpeningHoursPeriod {
  open: { day: number; time: string }; // day: 0=Sunday, time: "0900"
  close?: { day: number; time: string };
}

export interface PlaceResult {
  placeId: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  rating?: number;
  userRatingsTotal?: number;
  priceLevel?: number;
  types?: string[];
  openNow?: boolean;
  openingHours?: OpeningHoursPeriod[];
  photos?: string[];
}

export interface NearbySearchParams {
  latitude: number;
  longitude: number;
  radius?: number; // meters, default 5000 (5km)
  type?: string; // default 'restaurant'
  keyword?: string;
  openNow?: boolean;
}

const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;

/**
 * Search for nearby restaurants using Google Places API
 */
export async function searchNearbyPlaces(params: NearbySearchParams): Promise<PlaceResult[]> {
  const {
    latitude,
    longitude,
    radius = 5000,
    type = 'restaurant',
    keyword,
    openNow,
  } = params;

  if (!GOOGLE_PLACES_API_KEY) {
    throw new Error('GOOGLE_PLACES_API_KEY is not configured. Please add it to your environment variables.');
  }

  const url = new URL('https://maps.googleapis.com/maps/api/place/nearbysearch/json');
  url.searchParams.set('location', `${latitude},${longitude}`);
  url.searchParams.set('radius', radius.toString());
  url.searchParams.set('type', type);
  url.searchParams.set('key', GOOGLE_PLACES_API_KEY);
  
  if (keyword) {
    url.searchParams.set('keyword', keyword);
  }
  if (openNow) {
    url.searchParams.set('opennow', 'true');
  }

  const response = await fetch(url.toString());
  const data = await response.json();

  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    throw new Error(`Google Places API error: ${data.status} - ${data.error_message || 'Unknown error'}`);
  }

  return (data.results || []).map((place: any) => ({
    placeId: place.place_id,
    name: place.name,
    address: place.vicinity,
    latitude: place.geometry.location.lat,
    longitude: place.geometry.location.lng,
    rating: place.rating,
    userRatingsTotal: place.user_ratings_total,
    priceLevel: place.price_level,
    types: place.types,
    openNow: place.opening_hours?.open_now,
    openingHours: place.opening_hours?.periods,
    photos: place.photos?.map((p: any) => p.photo_reference),
  }));
}

/**
 * Check if a restaurant is open at a specific date/time
 */
export function isOpenAtTime(openingHours: OpeningHoursPeriod[] | undefined, targetDate: Date): boolean {
  if (!openingHours || openingHours.length === 0) {
    // If no hours data, assume open (better to show than hide)
    return true;
  }

  const dayOfWeek = targetDate.getDay(); // 0 = Sunday
  const timeStr = targetDate.getHours().toString().padStart(2, '0') + 
                  targetDate.getMinutes().toString().padStart(2, '0');

  for (const period of openingHours) {
    // Check if this period covers the target day
    if (period.open.day === dayOfWeek) {
      const openTime = period.open.time;
      const closeTime = period.close?.time || '2359';
      
      // Handle overnight hours (close time on next day)
      if (period.close && period.close.day !== period.open.day) {
        // Opens today and closes tomorrow - if we're after open time, we're good
        if (timeStr >= openTime) return true;
      } else {
        // Normal same-day hours
        if (timeStr >= openTime && timeStr <= closeTime) return true;
      }
    }
    
    // Check if previous day's overnight hours cover us
    const prevDay = (dayOfWeek + 6) % 7;
    if (period.open.day === prevDay && period.close && period.close.day === dayOfWeek) {
      if (timeStr <= period.close.time) return true;
    }
  }

  return false;
}

/**
 * Get detailed place information including reviews
 */
export async function getPlaceDetails(placeId: string): Promise<any> {
  if (!GOOGLE_PLACES_API_KEY) {
    throw new Error('GOOGLE_PLACES_API_KEY is not configured');
  }

  const url = new URL('https://maps.googleapis.com/maps/api/place/details/json');
  url.searchParams.set('place_id', placeId);
  url.searchParams.set('fields', 'name,formatted_address,geometry,rating,user_ratings_total,price_level,opening_hours,reviews,types,website,formatted_phone_number');
  url.searchParams.set('key', GOOGLE_PLACES_API_KEY);

  const response = await fetch(url.toString());
  const data = await response.json();

  if (data.status !== 'OK') {
    throw new Error(`Google Places API error: ${data.status}`);
  }

  return data.result;
}

/**
 * Text search for a specific restaurant
 */
export async function textSearchPlace(query: string, location?: { lat: number; lng: number }): Promise<PlaceResult[]> {
  if (!GOOGLE_PLACES_API_KEY) {
    throw new Error('GOOGLE_PLACES_API_KEY is not configured');
  }

  const url = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json');
  url.searchParams.set('query', `${query} restaurant`);
  url.searchParams.set('type', 'restaurant');
  url.searchParams.set('key', GOOGLE_PLACES_API_KEY);
  
  if (location) {
    url.searchParams.set('location', `${location.lat},${location.lng}`);
    url.searchParams.set('radius', '50000'); // 50km radius for text search
  }

  const response = await fetch(url.toString());
  const data = await response.json();

  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    throw new Error(`Google Places API error: ${data.status}`);
  }

  return (data.results || []).map((place: any) => ({
    placeId: place.place_id,
    name: place.name,
    address: place.formatted_address,
    latitude: place.geometry.location.lat,
    longitude: place.geometry.location.lng,
    rating: place.rating,
    userRatingsTotal: place.user_ratings_total,
    priceLevel: place.price_level,
    types: place.types,
    openNow: place.opening_hours?.open_now,
  }));
}
