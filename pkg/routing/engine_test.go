package routing

import (
	"testing"

	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCalculateLatencyScore(t *testing.T) {
	inputs := []ChannelData{
		{ChannelID: 1, BaseWeight: 100, ResponseTime: 100},
		{ChannelID: 2, BaseWeight: 100, ResponseTime: 1000},
	}

	fastest := FastestPositiveResponseTime(inputs)
	weights := make([]int, len(inputs))
	for i, ch := range inputs {
		weights[i] = LatencyAdjustedWeight(
			ch.BaseWeight, ch.ResponseTime, fastest,
			operation_setting.LatencyRoutingSetting{Enabled: true, WeightFactor: 1},
		)
	}

	assert.Equal(t, 100, weights[0], "fastest channel keeps full weight")
	assert.Equal(t, 10, weights[1], "10x slower channel gets 10%% weight")
}

func TestCalculateCostScore(t *testing.T) {
	cheap := CostAdjustedWeight(100, 1, 1, operation_setting.CostRoutingSetting{
		Enabled:    true,
		CostWeight: 1,
	})
	expensive := CostAdjustedWeight(100, 10, 1, operation_setting.CostRoutingSetting{
		Enabled:    true,
		CostWeight: 1,
	})

	assert.Equal(t, 100, cheap)
	assert.Equal(t, 10, expensive)
}

func TestCombinedChannelScore(t *testing.T) {
	inputs := []ChannelData{
		{ChannelID: 1, BaseWeight: 100, ResponseTime: 100, Cost: 1},
		{ChannelID: 2, BaseWeight: 100, ResponseTime: 1000, Cost: 10},
	}

	fastest := FastestPositiveResponseTime(inputs)
	costs := []float64{inputs[0].Cost, inputs[1].Cost}
	lowestCost := LowestPositiveCost(costs)

	latencySetting := operation_setting.LatencyRoutingSetting{Enabled: true, WeightFactor: 1}
	costSetting := operation_setting.CostRoutingSetting{Enabled: true, CostWeight: 1}

	latW0 := LatencyAdjustedWeight(inputs[0].BaseWeight, inputs[0].ResponseTime, fastest, latencySetting)
	costW0 := CostAdjustedWeight(latW0, inputs[0].Cost, lowestCost, costSetting)
	latW1 := LatencyAdjustedWeight(inputs[1].BaseWeight, inputs[1].ResponseTime, fastest, latencySetting)
	costW1 := CostAdjustedWeight(latW1, inputs[1].Cost, lowestCost, costSetting)

	assert.Greater(t, costW0, costW1, "fast+cheap should score higher than slow+expensive")
}

func TestCostRoutingDisabled(t *testing.T) {
	weight := CostAdjustedWeight(100, 10, 1, operation_setting.CostRoutingSetting{
		Enabled:    false,
		CostWeight: 1,
	})

	assert.Equal(t, 100, weight, "disabled cost routing keeps base weight unchanged")
}

func TestLatencyRoutingDisabled(t *testing.T) {
	weight := LatencyAdjustedWeight(100, 1000, 100, operation_setting.LatencyRoutingSetting{
		Enabled:      false,
		WeightFactor: 1,
	})

	assert.Equal(t, 100, weight, "disabled latency routing keeps base weight unchanged")
}

func TestChannelSelectionBehaviorUnchanged(t *testing.T) {
	inputs := []ChannelData{
		{ChannelID: 1, BaseWeight: 100, ResponseTime: 100, Cost: 1},
		{ChannelID: 2, BaseWeight: 50, ResponseTime: 200, Cost: 5},
	}

	scores := NewEngine().Calculate(inputs)
	require.Len(t, scores, 2)

	assert.Equal(t, 1, scores[0].ChannelID)
	assert.Equal(t, 2, scores[1].ChannelID)
	assert.Greater(t, scores[0].FinalWeight, 0)
	assert.Greater(t, scores[1].FinalWeight, 0)
}

func TestLatencyAdjustedWeightDisabledKeepsBaseWeight(t *testing.T) {
	weight := LatencyAdjustedWeight(100, 1000, 100, operation_setting.LatencyRoutingSetting{
		Enabled:      false,
		WeightFactor: 1,
	})

	assert.Equal(t, 100, weight)
}

func TestLatencyAdjustedWeightPenalizesSlowerChannel(t *testing.T) {
	fast := LatencyAdjustedWeight(100, 100, 100, operation_setting.LatencyRoutingSetting{
		Enabled:      true,
		WeightFactor: 1,
	})
	slow := LatencyAdjustedWeight(100, 1000, 100, operation_setting.LatencyRoutingSetting{
		Enabled:      true,
		WeightFactor: 1,
	})

	assert.Equal(t, 100, fast)
	assert.Equal(t, 10, slow)
}

func TestLatencyAdjustedWeightBlendsWithConfiguredWeightFactor(t *testing.T) {
	weight := LatencyAdjustedWeight(100, 1000, 100, operation_setting.LatencyRoutingSetting{
		Enabled:      true,
		WeightFactor: 0.3,
	})

	assert.Equal(t, 73, weight)
}

func TestLatencyAdjustedWeightIgnoresMissingResponseTimes(t *testing.T) {
	assert.Equal(t, 100, LatencyAdjustedWeight(100, 0, 100, operation_setting.LatencyRoutingSetting{Enabled: true, WeightFactor: 1}))
	assert.Equal(t, 100, LatencyAdjustedWeight(100, 100, 0, operation_setting.LatencyRoutingSetting{Enabled: true, WeightFactor: 1}))
}

func TestFastestPositiveResponseTimeSkipsMissingSamples(t *testing.T) {
	fastest := FastestPositiveResponseTime([]ChannelData{
		{ResponseTime: 0},
		{ResponseTime: 450},
		{ResponseTime: 120},
	})

	assert.Equal(t, 120, fastest)
}

func TestFastestPositiveResponseTimeAllZero(t *testing.T) {
	assert.Equal(t, 0, FastestPositiveResponseTime([]ChannelData{
		{ResponseTime: 0},
		{ResponseTime: -1},
	}))
}

func TestCostAdjustedWeightDisabledKeepsBaseWeight(t *testing.T) {
	weight := CostAdjustedWeight(100, 10, 1, operation_setting.CostRoutingSetting{
		Enabled:    false,
		CostWeight: 1,
	})

	assert.Equal(t, 100, weight)
}

func TestCostAdjustedWeightPenalizesExpensiveChannel(t *testing.T) {
	cheap := CostAdjustedWeight(100, 1, 1, operation_setting.CostRoutingSetting{
		Enabled:    true,
		CostWeight: 1,
	})
	expensive := CostAdjustedWeight(100, 10, 1, operation_setting.CostRoutingSetting{
		Enabled:    true,
		CostWeight: 1,
	})

	assert.Equal(t, 100, cheap)
	assert.Equal(t, 10, expensive)
}

func TestCostAdjustedWeightBlendsWithConfiguredWeight(t *testing.T) {
	weight := CostAdjustedWeight(100, 10, 1, operation_setting.CostRoutingSetting{
		Enabled:    true,
		CostWeight: 0.2,
	})

	assert.Equal(t, 82, weight)
}

func TestLowestPositiveCostSkipsZeroAndNegative(t *testing.T) {
	lowest := LowestPositiveCost([]float64{0, -1, 5, 3, 0})
	assert.Equal(t, 3.0, lowest)
}

func TestLowestPositiveCostAllNonPositive(t *testing.T) {
	assert.Equal(t, 0.0, LowestPositiveCost([]float64{0, -1, -5}))
}

func TestEngineCalculateEmptyInput(t *testing.T) {
	scores := NewEngine().Calculate(nil)
	assert.Nil(t, scores)
}

func TestEngineCalculateZeroBaseWeight(t *testing.T) {
	inputs := []ChannelData{
		{ChannelID: 1, BaseWeight: 0, Cost: 1},
	}
	scores := NewEngine().Calculate(inputs)
	require.Len(t, scores, 1)
	assert.Equal(t, 0, scores[0].FinalWeight)
}

func TestEngineCalculateLatencyAndCostBothEnabled(t *testing.T) {
	inputs := []ChannelData{
		{ChannelID: 1, BaseWeight: 100, ResponseTime: 50, Cost: 2},
		{ChannelID: 2, BaseWeight: 100, ResponseTime: 200, Cost: 8},
	}

	latencySetting := operation_setting.LatencyRoutingSetting{Enabled: true, WeightFactor: 1}
	costSetting := operation_setting.CostRoutingSetting{Enabled: true, CostWeight: 1}
	srSetting := operation_setting.SuccessRateRoutingSetting{Enabled: false}
	engine := NewEngineWithSettings(latencySetting, costSetting, srSetting)
	scores := engine.Calculate(inputs)

	require.Len(t, scores, 2)
	assert.Greater(t, scores[0].FinalWeight, scores[1].FinalWeight,
		"fast+cheap channel should score higher than slow+expensive")
}

func TestLatencyAdjustedWeightZeroBaseWeight(t *testing.T) {
	assert.Equal(t, 0, LatencyAdjustedWeight(0, 100, 100, operation_setting.LatencyRoutingSetting{Enabled: true, WeightFactor: 1}))
}

func TestCostAdjustedWeightZeroBaseWeight(t *testing.T) {
	assert.Equal(t, 0, CostAdjustedWeight(0, 10, 1, operation_setting.CostRoutingSetting{Enabled: true, CostWeight: 1}))
}

func TestSuccessRateAdjustedWeightDisabled(t *testing.T) {
	w := SuccessRateAdjustedWeight(100, 0.9, operation_setting.SuccessRateRoutingSetting{
		Enabled: false,
	})
	assert.Equal(t, 100, w)
}

func TestSuccessRateAdjustedWeightPenalizesLowRate(t *testing.T) {
	high := SuccessRateAdjustedWeight(100, 0.95, operation_setting.SuccessRateRoutingSetting{
		Enabled:      true,
		WeightFactor: 1,
	})
	low := SuccessRateAdjustedWeight(100, 0.5, operation_setting.SuccessRateRoutingSetting{
		Enabled:      true,
		WeightFactor: 1,
	})

	assert.Equal(t, 95, high)
	assert.Equal(t, 50, low)
}

func TestSuccessRateAdjustedWeightInsufficientData(t *testing.T) {
	w := SuccessRateAdjustedWeight(100, -1, operation_setting.SuccessRateRoutingSetting{
		Enabled:      true,
		WeightFactor: 1,
	})
	assert.Equal(t, 100, w)
}

func TestSuccessRateAdjustedWeightBlendsWithFactor(t *testing.T) {
	w := SuccessRateAdjustedWeight(100, 0.5, operation_setting.SuccessRateRoutingSetting{
		Enabled:      true,
		WeightFactor: 0.3,
	})
	// 100 * ((1-0.3) + 0.3*0.5) = 100 * (0.7 + 0.15) = 100 * 0.85 = 85
	assert.Equal(t, 85, w)
}

func TestEngineCalculateWithSuccessRate(t *testing.T) {
	inputs := []ChannelData{
		{ChannelID: 1, BaseWeight: 100, SuccessRate: 0.95},
		{ChannelID: 2, BaseWeight: 100, SuccessRate: 0.5},
	}

	srSetting := operation_setting.SuccessRateRoutingSetting{Enabled: true, WeightFactor: 1}
	engine := NewEngineWithSettings(
		operation_setting.LatencyRoutingSetting{Enabled: false},
		operation_setting.CostRoutingSetting{Enabled: false},
		srSetting,
	)
	scores := engine.Calculate(inputs)

	require.Len(t, scores, 2)
	assert.Greater(t, scores[0].FinalWeight, scores[1].FinalWeight,
		"higher success rate channel should score higher")
	assert.Equal(t, 95, scores[0].FinalWeight)
	assert.Equal(t, 50, scores[1].FinalWeight)
}

func TestEngineCalculateScoreExplanation(t *testing.T) {
	inputs := []ChannelData{
		{ChannelID: 1, BaseWeight: 100, ResponseTime: 100, Cost: 1},
	}
	scores := NewEngine().Calculate(inputs)

	require.Len(t, scores, 1)
	assert.Equal(t, 1, scores[0].ChannelID)
	assert.Equal(t, 100, scores[0].BaseWeight)
	assert.True(t, scores[0].FinalWeight > 0)
}
