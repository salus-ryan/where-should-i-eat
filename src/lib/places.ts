/**
 * Google Places API integration for discovering nearby restaurants
 * 
 * To use this, you need a Google Places API key.
 * Set it as GOOGLE_PLACES_API_KEY in your environment.
 */

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
    photos: place.photos?.map((p: any) => p.photo_reference),
  }));
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
