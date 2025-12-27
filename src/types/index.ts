export interface PlatformReview {
  platform: 'google' | 'yelp' | 'tripadvisor' | 'foursquare' | 'zomato';
  rating: number; // normalized to 0-5 scale
  reviewCount: number;
  url?: string;
  lastUpdated?: Date;
}

export interface Restaurant {
  id: string;
  name: string;
  address: string;
  cuisine?: string;
  priceLevel?: string; // $, $$, $$$, $$$$
  imageUrl?: string;
  reviews: PlatformReview[];
  aggregatedScore: number;
  confidence: number; // 0-1, based on data quality
  latitude?: number;
  longitude?: number;
  hours?: string[]; // Operating hours per day
  isOpenNow?: boolean;
  openUntil?: string;
  distanceKm?: number;
  travelTimeMin?: number;
  valueScore?: number;
  isExceptional?: boolean;
}

export type WeightingStrategy = 
  | 'simple_average'
  | 'review_count_weighted'
  | 'bayesian_average'
  | 'confidence_weighted'
  | 'platform_trust';

export interface WeightingConfig {
  strategy: WeightingStrategy;
  platformWeights?: Record<string, number>; // for platform_trust strategy
  bayesianPrior?: number; // for bayesian_average (default: 3.5)
  bayesianMinReviews?: number; // for bayesian_average (default: 10)
}

export interface SearchParams {
  query: string;
  location: string;
  weightingConfig: WeightingConfig;
  userLat?: number;
  userLon?: number;
  maxTravelTimeMin?: number;
  openNowOnly?: boolean;
}

export interface ScrapingResult {
  success: boolean;
  data?: PlatformReview;
  error?: string;
}
