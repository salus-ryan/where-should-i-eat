import { NextRequest, NextResponse } from 'next/server';
import { scrapeAllPlatforms } from '@/lib/scrapers';
import { fetchAllPlatformReviews } from '@/lib/apis';
import { calculateAggregatedScore, calculateConfidence } from '@/lib/scoring';
import { calculateDistance, estimateTravelTime } from '@/lib/geolocation';
import { calculateValueScore, isExceptionalRestaurant } from '@/lib/ranking';
import { searchNearbyPlaces, textSearchPlace, isOpenAtTime } from '@/lib/places';
import { WeightingConfig, Restaurant, PlatformReview } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      query, 
      location, 
      weightingConfig, 
      platforms,
      userLat,
      userLon,
      maxTravelTimeMin = 20,
      plannedTime = 'now',
    } = body;

    // Convert plannedTime to actual Date for filtering
    const getPlannedDate = (time: string): Date => {
      const now = new Date();
      switch (time) {
        case 'tonight':
          const tonight = new Date(now);
          tonight.setHours(19, 0, 0, 0);
          if (tonight < now) tonight.setDate(tonight.getDate() + 1);
          return tonight;
        case 'tomorrow_lunch':
          const tomorrowLunch = new Date(now);
          tomorrowLunch.setDate(tomorrowLunch.getDate() + 1);
          tomorrowLunch.setHours(12, 0, 0, 0);
          return tomorrowLunch;
        case 'tomorrow_dinner':
          const tomorrowDinner = new Date(now);
          tomorrowDinner.setDate(tomorrowDinner.getDate() + 1);
          tomorrowDinner.setHours(19, 0, 0, 0);
          return tomorrowDinner;
        default:
          return now;
      }
    };

    const plannedDate = getPlannedDate(plannedTime);
    const isNow = plannedTime === 'now';

    const config: WeightingConfig = weightingConfig || {
      strategy: 'bayesian_average',
      bayesianPrior: 3.5,
      bayesianMinReviews: 10,
    };

    const selectedPlatforms: PlatformReview['platform'][] = platforms || [
      'google',
      'yelp',
      'tripadvisor',
      'foursquare',
    ];

    // Check if this is a nearby search or specific restaurant search
    const isNearbySearch = query === 'nearby' || query === '' || !query;

    if (isNearbySearch) {
      // Use Google Places API to find nearby restaurants
      if (!userLat || !userLon) {
        return NextResponse.json(
          { error: 'Location is required for nearby search' },
          { status: 400 }
        );
      }

      try {
        // Calculate radius based on travel time (rough estimate: 20 min ≈ 8km at urban speeds)
        const radiusMeters = Math.round((maxTravelTimeMin / 20) * 8000);
        
        const places = await searchNearbyPlaces({
          latitude: userLat,
          longitude: userLon,
          radius: radiusMeters,
          openNow: isNow, // Only filter by "open now" if searching for right now
        });

        // Process ALL places in PARALLEL for maximum speed
        const restaurants: Restaurant[] = await Promise.all(
          places.slice(0, 10).map(async (place) => {
            // Start with Google's rating from Places API
            const googleReview: PlatformReview = {
              platform: 'google',
              rating: place.rating || 0,
              reviewCount: place.userRatingsTotal || 0,
            };

            // Fetch from Yelp, Foursquare, TripAdvisor APIs in parallel
            const additionalReviews = await fetchAllPlatformReviews(
              place.name,
              place.address
            );

            const allReviews = [googleReview, ...additionalReviews].filter(r => r.rating > 0);

            const aggregatedScore = calculateAggregatedScore(allReviews, config);
            const confidence = calculateConfidence(allReviews);
            
            const distanceKm = calculateDistance(userLat, userLon, place.latitude, place.longitude);
            const travelTimeMin = estimateTravelTime(distanceKm);

            const restaurant: Restaurant = {
              id: place.placeId,
              name: place.name,
              address: place.address,
              latitude: place.latitude,
              longitude: place.longitude,
              priceLevel: place.priceLevel ? '$'.repeat(place.priceLevel) : undefined,
              reviews: allReviews,
              aggregatedScore,
              confidence,
              isOpenNow: place.openNow,
              distanceKm: Math.round(distanceKm * 10) / 10,
              travelTimeMin,
            };

            const exceptional = isExceptionalRestaurant(restaurant);
            restaurant.isExceptional = exceptional;
            restaurant.valueScore = calculateValueScore(
              aggregatedScore,
              travelTimeMin,
              maxTravelTimeMin,
              exceptional
            );

            return restaurant;
          })
        );

        // Filter by open status at planned time and sort by value score
        const results = restaurants
          .filter(r => {
            if (isNow) {
              // For "now", use the openNow flag from Google
              return r.isOpenNow !== false;
            } else {
              // For future times, check opening hours
              const place = places.find(p => p.placeId === r.id);
              return isOpenAtTime(place?.openingHours, plannedDate);
            }
          })
          .filter(r => (r.travelTimeMin || 0) <= maxTravelTimeMin || r.isExceptional)
          .sort((a, b) => (b.valueScore || 0) - (a.valueScore || 0));

        return NextResponse.json({
          restaurants: results,
          totalFound: places.length,
          filteredCount: results.length,
        });

      } catch (placesError) {
        // If Google Places fails, return helpful error
        const errorMessage = placesError instanceof Error ? placesError.message : 'Unknown error';
        return NextResponse.json(
          { error: `Places search failed: ${errorMessage}` },
          { status: 500 }
        );
      }
    }

    // Specific restaurant search - scrape all platforms
    const { results, errors } = await scrapeAllPlatforms(
      query,
      location,
      selectedPlatforms
    );

    const aggregatedScore = calculateAggregatedScore(results, config);
    const confidence = calculateConfidence(results);

    const restaurant: Restaurant = {
      id: `${query}-${location}-${Date.now()}`.replace(/\s+/g, '-').toLowerCase(),
      name: query,
      address: location,
      reviews: results,
      aggregatedScore,
      confidence,
    };

    // Add distance/time if user location provided
    if (userLat && userLon && restaurant.latitude && restaurant.longitude) {
      const distanceKm = calculateDistance(userLat, userLon, restaurant.latitude, restaurant.longitude);
      restaurant.distanceKm = Math.round(distanceKm * 10) / 10;
      restaurant.travelTimeMin = estimateTravelTime(distanceKm);
      
      const exceptional = isExceptionalRestaurant(restaurant);
      restaurant.isExceptional = exceptional;
      restaurant.valueScore = calculateValueScore(
        aggregatedScore,
        restaurant.travelTimeMin,
        maxTravelTimeMin,
        exceptional
      );
    }

    return NextResponse.json({
      restaurant,
      errors: Object.keys(errors).length > 0 ? errors : undefined,
      platformsSearched: selectedPlatforms,
      platformsFound: results.map((r) => r.platform),
    });
  } catch (error) {
    console.error('Search API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
