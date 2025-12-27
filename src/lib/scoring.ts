import { PlatformReview, WeightingConfig, WeightingStrategy } from '@/types';

const DEFAULT_PLATFORM_WEIGHTS: Record<string, number> = {
  google: 1.0,
  yelp: 1.0,
  tripadvisor: 1.0,
  foursquare: 0.9,
  zomato: 0.8,
};

/**
 * Simple average - equal weight to all platforms
 */
function simpleAverage(reviews: PlatformReview[]): number {
  if (reviews.length === 0) return 0;
  const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
  return sum / reviews.length;
}

/**
 * Review count weighted - platforms with more reviews have more influence
 */
function reviewCountWeighted(reviews: PlatformReview[]): number {
  if (reviews.length === 0) return 0;
  const totalReviews = reviews.reduce((acc, r) => acc + r.reviewCount, 0);
  if (totalReviews === 0) return simpleAverage(reviews);
  
  const weightedSum = reviews.reduce((acc, r) => acc + r.rating * r.reviewCount, 0);
  return weightedSum / totalReviews;
}

/**
 * Bayesian average - adjusts for low review counts
 * Formula: (C × m + Σ(reviews)) / (C + n)
 * Where C = minimum reviews threshold, m = prior mean, n = actual review count
 */
function bayesianAverage(
  reviews: PlatformReview[],
  prior: number = 3.5,
  minReviews: number = 10
): number {
  if (reviews.length === 0) return 0;
  
  // Calculate per-platform Bayesian scores, then average
  const bayesianScores = reviews.map(r => {
    const n = r.reviewCount;
    const rating = r.rating;
    return (minReviews * prior + n * rating) / (minReviews + n);
  });
  
  return bayesianScores.reduce((a, b) => a + b, 0) / bayesianScores.length;
}

/**
 * Confidence weighted - higher weight to platforms with more reviews for this restaurant
 * Uses log scale to prevent extreme dominance by high-review platforms
 */
function confidenceWeighted(reviews: PlatformReview[]): number {
  if (reviews.length === 0) return 0;
  
  const weights = reviews.map(r => Math.log10(r.reviewCount + 1) + 1);
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  
  const weightedSum = reviews.reduce((acc, r, i) => acc + r.rating * weights[i], 0);
  return weightedSum / totalWeight;
}

/**
 * Platform trust - user-defined weights per platform
 */
function platformTrustWeighted(
  reviews: PlatformReview[],
  platformWeights: Record<string, number>
): number {
  if (reviews.length === 0) return 0;
  
  const weights = reviews.map(r => platformWeights[r.platform] ?? 1.0);
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  
  const weightedSum = reviews.reduce((acc, r, i) => acc + r.rating * weights[i], 0);
  return weightedSum / totalWeight;
}

/**
 * Calculate aggregated score based on weighting strategy
 */
export function calculateAggregatedScore(
  reviews: PlatformReview[],
  config: WeightingConfig
): number {
  if (reviews.length === 0) return 0;

  let score: number;

  switch (config.strategy) {
    case 'simple_average':
      score = simpleAverage(reviews);
      break;
    case 'review_count_weighted':
      score = reviewCountWeighted(reviews);
      break;
    case 'bayesian_average':
      score = bayesianAverage(
        reviews,
        config.bayesianPrior ?? 3.5,
        config.bayesianMinReviews ?? 10
      );
      break;
    case 'confidence_weighted':
      score = confidenceWeighted(reviews);
      break;
    case 'platform_trust':
      score = platformTrustWeighted(
        reviews,
        config.platformWeights ?? DEFAULT_PLATFORM_WEIGHTS
      );
      break;
    default:
      score = simpleAverage(reviews);
  }

  // Round to 2 decimal places
  return Math.round(score * 100) / 100;
}

/**
 * Calculate confidence score (0-1) based on data quality
 */
export function calculateConfidence(reviews: PlatformReview[]): number {
  if (reviews.length === 0) return 0;

  // Factors:
  // 1. Number of platforms (more = better)
  const platformScore = Math.min(reviews.length / 4, 1); // Max at 4 platforms

  // 2. Total review count
  const totalReviews = reviews.reduce((acc, r) => acc + r.reviewCount, 0);
  const reviewScore = Math.min(Math.log10(totalReviews + 1) / 3, 1); // Max around 1000 reviews

  // 3. Rating consistency (lower variance = higher confidence)
  const ratings = reviews.map(r => r.rating);
  const mean = ratings.reduce((a, b) => a + b, 0) / ratings.length;
  const variance = ratings.reduce((acc, r) => acc + Math.pow(r - mean, 2), 0) / ratings.length;
  const consistencyScore = Math.max(0, 1 - variance / 2); // Variance of 2 = 0 confidence

  // Weighted combination
  const confidence = platformScore * 0.3 + reviewScore * 0.4 + consistencyScore * 0.3;
  return Math.round(confidence * 100) / 100;
}

/**
 * Get description for each weighting strategy
 */
export function getStrategyDescription(strategy: WeightingStrategy): string {
  const descriptions: Record<WeightingStrategy, string> = {
    simple_average: 'Equal weight to all platforms. Simple but ignores review volume.',
    review_count_weighted: 'Platforms with more reviews have more influence. Favors popular spots.',
    bayesian_average: 'Adjusts for low review counts. Prevents 5-star with 2 reviews from dominating.',
    confidence_weighted: 'Uses log-scale review counts. Balanced approach to volume vs. rating.',
    platform_trust: 'You assign custom weights per platform based on your trust level.',
  };
  return descriptions[strategy];
}
