'use client';

import { Restaurant } from '@/types';
import { Star, Clock, MapPin, TrendingUp, Award } from 'lucide-react';

interface RestaurantListProps {
  restaurants: Restaurant[];
  onSelect?: (restaurant: Restaurant) => void;
}

const PLATFORM_COLORS: Record<string, string> = {
  google: 'bg-blue-100 text-blue-700',
  yelp: 'bg-red-100 text-red-700',
  tripadvisor: 'bg-green-100 text-green-700',
  foursquare: 'bg-purple-100 text-purple-700',
};

function RestaurantCard({ restaurant, rank, onSelect }: { restaurant: Restaurant; rank: number; onSelect?: (r: Restaurant) => void }) {
  const isTopPick = rank === 1;
  
  return (
    <div 
      className={`relative bg-white rounded-xl border transition-all hover:shadow-md cursor-pointer ${
        isTopPick ? 'border-orange-300 shadow-lg ring-2 ring-orange-100' : 'border-gray-200'
      }`}
      onClick={() => onSelect?.(restaurant)}
    >
      {isTopPick && (
        <div className="absolute -top-3 left-4 px-3 py-1 bg-gradient-to-r from-orange-500 to-red-500 text-white text-xs font-bold rounded-full flex items-center gap-1">
          <Award className="w-3 h-3" />
          BEST OPTION
        </div>
      )}
      
      {restaurant.isExceptional && !isTopPick && (
        <div className="absolute -top-3 left-4 px-3 py-1 bg-purple-500 text-white text-xs font-bold rounded-full flex items-center gap-1">
          <Star className="w-3 h-3" />
          EXCEPTIONAL
        </div>
      )}

      <div className="p-4 pt-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-gray-400 text-sm font-medium">#{rank}</span>
              <h3 className="font-semibold text-gray-900 truncate">{restaurant.name}</h3>
            </div>
            
            <div className="flex items-center gap-3 mt-1 text-sm text-gray-600">
              {restaurant.cuisine && (
                <span>{restaurant.cuisine}</span>
              )}
              {restaurant.priceLevel && (
                <span className="text-green-600 font-medium">{restaurant.priceLevel}</span>
              )}
            </div>

            <div className="flex items-center gap-4 mt-2 text-sm">
              {restaurant.travelTimeMin !== undefined && (
                <div className="flex items-center gap-1 text-gray-600">
                  <Clock className="w-4 h-4" />
                  <span>{restaurant.travelTimeMin} min</span>
                </div>
              )}
              {restaurant.distanceKm !== undefined && (
                <div className="flex items-center gap-1 text-gray-500">
                  <MapPin className="w-4 h-4" />
                  <span>{restaurant.distanceKm} km</span>
                </div>
              )}
              {restaurant.isOpenNow && restaurant.openUntil && (
                <span className="text-green-600 text-xs">
                  Open until {restaurant.openUntil}
                </span>
              )}
            </div>
          </div>

          <div className="text-right flex-shrink-0">
            <div className={`text-2xl font-bold ${
              restaurant.aggregatedScore >= 4.5 ? 'text-green-600' :
              restaurant.aggregatedScore >= 4.0 ? 'text-lime-600' :
              restaurant.aggregatedScore >= 3.5 ? 'text-yellow-600' : 'text-orange-600'
            }`}>
              {restaurant.aggregatedScore.toFixed(1)}
            </div>
            <div className="text-xs text-gray-500">aggregated</div>
            {restaurant.valueScore !== undefined && restaurant.valueScore !== restaurant.aggregatedScore && (
              <div className="flex items-center gap-1 text-xs text-purple-600 mt-1">
                <TrendingUp className="w-3 h-3" />
                {restaurant.valueScore.toFixed(1)} value
              </div>
            )}
          </div>
        </div>

        {/* Platform ratings mini view */}
        <div className="flex flex-wrap gap-1.5 mt-3">
          {restaurant.reviews.map((review) => (
            <div
              key={review.platform}
              className={`px-2 py-0.5 rounded text-xs font-medium ${PLATFORM_COLORS[review.platform] || 'bg-gray-100 text-gray-700'}`}
            >
              {review.platform}: {review.rating}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function RestaurantList({ restaurants, onSelect }: RestaurantListProps) {
  if (restaurants.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>No restaurants found matching your criteria.</p>
        <p className="text-sm mt-1">Try adjusting your filters or expanding your search area.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">
          {restaurants.length} {restaurants.length === 1 ? 'restaurant' : 'restaurants'} found
        </h2>
        <span className="text-sm text-gray-500">Sorted by best value</span>
      </div>
      
      <div className="space-y-3">
        {restaurants.map((restaurant, index) => (
          <RestaurantCard
            key={restaurant.id}
            restaurant={restaurant}
            rank={index + 1}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  );
}
