'use client';

import { useState, useEffect } from 'react';
import { Utensils, Navigation, RefreshCw, MapPin, Clock } from 'lucide-react';
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
      {/* Header - compact for mobile */}
      <header className="pt-6 pb-4 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-3">
            <div className="inline-flex items-center justify-center w-10 h-10 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl shadow-lg">
              <Utensils className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">
              Where Should I Eat?
            </h1>
          </div>
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
              
              {/* Time picker */}
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-gray-500" />
                <select
                  value={plannedTime}
                  onChange={(e) => setPlannedTime(e.target.value)}
                  className="text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="now">Right now</option>
                  <option value="breakfast">Breakfast (8am)</option>
                  <option value="lunch">Lunch (12pm)</option>
                  <option value="dinner">Dinner (7pm)</option>
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
                {plannedTime === 'now' ? 'Find Restaurant' : `Find for ${plannedTime.charAt(0).toUpperCase() + plannedTime.slice(1)}`}
              </button>
            )}
          </div>


          {/* Error display */}
          {error && (
            <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-center">
              {error}
            </div>
          )}

          {/* Results - Yes/No flow */}
          {currentRestaurant && (
            <div className="mt-8">
              <div className="text-center mb-4">
                <span className="inline-block px-3 py-1 bg-green-100 text-green-800 text-sm font-medium rounded-full">
                  🎯 #{currentIndex + 1} Pick
                </span>
              </div>
              <ResultCard restaurant={currentRestaurant} />
              
              {/* Action buttons */}
              <div className="flex gap-4 mt-6 justify-center">
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(currentRestaurant.address)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 max-w-xs py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-semibold rounded-xl hover:from-green-600 hover:to-emerald-600 transition-all flex items-center justify-center gap-2"
                >
                  <MapPin className="w-5 h-5" />
                  Let&apos;s Go!
                </a>
                
                {hasMoreOptions && (
                  <button
                    onClick={() => setCurrentIndex(currentIndex + 1)}
                    className="flex-1 max-w-xs py-3 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200 transition-all flex items-center justify-center gap-2"
                  >
                    <RefreshCw className="w-5 h-5" />
                    Show Another
                  </button>
                )}
              </div>
              
              {/* Progress indicator */}
              <p className="text-center text-sm text-gray-400 mt-4">
                Option {currentIndex + 1} of {allResults.length}
              </p>
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
                  Click &quot;Find Best Restaurant Near Me&quot; to get started
                </p>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 text-center text-sm text-gray-500 border-t border-gray-100">
        <p>
          Aggregates reviews from Google, Yelp, TripAdvisor, Foursquare & more
        </p>
        <p className="text-xs mt-1 text-gray-400">
          Ranked by value: quality vs. travel time
        </p>
      </footer>
    </div>
  );
}
