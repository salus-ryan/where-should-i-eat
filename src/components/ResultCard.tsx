'use client';

import { Restaurant, PlatformReview } from '@/types';
import { Star, ExternalLink, TrendingUp, AlertCircle, Clock, MapPin, Award } from 'lucide-react';

interface ResultCardProps {
  restaurant: Restaurant;
  errors?: Record<string, string>;
}

const PLATFORM_COLORS: Record<string, string> = {
  google: 'bg-blue-100 text-blue-700 border-blue-200',
  yelp: 'bg-red-100 text-red-700 border-red-200',
  tripadvisor: 'bg-green-100 text-green-700 border-green-200',
  foursquare: 'bg-purple-100 text-purple-700 border-purple-200',
  zomato: 'bg-rose-100 text-rose-700 border-rose-200',
};

const PLATFORM_ICONS: Record<string, string> = {
  google: '🔍',
  yelp: '📍',
  tripadvisor: '🦉',
  foursquare: '📌',
  zomato: '🍽️',
};

function StarRating({ rating }: { rating: number }) {
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating % 1 >= 0.5;
  const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);

  return (
    <div className="flex items-center gap-0.5">
      {[...Array(fullStars)].map((_, i) => (
        <Star key={`full-${i}`} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
      ))}
      {hasHalfStar && (
        <div className="relative">
          <Star className="w-4 h-4 text-gray-300" />
          <div className="absolute inset-0 overflow-hidden w-1/2">
            <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
          </div>
        </div>
      )}
      {[...Array(emptyStars)].map((_, i) => (
        <Star key={`empty-${i}`} className="w-4 h-4 text-gray-300" />
      ))}
    </div>
  );
}

function PlatformBadge({ review }: { review: PlatformReview }) {
  const colorClass = PLATFORM_COLORS[review.platform] || 'bg-gray-100 text-gray-700 border-gray-200';
  const icon = PLATFORM_ICONS[review.platform] || '⭐';

  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${colorClass}`}>
      <span className="text-lg">{icon}</span>
      <div className="flex-1">
        <div className="flex items-center justify-between">
          <span className="font-medium capitalize text-sm">{review.platform}</span>
          {review.url && (
            <a
              href={review.url}
              target="_blank"
              rel="noopener noreferrer"
              className="opacity-60 hover:opacity-100 transition-opacity"
            >
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1">
          <StarRating rating={review.rating} />
          <span className="text-xs font-semibold">{review.rating.toFixed(1)}</span>
          <span className="text-xs opacity-70">({review.reviewCount.toLocaleString()} reviews)</span>
        </div>
      </div>
    </div>
  );
}

function ConfidenceMeter({ confidence }: { confidence: number }) {
  const percentage = Math.round(confidence * 100);
  let color = 'bg-red-500';
  let label = 'Low';
  
  if (confidence >= 0.7) {
    color = 'bg-green-500';
    label = 'High';
  } else if (confidence >= 0.4) {
    color = 'bg-yellow-500';
    label = 'Medium';
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full ${color} transition-all duration-500`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="text-xs text-gray-600 font-medium">{label} ({percentage}%)</span>
    </div>
  );
}

export function ResultCard({ restaurant, errors }: ResultCardProps) {
  const scoreColor =
    restaurant.aggregatedScore >= 4.5
      ? 'from-green-500 to-emerald-500'
      : restaurant.aggregatedScore >= 4.0
      ? 'from-lime-500 to-green-500'
      : restaurant.aggregatedScore >= 3.5
      ? 'from-yellow-500 to-orange-500'
      : 'from-orange-500 to-red-500';

  return (
    <div className="w-full max-w-2xl mx-auto mt-8 bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
      {/* Header with aggregated score */}
      <div className={`bg-gradient-to-r ${scoreColor} p-6 text-white relative`}>
        {restaurant.isExceptional && (
          <div className="absolute top-3 right-3 px-2 py-1 bg-white/20 backdrop-blur rounded-full text-xs font-bold flex items-center gap-1">
            <Award className="w-3 h-3" />
            EXCEPTIONAL
          </div>
        )}
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold">{restaurant.name}</h2>
            <p className="text-white/80 text-sm mt-1">{restaurant.address}</p>
            {restaurant.cuisine && (
              <p className="text-white/70 text-sm mt-1">{restaurant.cuisine} {restaurant.priceLevel && `• ${restaurant.priceLevel}`}</p>
            )}
            {/* Location & Time info */}
            <div className="flex items-center gap-4 mt-2 text-sm">
              {restaurant.travelTimeMin !== undefined && (
                <div className="flex items-center gap-1 text-white/90">
                  <Clock className="w-4 h-4" />
                  <span>{restaurant.travelTimeMin} min away</span>
                </div>
              )}
              {restaurant.distanceKm !== undefined && (
                <div className="flex items-center gap-1 text-white/70">
                  <MapPin className="w-4 h-4" />
                  <span>{restaurant.distanceKm} km</span>
                </div>
              )}
            </div>
            {restaurant.isOpenNow !== undefined && (
              <div className={`mt-2 text-sm ${restaurant.isOpenNow ? 'text-white' : 'text-red-200'}`}>
                {restaurant.isOpenNow ? (
                  <span>✓ Open now{restaurant.openUntil && ` until ${restaurant.openUntil}`}</span>
                ) : (
                  <span>✗ Currently closed</span>
                )}
              </div>
            )}
          </div>
          <div className="text-right">
            <div className="text-5xl font-bold">{restaurant.aggregatedScore.toFixed(1)}</div>
            <div className="text-white/80 text-sm flex items-center gap-1 justify-end">
              <TrendingUp className="w-4 h-4" />
              Aggregated Score
            </div>
            {restaurant.valueScore !== undefined && restaurant.valueScore !== restaurant.aggregatedScore && (
              <div className="text-white/70 text-xs mt-1">
                Value score: {restaurant.valueScore.toFixed(1)}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Confidence meter */}
      <div className="px-6 py-4 border-b border-gray-100">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Data Confidence</span>
        </div>
        <ConfidenceMeter confidence={restaurant.confidence} />
      </div>

      {/* Platform breakdown */}
      <div className="p-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Platform Breakdown</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {restaurant.reviews.map((review) => (
            <PlatformBadge key={review.platform} review={review} />
          ))}
        </div>

        {/* Errors */}
        {errors && Object.keys(errors).length > 0 && (
          <div className="mt-4 p-3 bg-amber-50 rounded-lg border border-amber-200">
            <div className="flex items-center gap-2 text-amber-700 text-sm font-medium mb-1">
              <AlertCircle className="w-4 h-4" />
              Some platforms couldn&apos;t be reached
            </div>
            <ul className="text-xs text-amber-600 space-y-1">
              {Object.entries(errors).map(([platform, error]) => (
                <li key={platform} className="capitalize">
                  {platform}: {error}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
