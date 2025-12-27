'use client';

import { useState, useEffect } from 'react';
import { Utensils, Navigation, Clock } from 'lucide-react';
import { SearchForm, WeightingSelector, ResultCard, LocationButton, RestaurantList } from '@/components';
import { Restaurant, WeightingConfig } from '@/types';
import { Coordinates, getCurrentPosition, reverseGeocode } from '@/lib/geolocation';

export default function Home() {
  const [isLoading, setIsLoading] = useState(false);
  const [singleResult, setSingleResult] = useState<{
    restaurant: Restaurant;
    errors?: Record<string, string>;
  } | null>(null);
  const [listResults, setListResults] = useState<Restaurant[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [weightingConfig, setWeightingConfig] = useState<WeightingConfig>({
    strategy: 'bayesian_average',
    bayesianPrior: 3.5,
    bayesianMinReviews: 10,
  });
    const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  const [locationName, setLocationName] = useState<string | null>(null);
  const [maxTravelTime, setMaxTravelTime] = useState(20);
  const [openNowOnly, setOpenNowOnly] = useState(true);
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

  const handleSearch = async (query: string, location: string) => {
    setIsLoading(true);
    setError(null);
    setSingleResult(null);
    setListResults(null);

    try {
      const endpoint = '/api/search';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          location: location || locationName || 'New York',
          weightingConfig,
          userLat: userLocation?.latitude,
          userLon: userLocation?.longitude,
          maxTravelTimeMin: maxTravelTime,
          openNowOnly,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Search failed');
      }

      // Handle single restaurant vs list response
      if (data.restaurant) {
        setSingleResult({
          restaurant: data.restaurant,
          errors: data.errors,
        });
      } else if (data.restaurants) {
        setListResults(data.restaurants);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFindNearby = async () => {
    if (!userLocation) {
      setError('Please enable location first');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setSingleResult(null);
    setListResults(null);

    try {
      const endpoint = '/api/search';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: 'nearby',
          location: locationName,
          weightingConfig,
          userLat: userLocation.latitude,
          userLon: userLocation.longitude,
          maxTravelTimeMin: maxTravelTime,
          openNowOnly,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Search failed');
      }

      if (data.restaurants) {
        setListResults(data.restaurants);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectRestaurant = (restaurant: Restaurant) => {
    setSingleResult({ restaurant });
    setListResults(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-red-50">
      {/* Header */}
      <header className="pt-12 pb-8 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl shadow-lg mb-4">
            <Utensils className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Where Should I Eat?
          </h1>
          <p className="text-gray-600 max-w-md mx-auto">
            Find the best restaurant near you, open now, ranked by aggregated reviews
          </p>
        </div>
      </header>

      {/* Main content */}
      <main className="px-4 pb-16">
        <div className="max-w-4xl mx-auto">
          {/* Location & Filters */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6 shadow-sm">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <LocationButton 
                onLocationObtained={handleLocationObtained}
                currentLocation={locationName}
                isLoading={locationLoading}
              />
              
              <div className="flex items-center gap-4">
                {/* Travel time filter */}
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-gray-500" />
                  <select
                    value={maxTravelTime}
                    onChange={(e) => setMaxTravelTime(parseInt(e.target.value))}
                    className="text-sm border border-gray-200 rounded-lg px-2 py-1 text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    <option value={10}>10 min</option>
                    <option value={15}>15 min</option>
                    <option value={20}>20 min</option>
                    <option value={30}>30 min</option>
                    <option value={45}>45 min</option>
                  </select>
                </div>

                {/* Open now toggle */}
                <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={openNowOnly}
                    onChange={(e) => setOpenNowOnly(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                  />
                  Open now
                </label>
              </div>
            </div>

            {/* Find nearby button */}
            {userLocation && (
              <button
                onClick={handleFindNearby}
                disabled={isLoading}
                className="w-full mt-4 py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white font-semibold rounded-xl hover:from-orange-600 hover:to-red-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              >
                <Navigation className="w-5 h-5" />
                Find Best Restaurant Near Me
              </button>
            )}
          </div>

          {/* Search form for specific restaurant */}
          <div className="mb-4">
            <p className="text-center text-sm text-gray-500 mb-2">Or search for a specific restaurant:</p>
            <SearchForm onSearch={handleSearch} isLoading={isLoading} />
          </div>

          {/* Weighting options */}
          <WeightingSelector config={weightingConfig} onChange={setWeightingConfig} />

          {/* Error display */}
          {error && (
            <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-center">
              {error}
            </div>
          )}

          {/* Results - List view */}
          {listResults && (
            <div className="mt-8">
              <RestaurantList 
                restaurants={listResults} 
                onSelect={handleSelectRestaurant}
              />
            </div>
          )}

          {/* Results - Single restaurant view */}
          {singleResult && (
            <div className="mt-8">
              {listResults && (
                <button
                  onClick={() => {
                    setSingleResult(null);
                  }}
                  className="mb-4 text-sm text-orange-600 hover:text-orange-700 flex items-center gap-1"
                >
                  ← Back to list
                </button>
              )}
              <ResultCard restaurant={singleResult.restaurant} errors={singleResult.errors} />
            </div>
          )}

          {/* Getting started prompt */}
          {!singleResult && !listResults && !isLoading && (
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
