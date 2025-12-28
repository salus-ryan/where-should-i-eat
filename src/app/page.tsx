'use client';

import { useState, useEffect } from 'react';
import { Utensils, Navigation, RefreshCw, MapPin, Clock, ChevronLeft, Loader2, ExternalLink, Phone, Globe, Star } from 'lucide-react';
import { ResultCard, LocationButton } from '@/components';
import { Restaurant } from '@/types';
import { Coordinates, getCurrentPosition, reverseGeocode } from '@/lib/geolocation';

export default function Home() {
  const [isLoading, setIsLoading] = useState(false);
  const [singleResult, setSingleResult] = useState<{
    restaurant: Restaurant;
    errors?: Record<string, string>;
  } | null>(null);
  const [allResults, setAllResults] = useState<Restaurant[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [plannedTime, setPlannedTime] = useState<string>('now'); // 'now' or ISO datetime
    const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  const [locationName, setLocationName] = useState<string | null>(null);
  const maxTravelTime = 30; // Fixed 30 min max travel time

  // Get current restaurant from results
  const currentRestaurant = allResults.length > 0 ? allResults[currentIndex] : null;
  const hasMoreOptions = currentIndex < allResults.length - 1;
  const [locationLoading, setLocationLoading] = useState(false);

  // Auto-trigger location permission on mount
  useEffect(() => {
    const requestLocation = async () => {
      setLocationLoading(true);
      try {
        const coords = await getCurrentPosition();
        const name = await reverseGeocode(coords);
        setUserLocation(coords);
        setLocationName(name);
      } catch (err) {
        // User denied or error - they can manually enable later
        console.log('Location not available:', err);
      } finally {
        setLocationLoading(false);
      }
    };
    
    requestLocation();
  }, []);

  const handleLocationObtained = (coords: Coordinates, name: string) => {
    setUserLocation(coords);
    setLocationName(name);
  };


  const handleFindNearby = async () => {
    if (!userLocation) {
      setError('Please enable location first');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setSingleResult(null);
    setAllResults([]);
    setCurrentIndex(0);

    try {
      const endpoint = '/api/search';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: 'nearby',
          location: locationName,
          userLat: userLocation.latitude,
          userLon: userLocation.longitude,
          maxTravelTimeMin: maxTravelTime,
          plannedTime,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Search failed');
      }

      if (data.restaurants && data.restaurants.length > 0) {
        // Store all results, currentIndex=0 shows the best one
        setAllResults(data.restaurants);
        setCurrentIndex(0);
      } else {
        setError('No restaurants found matching your criteria');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-red-50">
      {/* Header - minimal for mobile */}
      <header className="pt-4 pb-2 px-4">
        <div className="max-w-4xl mx-auto flex items-center justify-center gap-2">
          <Utensils className="w-5 h-5 text-orange-500" />
          <h1 className="text-lg font-bold text-gray-900">Where Should I Eat?</h1>
        </div>
      </header>

      {/* Main content */}
      <main className="px-4 pb-16">
        <div className="max-w-4xl mx-auto">
          {/* Location & Time */}
          <div className="bg-white rounded-xl border border-gray-200 p-3 mb-4 shadow-sm">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <LocationButton 
                onLocationObtained={handleLocationObtained}
                currentLocation={locationName}
                isLoading={locationLoading}
              />
              
              {/* Time picker - dynamically show options based on current time */}
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-gray-500" />
                <select
                  value={plannedTime}
                  onChange={(e) => setPlannedTime(e.target.value)}
                  className="text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="now">Right now</option>
                  {(() => {
                    const hour = new Date().getHours();
                    const options = [];
                    // Show breakfast if before 8am
                    if (hour < 8) options.push(<option key="breakfast" value="breakfast">Breakfast (8am)</option>);
                    // Show lunch if before 12pm
                    if (hour < 12) options.push(<option key="lunch" value="lunch">Lunch (12pm)</option>);
                    // Show dinner if before 7pm
                    if (hour < 19) options.push(<option key="dinner" value="dinner">Dinner (7pm)</option>);
                    // Always show tomorrow options
                    options.push(<option key="tomorrow_lunch" value="tomorrow_lunch">Tomorrow Lunch</option>);
                    options.push(<option key="tomorrow_dinner" value="tomorrow_dinner">Tomorrow Dinner</option>);
                    return options;
                  })()}
                </select>
              </div>
            </div>

            {/* Find nearby button */}
            {userLocation && (
              <button
                onClick={handleFindNearby}
                disabled={isLoading}
                className="w-full mt-3 py-2.5 bg-gradient-to-r from-orange-500 to-red-500 text-white font-semibold rounded-xl hover:from-orange-600 hover:to-red-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              >
                <Navigation className="w-4 h-4" />
                {plannedTime === 'now' ? 'Find Restaurant' : `Find for ${plannedTime.replace('_', ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}`}
              </button>
            )}
          </div>


          {/* Loading spinner */}
          {isLoading && (
            <div className="mt-8 flex flex-col items-center justify-center">
              <Loader2 className="w-10 h-10 text-orange-500 animate-spin" />
              <p className="mt-3 text-gray-600 font-medium">Finding the best spot...</p>
            </div>
          )}

          {/* Error display */}
          {error && (
            <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-center">
              {error}
            </div>
          )}

          {/* Results - Yes/No flow */}
          {currentRestaurant && !isLoading && (
            <div className="mt-2">
              {/* Photo if available */}
              {currentRestaurant.photoUrl && (
                <div className="rounded-t-xl overflow-hidden h-32">
                  <img 
                    src={currentRestaurant.photoUrl} 
                    alt={currentRestaurant.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              
              {/* Main info card */}
              <div className={`bg-gradient-to-r from-orange-500 to-red-500 ${currentRestaurant.photoUrl ? 'rounded-b-xl' : 'rounded-xl'} p-3 text-white mb-2`}>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-xs opacity-80">#{currentIndex + 1} Pick</p>
                      {currentRestaurant.cuisine && (
                        <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">{currentRestaurant.cuisine}</span>
                      )}
                      {currentRestaurant.priceLevel && (
                        <span className="text-xs font-medium">{currentRestaurant.priceLevel}</span>
                      )}
                    </div>
                    <h2 className="text-lg font-bold">{currentRestaurant.name}</h2>
                    <p className="text-sm opacity-90">{currentRestaurant.address}</p>
                    <div className="flex flex-wrap gap-3 mt-1 text-xs">
                      {currentRestaurant.walkTimeMin && <span>🚶 {currentRestaurant.walkTimeMin} min</span>}
                      {currentRestaurant.driveTimeMin && <span>🚗 {currentRestaurant.driveTimeMin} min</span>}
                      {currentRestaurant.distanceKm && <span>📍 {currentRestaurant.distanceKm} km</span>}
                      {currentRestaurant.isOpenNow && <span className="text-green-200">✓ Open now</span>}
                    </div>
                  </div>
                  <div className="text-right ml-2">
                    <div className="text-2xl font-bold">{currentRestaurant.aggregatedScore.toFixed(1)}</div>
                    <div className="text-xs opacity-80">{currentRestaurant.reviews.length} sources</div>
                  </div>
                </div>
              </div>

              {/* Platform ratings breakdown */}
              <div className="bg-white rounded-xl p-3 mb-2 border border-gray-200">
                <p className="text-xs text-gray-500 mb-2">Ratings by platform</p>
                <div className="flex flex-wrap gap-2">
                  {currentRestaurant.reviews.map((review) => (
                    <div key={review.platform} className="flex items-center gap-1.5 bg-gray-100 px-3 py-1.5 rounded-lg text-sm">
                      <span className="capitalize font-semibold text-gray-800">{review.platform}</span>
                      <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                      <span className="font-bold text-gray-900">{review.rating.toFixed(1)}</span>
                      <span className="text-gray-600 text-xs">({review.reviewCount.toLocaleString()})</span>
                    </div>
                  ))}
                </div>
              </div>

              
              {/* Action buttons */}
              <div className="flex gap-2">
                {currentIndex > 0 && (
                  <button
                    onClick={() => setCurrentIndex(currentIndex - 1)}
                    className="px-3 py-3 bg-gray-200 text-gray-700 rounded-xl flex items-center justify-center"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                )}
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(currentRestaurant.address)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-3 bg-green-500 text-white font-semibold rounded-xl flex items-center justify-center gap-2"
                >
                  <MapPin className="w-4 h-4" />
                  Let&apos;s Go!
                </a>
                {hasMoreOptions ? (
                  <button
                    onClick={() => setCurrentIndex(currentIndex + 1)}
                    className="flex-1 py-3 bg-gray-200 text-gray-700 font-semibold rounded-xl flex items-center justify-center gap-2"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Next
                  </button>
                ) : (
                  <button
                    onClick={() => setCurrentIndex(0)}
                    className="flex-1 py-3 bg-gray-200 text-gray-700 font-semibold rounded-xl flex items-center justify-center gap-2"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Start Over
                  </button>
                )}
              </div>
              <p className="text-center text-xs text-gray-400 mt-2">{currentIndex + 1} of {allResults.length}</p>
            </div>
          )}

          {/* Getting started prompt */}
          {!currentRestaurant && !isLoading && (
            <div className="mt-12 text-center">
              {!userLocation ? (
                <div className="p-6 bg-orange-50 rounded-xl border border-orange-200">
                  <Navigation className="w-8 h-8 text-orange-500 mx-auto mb-3" />
                  <p className="text-gray-700 font-medium">Enable location to find the best restaurants near you</p>
                  <p className="text-sm text-gray-500 mt-1">We&apos;ll show you what&apos;s open now within your travel time</p>
                </div>
              ) : (
                <p className="text-gray-500">
                  Click &quot;Find Restaurant&quot; to get started
                </p>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 text-center text-sm text-gray-500 border-t border-gray-100">
        <p>
          Aggregates reviews from Google, Yelp & TripAdvisor
        </p>
        <p className="text-xs mt-1 text-gray-400">
          Ranked by value: quality vs. travel time
        </p>
      </footer>
    </div>
  );
}
