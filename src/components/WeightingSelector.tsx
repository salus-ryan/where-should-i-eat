'use client';

import { useState } from 'react';
import { ChevronDown, Info } from 'lucide-react';
import { WeightingStrategy, WeightingConfig } from '@/types';
import { getStrategyDescription } from '@/lib/scoring';

interface WeightingSelectorProps {
  config: WeightingConfig;
  onChange: (config: WeightingConfig) => void;
}

const STRATEGIES: { value: WeightingStrategy; label: string }[] = [
  { value: 'simple_average', label: 'Simple Average' },
  { value: 'review_count_weighted', label: 'Review Count Weighted' },
  { value: 'bayesian_average', label: 'Bayesian Average' },
  { value: 'confidence_weighted', label: 'Confidence Weighted' },
  { value: 'platform_trust', label: 'Platform Trust' },
];

const DEFAULT_PLATFORM_WEIGHTS = {
  google: 1.0,
  yelp: 1.0,
  tripadvisor: 1.0,
  foursquare: 0.9,
  zomato: 0.8,
};

export function WeightingSelector({ config, onChange }: WeightingSelectorProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleStrategyChange = (strategy: WeightingStrategy) => {
    onChange({
      ...config,
      strategy,
      platformWeights: strategy === 'platform_trust' ? DEFAULT_PLATFORM_WEIGHTS : undefined,
    });
  };

  const handlePlatformWeightChange = (platform: string, weight: number) => {
    onChange({
      ...config,
      platformWeights: {
        ...config.platformWeights,
        [platform]: weight,
      },
    });
  };

  return (
    <div className="w-full max-w-2xl mx-auto mt-4">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors text-sm"
      >
        <ChevronDown
          className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
        />
        Scoring Options
      </button>

      {isExpanded && (
        <div className="mt-3 p-4 bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Weighting Strategy
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {STRATEGIES.map((s) => (
                  <button
                    key={s.value}
                    onClick={() => handleStrategyChange(s.value)}
                    className={`px-3 py-2 text-sm rounded-lg border transition-all text-left ${
                      config.strategy === s.value
                        ? 'border-orange-500 bg-orange-50 text-orange-700'
                        : 'border-gray-200 hover:border-gray-300 text-gray-700'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-start gap-2 p-3 bg-gray-50 rounded-lg">
              <Info className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-gray-600">
                {getStrategyDescription(config.strategy)}
              </p>
            </div>

            {config.strategy === 'bayesian_average' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Prior Rating
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    step="0.1"
                    value={config.bayesianPrior ?? 3.5}
                    onChange={(e) =>
                      onChange({ ...config, bayesianPrior: parseFloat(e.target.value) })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-900"
                  />
                  <p className="text-xs text-gray-500 mt-1">Default assumption (1-5)</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Min Reviews
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={config.bayesianMinReviews ?? 10}
                    onChange={(e) =>
                      onChange({ ...config, bayesianMinReviews: parseInt(e.target.value) })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-900"
                  />
                  <p className="text-xs text-gray-500 mt-1">Threshold for full weight</p>
                </div>
              </div>
            )}

            {config.strategy === 'platform_trust' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Platform Weights
                </label>
                <div className="space-y-2">
                  {Object.entries(config.platformWeights || DEFAULT_PLATFORM_WEIGHTS).map(
                    ([platform, weight]) => (
                      <div key={platform} className="flex items-center gap-3">
                        <span className="text-sm text-gray-700 w-24 capitalize">{platform}</span>
                        <input
                          type="range"
                          min="0"
                          max="2"
                          step="0.1"
                          value={weight}
                          onChange={(e) =>
                            handlePlatformWeightChange(platform, parseFloat(e.target.value))
                          }
                          className="flex-1 accent-orange-500"
                        />
                        <span className="text-sm text-gray-600 w-12">{weight.toFixed(1)}x</span>
                      </div>
                    )
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
