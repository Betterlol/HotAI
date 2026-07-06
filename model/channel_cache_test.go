package model

import (
	"testing"

	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/stretchr/testify/assert"
)

func TestLatencyAdjustedWeightDisabledKeepsBaseWeight(t *testing.T) {
	weight := latencyAdjustedWeight(100, 1000, 100, operation_setting.LatencyRoutingSetting{
		Enabled:      false,
		WeightFactor: 1,
	})

	assert.Equal(t, 100, weight)
}

func TestLatencyAdjustedWeightPenalizesSlowerChannel(t *testing.T) {
	fast := latencyAdjustedWeight(100, 100, 100, operation_setting.LatencyRoutingSetting{
		Enabled:      true,
		WeightFactor: 1,
	})
	slow := latencyAdjustedWeight(100, 1000, 100, operation_setting.LatencyRoutingSetting{
		Enabled:      true,
		WeightFactor: 1,
	})

	assert.Equal(t, 100, fast)
	assert.Equal(t, 10, slow)
}

func TestLatencyAdjustedWeightBlendsWithConfiguredWeightFactor(t *testing.T) {
	weight := latencyAdjustedWeight(100, 1000, 100, operation_setting.LatencyRoutingSetting{
		Enabled:      true,
		WeightFactor: 0.3,
	})

	assert.Equal(t, 73, weight)
}

func TestLatencyAdjustedWeightIgnoresMissingResponseTimes(t *testing.T) {
	assert.Equal(t, 100, latencyAdjustedWeight(100, 0, 100, operation_setting.LatencyRoutingSetting{Enabled: true, WeightFactor: 1}))
	assert.Equal(t, 100, latencyAdjustedWeight(100, 100, 0, operation_setting.LatencyRoutingSetting{Enabled: true, WeightFactor: 1}))
}

func TestFastestPositiveResponseTimeSkipsMissingSamples(t *testing.T) {
	fastest := fastestPositiveResponseTime([]*Channel{
		{Id: 1, ResponseTime: 0},
		{Id: 2, ResponseTime: 450},
		{Id: 3, ResponseTime: 120},
	})

	assert.Equal(t, 120, fastest)
}
