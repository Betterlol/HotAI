package routing

import (
	"github.com/QuantumNous/new-api/setting/operation_setting"
)

// Engine computes channel scores by combining latency, cost, and
// success rate dimensions. Each dimension is a separate scoring function
// so new dimensions can be added without changing the core logic.
type Engine struct {
	latencySetting    operation_setting.LatencyRoutingSetting
	costSetting       operation_setting.CostRoutingSetting
	successRateSetting operation_setting.SuccessRateRoutingSetting
}

// NewEngine creates an Engine with the current operation settings.
func NewEngine() *Engine {
	return &Engine{
		latencySetting:     operation_setting.GetLatencyRoutingSetting(),
		costSetting:        operation_setting.GetCostRoutingSetting(),
		successRateSetting: operation_setting.GetSuccessRateRoutingSetting(),
	}
}

// NewEngineWithSettings creates an Engine with explicit settings,
// primarily used for testing.
func NewEngineWithSettings(
	latency operation_setting.LatencyRoutingSetting,
	cost operation_setting.CostRoutingSetting,
	successRate operation_setting.SuccessRateRoutingSetting,
) *Engine {
	return &Engine{
		latencySetting:     latency,
		costSetting:        cost,
		successRateSetting: successRate,
	}
}

// Calculate produces a ChannelScore for each input channel.
//
// The scoring pipeline is:
//
//	BaseWeight → LatencyAdjustedWeight → CostAdjustedWeight
//	→ SuccessRateAdjustedWeight → FinalWeight
//
// Future dimensions (Balance, etc.) are inserted after SuccessRateAdjustedWeight.
func (e *Engine) Calculate(channels []ChannelData) []ChannelScore {
	if len(channels) == 0 {
		return nil
	}

	fastestRT := FastestPositiveResponseTime(channels)
	costs := make([]float64, len(channels))
	for i, ch := range channels {
		costs[i] = ch.Cost
	}
	lowestCost := LowestPositiveCost(costs)

	scores := make([]ChannelScore, len(channels))
	for i, ch := range channels {
		latencyWeight := LatencyAdjustedWeight(ch.BaseWeight, ch.ResponseTime, fastestRT, e.latencySetting)
		costWeight := CostAdjustedWeight(latencyWeight, ch.Cost, lowestCost, e.costSetting)
		successRateWeight := SuccessRateAdjustedWeight(costWeight, ch.SuccessRate, e.successRateSetting)

		scores[i] = ChannelScore{
			ChannelID:                  ch.ChannelID,
			FinalWeight:                successRateWeight,
			BaseWeight:                 ch.BaseWeight,
			LatencyAdjustedWeight:      latencyWeight,
			CostAdjustedWeight:         costWeight,
			SuccessRateAdjustedWeight:  successRateWeight,
		}
	}
	return scores
}
