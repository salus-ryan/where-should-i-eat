import { NextRequest, NextResponse } from 'next/server';
import { scrapeAllPlatforms } from '@/lib/scrapers';
import { fetchAllPlatformReviews } from '@/lib/apis';
import { calculateAggregatedScore, calculateConfidence } from '@/lib/scoring';
import { calculateDistance, estimateTravelTime, estimateWalkTime, estimateDriveTime } from '@/lib/geolocation';
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
      const currentHour = now.getHours();
      
      switch (time) {
        case 'breakfast': {
          const target = new Date(now);
          target.setHours(8, 0, 0, 0);
          if (currentHour >= 10) target.setDate(target.getDate() + 1);
          return target;
        }
        case 'lunch': {
          const target = new Date(now);
          target.setHours(12, 0, 0, 0);
          if (currentHour >= 14) target.setDate(target.getDate() + 1);
          return target;
        }
        case 'dinner': {
          const target = new Date(now);
          target.setHours(19, 0, 0, 0);
          if (currentHour >= 21) target.setDate(target.getDate() + 1);
          return target;
        }
        case 'tomorrow_lunch': {
          const target = new Date(now);
          target.setDate(target.getDate() + 1);
          target.setHours(12, 0, 0, 0);
          return target;
        }
        case 'tomorrow_dinner': {
          const target = new Date(now);
          target.setDate(target.getDate() + 1);
          target.setHours(19, 0, 0, 0);
          return target;
        }
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
            const walkTimeMin = estimateWalkTime(distanceKm);
            const driveTimeMin = estimateDriveTime(distanceKm);

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
              travelTimeMin: driveTimeMin,
              walkTimeMin,
              driveTimeMin,
            };

            const exceptional = isExceptionalRestaurant(restaurant);
            restaurant.isExceptional = exceptional;
            restaurant.valueScore = calculateValueScore(
              aggregatedScore,
              driveTimeMin,
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
              // For "now", ONLY show places confirmed open (strict: must be true, not undefined)
              return r.isOpenNow === true;
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
