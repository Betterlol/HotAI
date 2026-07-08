package routing

import (
	"github.com/QuantumNous/new-api/setting/operation_setting"
)

// Engine computes channel scores by combining latency, cost, and
// health dimensions. Each dimension is a separate scoring function
// so new dimensions can be added without changing the core logic.
type Engine struct {
	latencySetting operation_setting.LatencyRoutingSetting
	costSetting    operation_setting.CostRoutingSetting
}

// NewEngine creates an Engine with the current operation settings.
func NewEngine() *Engine {
	return &Engine{
		latencySetting: operation_setting.GetLatencyRoutingSetting(),
		costSetting:    operation_setting.GetCostRoutingSetting(),
	}
}

// NewEngineWithSettings creates an Engine with explicit settings,
// primarily used for testing.
func NewEngineWithSettings(
	latency operation_setting.LatencyRoutingSetting,
	cost operation_setting.CostRoutingSetting,
) *Engine {
	return &Engine{
		latencySetting: latency,
		costSetting:    cost,
	}
}

// Calculate produces a ChannelScore for each input channel.
//
// The scoring pipeline is:
//
//	BaseWeight → LatencyAdjustedWeight → CostAdjustedWeight → FinalWeight
//
// Future dimensions (SuccessRate, Balance, etc.) are inserted
// between CostAdjustedWeight and FinalWeight.
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

		scores[i] = ChannelScore{
			ChannelID:             ch.ChannelID,
			FinalWeight:           costWeight,
			BaseWeight:            ch.BaseWeight,
			LatencyAdjustedWeight: latencyWeight,
			CostAdjustedWeight:    costWeight,
		}
	}
	return scores
}
