import { NextRequest, NextResponse } from 'next/server';
import { scrapeAllPlatforms } from '@/lib/scrapers';
import { fetchAllPlatformReviews } from '@/lib/apis';
import { calculateAggregatedScore, calculateConfidence } from '@/lib/scoring';
import { calculateDistance, estimateTravelTime } from '@/lib/geolocation';
import { calculateValueScore, isExceptionalRestaurant } from '@/lib/ranking';
import { searchNearbyPlaces, textSearchPlace } from '@/lib/places';
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
      openNowOnly = true,
    } = body;

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
          openNow: openNowOnly,
        });

        // Process places - fetch from multiple platform APIs sequentially to avoid rate limits
        const restaurants: Restaurant[] = [];
        
        for (const place of places.slice(0, 10)) {
            // Start with Google's rating from Places API
            const googleReview: PlatformReview = {
              platform: 'google',
              rating: place.rating || 0,
              reviewCount: place.userRatingsTotal || 0,
            };

            // Fetch from Yelp and Foursquare APIs
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

            restaurants.push(restaurant);
        }

        // Filter and sort by value score
        const results = restaurants
          .filter(r => !openNowOnly || r.isOpenNow !== false)
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
