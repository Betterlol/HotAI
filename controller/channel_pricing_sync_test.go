package controller

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestPricePerTokenConversion(t *testing.T) {
	tests := []struct {
		name     string
		ratio    float64
		expected float64
	}{
		{"gpt-4o-mini (ratio=0.075)", 0.075, 0.00000015},
		{"gpt-4o (ratio=1)", 1, 0.000002},
		{"deepseek-chat (ratio=0.125)", 0.125, 0.00000025},
		{"zero ratio", 0, 0},
		{"large ratio", 100, 0.0002},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := tt.ratio * pricePerTokenFactor
			assert.InDelta(t, tt.expected, got, 1e-12)
		})
	}
}

func TestSyncChannelPricingBuildsMapping(t *testing.T) {
	ch := createTestChannelForPricing(t, "gpt-4o,gpt-4o-mini,unknown-model")
	assert.NotNil(t, ch)

	modelRatioMap := map[string]float64{
		"gpt-4o":      1,
		"gpt-4o-mini": 0.075,
	}
	modelPriceMap := map[string]float64{
		"dall-e-3": 0.04,
	}

	models := []string{"gpt-4o", "gpt-4o-mini", "unknown-model"}
	mapping := buildTestPriceMapping(models, modelRatioMap, modelPriceMap)

	assert.Contains(t, mapping, "gpt-4o")
	assert.Contains(t, mapping, "gpt-4o-mini")
	assert.NotContains(t, mapping, "unknown-model")

	assert.InDelta(t, 0.000002, mapping["gpt-4o"]["price_per_token"], 1e-12)
	assert.NotContains(t, mapping["gpt-4o"], "price_per_request")

	assert.InDelta(t, 0.00000015, mapping["gpt-4o-mini"]["price_per_token"], 1e-12)
}

func buildTestPriceMapping(models []string, modelRatioMap, modelPriceMap map[string]float64) map[string]map[string]float64 {
	mapping := make(map[string]map[string]float64)
	for _, modelName := range models {
		if modelName == "" {
			continue
		}
		entry := make(map[string]float64)
		hasPrice := false

		if ratio, ok := modelRatioMap[modelName]; ok && ratio > 0 {
			pricePerToken := ratio * pricePerTokenFactor
			if pricePerToken > 0 {
				entry["price_per_token"] = pricePerToken
				hasPrice = true
			}
		}
		if price, ok := modelPriceMap[modelName]; ok && price > 0 {
			entry["price_per_request"] = price
			hasPrice = true
		}
		if hasPrice {
			mapping[modelName] = entry
		}
	}
	return mapping
}

func createTestChannelForPricing(t *testing.T, models string) interface{} {
	return struct{ Models string }{Models: models}
}
