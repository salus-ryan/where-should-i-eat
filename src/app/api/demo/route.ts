import { NextRequest, NextResponse } from 'next/server';
import { calculateAggregatedScore, calculateConfidence } from '@/lib/scoring';
import { calculateDistance, estimateTravelTime } from '@/lib/geolocation';
import { calculateValueScore, isExceptionalRestaurant } from '@/lib/ranking';
import { WeightingConfig, Restaurant, PlatformReview } from '@/types';

interface DemoRestaurant {
  reviews: PlatformReview[];
  latitude: number;
  longitude: number;
  hours: string[];
  cuisine: string;
  priceLevel: string;
}

// Demo data with location and hours for nearby search simulation
const DEMO_RESTAURANTS: Record<string, DemoRestaurant> = {
  'joes-pizza': {
    reviews: [
      { platform: 'google', rating: 4.5, reviewCount: 2847, url: 'https://google.com' },
      { platform: 'yelp', rating: 4.0, reviewCount: 1523, url: 'https://yelp.com' },
      { platform: 'tripadvisor', rating: 4.5, reviewCount: 892, url: 'https://tripadvisor.com' },
      { platform: 'foursquare', rating: 4.3, reviewCount: 456, url: 'https://foursquare.com' },
    ],
    latitude: 40.7308, longitude: -73.9894, // Greenwich Village, NYC
    hours: ['Mon: 10:00 AM - 2:00 AM', 'Tue: 10:00 AM - 2:00 AM', 'Wed: 10:00 AM - 2:00 AM', 'Thu: 10:00 AM - 2:00 AM', 'Fri: 10:00 AM - 4:00 AM', 'Sat: 10:00 AM - 4:00 AM', 'Sun: 10:00 AM - 2:00 AM'],
    cuisine: 'Pizza',
    priceLevel: '$',
  },
  'shake-shack': {
    reviews: [
      { platform: 'google', rating: 4.3, reviewCount: 5621, url: 'https://google.com' },
      { platform: 'yelp', rating: 4.0, reviewCount: 3892, url: 'https://yelp.com' },
      { platform: 'tripadvisor', rating: 4.0, reviewCount: 2145, url: 'https://tripadvisor.com' },
      { platform: 'foursquare', rating: 4.1, reviewCount: 1823, url: 'https://foursquare.com' },
    ],
    latitude: 40.7415, longitude: -73.9880, // Madison Square Park
    hours: ['Mon: 11:00 AM - 10:00 PM', 'Tue: 11:00 AM - 10:00 PM', 'Wed: 11:00 AM - 10:00 PM', 'Thu: 11:00 AM - 10:00 PM', 'Fri: 11:00 AM - 11:00 PM', 'Sat: 11:00 AM - 11:00 PM', 'Sun: 11:00 AM - 10:00 PM'],
    cuisine: 'Burgers',
    priceLevel: '$$',
  },
  'katzs-deli': {
    reviews: [
      { platform: 'google', rating: 4.6, reviewCount: 18234, url: 'https://google.com' },
      { platform: 'yelp', rating: 4.0, reviewCount: 8921, url: 'https://yelp.com' },
      { platform: 'tripadvisor', rating: 4.5, reviewCount: 12453, url: 'https://tripadvisor.com' },
      { platform: 'foursquare', rating: 4.7, reviewCount: 3421, url: 'https://foursquare.com' },
    ],
    latitude: 40.7223, longitude: -73.9874, // Lower East Side
    hours: ['Mon: 8:00 AM - 10:45 PM', 'Tue: 8:00 AM - 10:45 PM', 'Wed: 8:00 AM - 10:45 PM', 'Thu: 8:00 AM - 2:45 AM', 'Fri: 8:00 AM - 2:45 AM', 'Sat: Open 24 hours', 'Sun: Open 24 hours'],
    cuisine: 'Deli',
    priceLevel: '$$',
  },
  'le-bernardin': {
    reviews: [
      { platform: 'google', rating: 4.8, reviewCount: 4521, url: 'https://google.com' },
      { platform: 'yelp', rating: 4.5, reviewCount: 2834, url: 'https://yelp.com' },
      { platform: 'tripadvisor', rating: 4.9, reviewCount: 8234, url: 'https://tripadvisor.com' },
      { platform: 'foursquare', rating: 4.8, reviewCount: 1245, url: 'https://foursquare.com' },
    ],
    latitude: 40.7615, longitude: -73.9819, // Midtown West
    hours: ['Mon: 12:00 PM - 2:30 PM, 5:15 PM - 10:30 PM', 'Tue: 12:00 PM - 2:30 PM, 5:15 PM - 10:30 PM', 'Wed: 12:00 PM - 2:30 PM, 5:15 PM - 10:30 PM', 'Thu: 12:00 PM - 2:30 PM, 5:15 PM - 10:30 PM', 'Fri: 12:00 PM - 2:30 PM, 5:15 PM - 10:30 PM', 'Sat: Closed', 'Sun: Closed'],
    cuisine: 'French Seafood (Michelin 3-Star)',
    priceLevel: '$$$$',
  },
  'eleven-madison-park': {
    reviews: [
      { platform: 'google', rating: 4.7, reviewCount: 3892, url: 'https://google.com' },
      { platform: 'yelp', rating: 4.5, reviewCount: 1923, url: 'https://yelp.com' },
      { platform: 'tripadvisor', rating: 4.8, reviewCount: 5621, url: 'https://tripadvisor.com' },
      { platform: 'foursquare', rating: 4.9, reviewCount: 987, url: 'https://foursquare.com' },
    ],
    latitude: 40.7416, longitude: -73.9872, // Flatiron
    hours: ['Mon: Closed', 'Tue: Closed', 'Wed: 5:30 PM - 10:00 PM', 'Thu: 5:30 PM - 10:00 PM', 'Fri: 5:30 PM - 10:00 PM', 'Sat: 5:30 PM - 10:00 PM', 'Sun: 5:30 PM - 10:00 PM'],
    cuisine: 'American (Michelin 3-Star)',
    priceLevel: '$$$$',
  },
  'tacos-el-bronco': {
    reviews: [
      { platform: 'google', rating: 4.6, reviewCount: 1234, url: 'https://google.com' },
      { platform: 'yelp', rating: 4.5, reviewCount: 892, url: 'https://yelp.com' },
      { platform: 'foursquare', rating: 4.4, reviewCount: 345, url: 'https://foursquare.com' },
    ],
    latitude: 40.7580, longitude: -73.9855, // Times Square area
    hours: ['Mon: 9:00 AM - 12:00 AM', 'Tue: 9:00 AM - 12:00 AM', 'Wed: 9:00 AM - 12:00 AM', 'Thu: 9:00 AM - 12:00 AM', 'Fri: 9:00 AM - 3:00 AM', 'Sat: 9:00 AM - 3:00 AM', 'Sun: 9:00 AM - 12:00 AM'],
    cuisine: 'Mexican',
    priceLevel: '$',
  },
  'russ-and-daughters': {
    reviews: [
      { platform: 'google', rating: 4.7, reviewCount: 5234, url: 'https://google.com' },
      { platform: 'yelp', rating: 4.5, reviewCount: 3421, url: 'https://yelp.com' },
      { platform: 'tripadvisor', rating: 4.5, reviewCount: 2145, url: 'https://tripadvisor.com' },
      { platform: 'foursquare', rating: 4.6, reviewCount: 1823, url: 'https://foursquare.com' },
    ],
    latitude: 40.7223, longitude: -73.9880, // Lower East Side
    hours: ['Mon: 8:00 AM - 6:00 PM', 'Tue: 8:00 AM - 6:00 PM', 'Wed: 8:00 AM - 6:00 PM', 'Thu: 8:00 AM - 6:00 PM', 'Fri: 8:00 AM - 5:00 PM', 'Sat: Closed', 'Sun: 8:00 AM - 5:30 PM'],
    cuisine: 'Jewish Deli / Appetizing',
    priceLevel: '$$',
  },
  'di-fara-pizza': {
    reviews: [
      { platform: 'google', rating: 4.4, reviewCount: 3892, url: 'https://google.com' },
      { platform: 'yelp', rating: 4.0, reviewCount: 2567, url: 'https://yelp.com' },
      { platform: 'tripadvisor', rating: 4.5, reviewCount: 1234, url: 'https://tripadvisor.com' },
      { platform: 'foursquare', rating: 4.6, reviewCount: 892, url: 'https://foursquare.com' },
    ],
    latitude: 40.6250, longitude: -73.9615, // Midwood, Brooklyn (far)
    hours: ['Mon: Closed', 'Tue: Closed', 'Wed: 12:00 PM - 8:00 PM', 'Thu: 12:00 PM - 8:00 PM', 'Fri: 12:00 PM - 8:00 PM', 'Sat: 12:00 PM - 8:00 PM', 'Sun: 1:00 PM - 8:00 PM'],
    cuisine: 'Pizza (Legendary)',
    priceLevel: '$$',
  },
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      query, 
      location, 
      weightingConfig,
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

    const currentTime = new Date();
    const dayOfWeek = currentTime.getDay();
    const currentHour = currentTime.getHours();
    const currentMinute = currentTime.getMinutes();

    // If searching for specific restaurant, find it
    // Otherwise, return all nearby restaurants ranked
    const isNearbySearch = query === 'nearby' || query === '' || !query;
    
    let restaurantsToProcess: [string, DemoRestaurant][] = [];
    
    if (isNearbySearch) {
      // Return all restaurants for nearby search
      restaurantsToProcess = Object.entries(DEMO_RESTAURANTS);
    } else {
      // Find matching restaurant by name
      const searchKey = query.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
      const match = Object.entries(DEMO_RESTAURANTS).find(([key]) => 
        key.includes(searchKey) || searchKey.includes(key.replace(/-/g, ''))
      );
      if (match) {
        restaurantsToProcess = [match];
      } else {
        // Generate a fake restaurant for demo purposes
        restaurantsToProcess = [[searchKey, generateRandomRestaurant(query, userLat, userLon)]];
      }
    }

    // Process each restaurant
    const processedRestaurants: Restaurant[] = restaurantsToProcess.map(([key, data]) => {
      const reviews = data.reviews;
      const aggregatedScore = calculateAggregatedScore(reviews, config);
      const confidence = calculateConfidence(reviews);
      
      // Calculate distance and travel time if user location provided
      let distanceKm: number | undefined;
      let travelTimeMin: number | undefined;
      
      if (userLat && userLon) {
        distanceKm = calculateDistance(userLat, userLon, data.latitude, data.longitude);
        travelTimeMin = estimateTravelTime(distanceKm);
      }

      // Check if open now
      const todayHours = data.hours[dayOfWeek];
      let isOpenNow = true;
      let openUntil: string | undefined;

      if (todayHours.toLowerCase().includes('closed')) {
        isOpenNow = false;
      } else if (todayHours.toLowerCase().includes('24 hours')) {
        isOpenNow = true;
        openUntil = '24 hours';
      } else {
        // Parse hours like "Mon: 10:00 AM - 2:00 AM"
        const timeMatch = todayHours.match(/(\d{1,2}):(\d{2})\s*(AM|PM)\s*-\s*(\d{1,2}):(\d{2})\s*(AM|PM)/i);
        if (timeMatch) {
          let openHour = parseInt(timeMatch[1]);
          const openMin = parseInt(timeMatch[2]);
          const openAmPm = timeMatch[3].toUpperCase();
          let closeHour = parseInt(timeMatch[4]);
          const closeMin = parseInt(timeMatch[5]);
          const closeAmPm = timeMatch[6].toUpperCase();

          if (openAmPm === 'PM' && openHour !== 12) openHour += 12;
          if (openAmPm === 'AM' && openHour === 12) openHour = 0;
          if (closeAmPm === 'PM' && closeHour !== 12) closeHour += 12;
          if (closeAmPm === 'AM' && closeHour === 12) closeHour = 0;

          const openTimeNum = openHour * 60 + openMin;
          let closeTimeNum = closeHour * 60 + closeMin;
          const currentTimeNum = currentHour * 60 + currentMinute;

          // Handle overnight hours (e.g., 10 AM - 2 AM)
          if (closeTimeNum < openTimeNum) {
            closeTimeNum += 24 * 60;
          }

          isOpenNow = currentTimeNum >= openTimeNum && currentTimeNum < closeTimeNum;
          if (isOpenNow) {
            openUntil = `${timeMatch[4]}:${timeMatch[5]} ${timeMatch[6]}`;
          }
        }
      }

      // Build restaurant object
      const restaurant: Restaurant = {
        id: key,
        name: formatName(key),
        address: location || 'New York, NY',
        cuisine: data.cuisine,
        priceLevel: data.priceLevel,
        reviews,
        aggregatedScore,
        confidence,
        latitude: data.latitude,
        longitude: data.longitude,
        hours: data.hours,
        isOpenNow,
        openUntil,
        distanceKm: distanceKm ? Math.round(distanceKm * 10) / 10 : undefined,
        travelTimeMin,
      };

      // Calculate if exceptional and value score
      const exceptional = isExceptionalRestaurant(restaurant);
      restaurant.isExceptional = exceptional;
      
      if (travelTimeMin !== undefined) {
        restaurant.valueScore = calculateValueScore(
          aggregatedScore,
          travelTimeMin,
          maxTravelTimeMin,
          exceptional
        );
      } else {
        restaurant.valueScore = aggregatedScore;
      }

      return restaurant;
    });

    // Filter and sort
    let results = processedRestaurants;
    
    // Filter by open now if requested
    if (openNowOnly) {
      results = results.filter(r => r.isOpenNow);
    }

    // Filter by travel time (unless exceptional)
    if (userLat && userLon) {
      results = results.filter(r => 
        (r.travelTimeMin !== undefined && r.travelTimeMin <= maxTravelTimeMin) || r.isExceptional
      );
    }

    // Sort by value score (best use of time)
    results.sort((a, b) => (b.valueScore || 0) - (a.valueScore || 0));

    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Return single result or list
    if (!isNearbySearch && results.length === 1) {
      return NextResponse.json({
        restaurant: results[0],
        platformsSearched: ['google', 'yelp', 'tripadvisor', 'foursquare'],
        platformsFound: results[0].reviews.map((r) => r.platform),
        isDemo: true,
      });
    }

    return NextResponse.json({
      restaurants: results,
      totalFound: processedRestaurants.length,
      filteredCount: results.length,
      filters: {
        openNowOnly,
        maxTravelTimeMin,
        userLocation: userLat && userLon ? { lat: userLat, lon: userLon } : null,
      },
      isDemo: true,
    });
  } catch (error) {
    console.error('Demo API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

function formatName(key: string): string {
  return key
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
    .replace(/s$/, "'s"); // Handle possessives like "Katz's"
}

function generateRandomRestaurant(name: string, userLat?: number, userLon?: number): DemoRestaurant {
  const seed = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const seededRandom = (min: number, max: number, offset: number = 0) => {
    const x = Math.sin(seed + offset) * 10000;
    return min + (x - Math.floor(x)) * (max - min);
  };

  const baseRating = 3.5 + seededRandom(0, 1.3, 1);
  const platforms: PlatformReview['platform'][] = ['google', 'yelp', 'tripadvisor', 'foursquare'];
  
  // Generate location near user if provided, otherwise NYC
  const baseLat = userLat || 40.7128;
  const baseLon = userLon || -74.0060;
  
  return {
    reviews: platforms.map((platform, i) => ({
      platform,
      rating: Math.round((baseRating + seededRandom(-0.3, 0.3, i + 2)) * 10) / 10,
      reviewCount: Math.floor(100 + seededRandom(0, 1500, i + 10) * (i + 1)),
      url: `https://${platform}.com`,
    })),
    latitude: baseLat + seededRandom(-0.02, 0.02, 20),
    longitude: baseLon + seededRandom(-0.02, 0.02, 21),
    hours: [
      'Sun: 11:00 AM - 10:00 PM',
      'Mon: 11:00 AM - 10:00 PM',
      'Tue: 11:00 AM - 10:00 PM',
      'Wed: 11:00 AM - 10:00 PM',
      'Thu: 11:00 AM - 10:00 PM',
      'Fri: 11:00 AM - 11:00 PM',
      'Sat: 11:00 AM - 11:00 PM',
    ],
    cuisine: 'Restaurant',
    priceLevel: '$$',
  };
}
