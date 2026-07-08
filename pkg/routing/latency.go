package routing

import "github.com/QuantumNous/new-api/setting/operation_setting"

// FastestPositiveResponseTime returns the smallest positive response time
// from the given channel data. Channels with zero or negative response
// time are skipped.
func FastestPositiveResponseTime(channels []ChannelData) int {
	fastest := 0
	for _, ch := range channels {
		if ch.ResponseTime <= 0 {
			continue
		}
		if fastest == 0 || ch.ResponseTime < fastest {
			fastest = ch.ResponseTime
		}
	}
	return fastest
}

// LatencyAdjustedWeight adjusts baseWeight by the channel's response time
// relative to the fastest channel. When latency routing is disabled or
// data is missing, baseWeight is returned unchanged.
func LatencyAdjustedWeight(baseWeight int, responseTime int, fastestResponseTime int, setting operation_setting.LatencyRoutingSetting) int {
	if baseWeight <= 0 {
		return 0
	}
	if !setting.Enabled || fastestResponseTime <= 0 || responseTime <= 0 {
		return baseWeight
	}
	factor := setting.WeightFactor
	if factor < 0 {
		factor = 0
	}
	if factor > 1 {
		factor = 1
	}
	latencyRatio := float64(fastestResponseTime) / float64(responseTime)
	adjusted := int(float64(baseWeight) * ((1 - factor) + factor*latencyRatio))
	if adjusted < 1 {
		return 1
	}
	return adjusted
}

// LowestPositiveCost returns the smallest positive cost from the given
// slice. Zero and negative values are skipped.
func LowestPositiveCost(costs []float64) float64 {
	lowest := 0.0
	for _, cost := range costs {
		if cost <= 0 {
			continue
		}
		if lowest == 0 || cost < lowest {
			lowest = cost
		}
	}
	return lowest
}
