package integration

import (
	"testing"

	"github.com/QuantumNous/new-api/model"
	channelsuccessrate "github.com/QuantumNous/new-api/pkg/channel_successrate"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCostRoutingPrefersCheaperChannel(t *testing.T) {
	truncateTables(t)
	resetAllConfigs(t)

	seedChannel(t, 1, "cheap", 1, "gpt-test", "", WithWeight(10))
	seedChannel(t, 2, "expensive", 1, "gpt-test", "", WithWeight(10))
	seedChannel(t, 3, "other", 1, "other-model", "", WithWeight(10))

	ch1, _ := model.GetChannelById(1, false)
	ch2, _ := model.GetChannelById(2, false)

	priceMapping1 := `{"gpt-test": {"price_per_token": 0.000001}}`
	priceMapping2 := `{"gpt-test": {"price_per_token": 0.00001}}`
	ch1.PriceMapping = &priceMapping1
	ch2.PriceMapping = &priceMapping2
	require.NoError(t, ch1.Update())
	require.NoError(t, ch2.Update())

	guardCostRouting(t, "true", "1")
	resetState(t)

	cheapCount := 0
	for i := 0; i < 50; i++ {
		ch, err := model.GetRandomSatisfiedChannel("default", "gpt-test", 0, "")
		require.NoError(t, err)
		require.NotNil(t, ch)
		if ch.Id == 1 {
			cheapCount++
		}
	}
	// Cheap channel should be selected significantly more often
	assert.Greater(t, cheapCount, 35, "cheap channel should win >70%% of selections")
}

func TestLatencyRoutingPrefersFasterChannel(t *testing.T) {
	truncateTables(t)
	resetAllConfigs(t)

	seedChannel(t, 1, "fast", 1, "gpt-test", "", WithWeight(10), WithResponseTime(50))
	seedChannel(t, 2, "slow", 1, "gpt-test", "", WithWeight(10), WithResponseTime(500))
	resetState(t)

	guardLatencyRouting(t, "true", "1")

	fastCount := 0
	for i := 0; i < 50; i++ {
		ch, err := model.GetRandomSatisfiedChannel("default", "gpt-test", 0, "")
		require.NoError(t, err)
		require.NotNil(t, ch)
		if ch.Id == 1 {
			fastCount++
		}
	}
	assert.Greater(t, fastCount, 35, "fast channel should win >70%% of selections")
}

func TestSuccessRateRoutingPenalizesFailingChannel(t *testing.T) {
	truncateTables(t)
	resetAllConfigs(t)

	seedChannel(t, 1, "healthy", 1, "gpt-test", "", WithWeight(10))
	seedChannel(t, 2, "failing", 1, "gpt-test", "", WithWeight(10))
	resetState(t)

	guardSuccessRateRouting(t, "true", "1")

	// Lower min samples so our 3 records per channel are sufficient
	channelsuccessrate.SetMinTotal(1)

	// Pre-populate success rate: channel 1 is healthy, channel 2 is failing
	channelsuccessrate.Record(1, true)
	channelsuccessrate.Record(1, true)
	channelsuccessrate.Record(1, true)
	channelsuccessrate.Record(2, false)
	channelsuccessrate.Record(2, false)
	channelsuccessrate.Record(2, false)

	healthyCount := 0
	for i := 0; i < 50; i++ {
		ch, err := model.GetRandomSatisfiedChannel("default", "gpt-test", 0, "")
		require.NoError(t, err)
		require.NotNil(t, ch)
		if ch.Id == 1 {
			healthyCount++
		}
	}
	assert.Greater(t, healthyCount, 35, "healthy channel should win >70%% of selections")
}

func TestMultipleRoutingDimensionsCombine(t *testing.T) {
	truncateTables(t)
	resetAllConfigs(t)

	seedChannel(t, 1, "best", 1, "gpt-test", "", WithWeight(10), WithResponseTime(50))
	seedChannel(t, 2, "worst", 1, "gpt-test", "", WithWeight(10), WithResponseTime(500))

	ch1, _ := model.GetChannelById(1, false)
	ch2, _ := model.GetChannelById(2, false)
	priceMapping1 := `{"gpt-test": {"price_per_token": 0.000001}}`
	priceMapping2 := `{"gpt-test": {"price_per_token": 0.00001}}`
	ch1.PriceMapping = &priceMapping1
	ch2.PriceMapping = &priceMapping2
	require.NoError(t, ch1.Update())
	require.NoError(t, ch2.Update())

	resetState(t)

	guardCostRouting(t, "true", "1")
	guardLatencyRouting(t, "true", "1")
	guardSuccessRateRouting(t, "true", "1")

	channelsuccessrate.SetMinTotal(1)
	channelsuccessrate.Record(1, true)
	channelsuccessrate.Record(1, true)
	channelsuccessrate.Record(1, true)
	channelsuccessrate.Record(2, false)
	channelsuccessrate.Record(2, false)
	channelsuccessrate.Record(2, false)

	bestCount := 0
	for i := 0; i < 50; i++ {
		ch, err := model.GetRandomSatisfiedChannel("default", "gpt-test", 0, "")
		require.NoError(t, err)
		require.NotNil(t, ch)
		if ch.Id == 1 {
			bestCount++
		}
	}
	assert.Greater(t, bestCount, 40, "best channel (fast+cheap+healthy) should dominate with >80%% selection")
}
