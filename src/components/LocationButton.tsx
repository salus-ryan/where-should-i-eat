'use client';

import { useState } from 'react';
import { MapPin, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { getCurrentPosition, reverseGeocode, Coordinates } from '@/lib/geolocation';

interface LocationButtonProps {
  onLocationObtained: (coords: Coordinates, locationName: string) => void;
  currentLocation: string | null;
  isLoading?: boolean;
}

export function LocationButton({ onLocationObtained, currentLocation, isLoading: externalLoading }: LocationButtonProps) {
  const [internalLoading, setInternalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const isLoading = externalLoading || internalLoading;

  const handleGetLocation = async () => {
    setInternalLoading(true);
    setError(null);

    try {
      const coords = await getCurrentPosition();
      const locationName = await reverseGeocode(coords);
      onLocationObtained(coords, locationName);
    } catch (err) {
      const error = err as { message: string };
      setError(error.message);
    } finally {
      setInternalLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        onClick={handleGetLocation}
        disabled={isLoading}
        className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
          currentLocation
            ? 'bg-green-100 text-green-700 border border-green-200'
            : 'bg-white text-gray-700 border border-gray-200 hover:border-orange-300 hover:bg-orange-50'
        }`}
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Getting location...
          </>
        ) : currentLocation ? (
          <>
            <CheckCircle className="w-4 h-4" />
            {currentLocation}
          </>
        ) : (
          <>
            <MapPin className="w-4 h-4" />
            Use my location
          </>
        )}
      </button>
      {error && (
        <div className="flex items-center gap-1 text-xs text-red-600">
          <XCircle className="w-3 h-3" />
          {error}
        </div>
      )}
    </div>
  );
}
