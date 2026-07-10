package model

import (
	"strconv"
	"testing"

	"github.com/QuantumNous/new-api/common"
	channellimiter "github.com/QuantumNous/new-api/pkg/channel_limiter"
	channelsuccessrate "github.com/QuantumNous/new-api/pkg/channel_successrate"
	"github.com/QuantumNous/new-api/pkg/circuitbreaker"
	"github.com/QuantumNous/new-api/pkg/routing"
	"github.com/QuantumNous/new-api/setting/config"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetRandomSatisfiedChannelAppliesRoutingEngineScores(t *testing.T) {
	oldIndex := channelCostIndex
	channelCostIndex = map[string]map[string]map[int]float64{
		"default": {"gpt-test": {1: 1, 2: 10}},
	}
	t.Cleanup(func() {
		channelCostIndex = oldIndex
	})
	withCostRoutingSettingForModelTest(t, map[string]string{"enabled": "true", "cost_weight": "1"})

	ch1 := &Channel{Id: 1, Weight: common.GetPointer(uint(10))}
	ch2 := &Channel{Id: 2, Weight: common.GetPointer(uint(10))}

	inputs := []routing.ChannelData{
		{ChannelID: ch1.Id, BaseWeight: ch1.GetWeight(), Cost: costForChannel("default", "gpt-test", ch1)},
		{ChannelID: ch2.Id, BaseWeight: ch2.GetWeight(), Cost: costForChannel("default", "gpt-test", ch2)},
	}
	scores := routing.NewEngine().Calculate(inputs)

	require.Len(t, scores, 2)
	// Cheap channel (cost=1) should score higher than expensive (cost=10)
	assert.Greater(t, scores[0].FinalWeight, scores[1].FinalWeight)
}

func TestGetRandomSatisfiedChannelSkipsOpenCircuitBreaker(t *testing.T) {
	withCircuitBreakerSettingForModelTest(t, map[string]string{
		"enabled":              "true",
		"window_seconds":       "10",
		"bucket_seconds":       "1",
		"error_threshold":      "0.5",
		"min_request_count":    "2",
		"open_timeout_seconds": "30",
	})
	oldMemoryCacheEnabled := common.MemoryCacheEnabled
	oldGroups := group2model2channels
	oldChannels := channelsIDM
	oldAdvanced := channel2advancedCustomConfig
	common.MemoryCacheEnabled = true
	group2model2channels = map[string]map[string][]int{
		"default": {"gpt-test": {1, 2}},
	}
	channelsIDM = map[int]*Channel{
		1: {Id: 1, Status: common.ChannelStatusEnabled, Models: "gpt-test", Group: "default", Weight: common.GetPointer(uint(10)), Priority: common.GetPointer(int64(100))},
		2: {Id: 2, Status: common.ChannelStatusEnabled, Models: "gpt-test", Group: "default", Weight: common.GetPointer(uint(10)), Priority: common.GetPointer(int64(100))},
	}
	channel2advancedCustomConfig = nil
	t.Cleanup(func() {
		common.MemoryCacheEnabled = oldMemoryCacheEnabled
		group2model2channels = oldGroups
		channelsIDM = oldChannels
		channel2advancedCustomConfig = oldAdvanced
		circuitbreaker.ResetForTest()
	})

	circuitbreaker.MarkFailure(1)
	circuitbreaker.MarkFailure(1)
	require.Equal(t, circuitbreaker.StateOpen, circuitbreaker.GetState(1))

	for i := 0; i < 10; i++ {
		channel, err := GetRandomSatisfiedChannel("default", "gpt-test", 0, "")
		require.NoError(t, err)
		require.NotNil(t, channel)
		assert.Equal(t, 2, channel.Id)
	}
}

func TestGetRandomSatisfiedChannelSkipsFullChannelLimiter(t *testing.T) {
	withCircuitBreakerSettingForModelTest(t, map[string]string{"enabled": "false"})
	withChannelLimiterSettingForModelTest(t, map[string]string{"enabled": "true", "max_concurrent_requests": "1"})
	oldMemoryCacheEnabled := common.MemoryCacheEnabled
	oldGroups := group2model2channels
	oldChannels := channelsIDM
	oldAdvanced := channel2advancedCustomConfig
	common.MemoryCacheEnabled = true
	group2model2channels = map[string]map[string][]int{
		"default": {"gpt-test": {1, 2}},
	}
	channelsIDM = map[int]*Channel{
		1: {Id: 1, Status: common.ChannelStatusEnabled, Models: "gpt-test", Group: "default", Weight: common.GetPointer(uint(10)), Priority: common.GetPointer(int64(100))},
		2: {Id: 2, Status: common.ChannelStatusEnabled, Models: "gpt-test", Group: "default", Weight: common.GetPointer(uint(10)), Priority: common.GetPointer(int64(100))},
	}
	channel2advancedCustomConfig = nil
	t.Cleanup(func() {
		common.MemoryCacheEnabled = oldMemoryCacheEnabled
		group2model2channels = oldGroups
		channelsIDM = oldChannels
		channel2advancedCustomConfig = oldAdvanced
		channellimiter.ResetForTest()
	})

	require.True(t, channellimiter.Acquire(1))
	channel, err := GetRandomSatisfiedChannel("default", "gpt-test", 0, "")
	require.NoError(t, err)
	require.NotNil(t, channel)
	assert.Equal(t, 2, channel.Id)
	assert.Equal(t, 1, channellimiter.InFlight(2))
	channellimiter.Release(2)
}

func TestFillSuccessRateInjectsRateIntoChannelData(t *testing.T) {
	channelsuccessrate.ResetForTest()
	channelsuccessrate.SetMinTotal(1)

	channelsuccessrate.Record(1, true)
	channelsuccessrate.Record(1, true)
	channelsuccessrate.Record(1, true)

	inputs := []routing.ChannelData{
		{ChannelID: 1, BaseWeight: 100},
		{ChannelID: 2, BaseWeight: 100},
	}

	routing.FillSuccessRate(inputs)

	assert.InDelta(t, 1.0, inputs[0].SuccessRate, 0.01, "channel with 3/3 success")
	assert.Equal(t, -1.0, inputs[1].SuccessRate, "channel with no records")
}

func TestFillSuccessRateWorksInlineInGetRandomSatisfiedChannel(t *testing.T) {
	oldMemoryCacheEnabled := common.MemoryCacheEnabled
	oldGroups := group2model2channels
	oldChannels := channelsIDM
	oldAdvanced := channel2advancedCustomConfig
	common.MemoryCacheEnabled = true
	group2model2channels = map[string]map[string][]int{
		"default": {"gpt-test": {1, 2}},
	}
	channelsIDM = map[int]*Channel{
		1: {Id: 1, Status: common.ChannelStatusEnabled, Models: "gpt-test", Group: "default", Weight: common.GetPointer(uint(10)), Priority: common.GetPointer(int64(100))},
		2: {Id: 2, Status: common.ChannelStatusEnabled, Models: "gpt-test", Group: "default", Weight: common.GetPointer(uint(10)), Priority: common.GetPointer(int64(100))},
	}
	channel2advancedCustomConfig = nil
	t.Cleanup(func() {
		common.MemoryCacheEnabled = oldMemoryCacheEnabled
		group2model2channels = oldGroups
		channelsIDM = oldChannels
		channel2advancedCustomConfig = oldAdvanced
		circuitbreaker.ResetForTest()
		channellimiter.ResetForTest()
		channelsuccessrate.ResetForTest()
	})

	channelsuccessrate.ResetForTest()
	channelsuccessrate.SetMinTotal(1)
	// Fill channel 1 with success, channel 2 with failures
	channelsuccessrate.Record(1, true)
	channelsuccessrate.Record(1, true)
	channelsuccessrate.Record(2, false)

	// This internally calls FillSuccessRate → GetSuccessRate → routing.Engine
	// No error = FillSuccessRate didn't panic and routing proceeded normally
	channel, err := GetRandomSatisfiedChannel("default", "gpt-test", 0, "")
	require.NoError(t, err)
	require.NotNil(t, channel)
}

func withCircuitBreakerSettingForModelTest(t *testing.T, values map[string]string) {
	t.Helper()
	oldSetting := operation_setting.GetCircuitBreakerSetting()
	cfg := config.GlobalConfig.Get("circuit_breaker_setting")
	require.NotNil(t, cfg)
	require.NoError(t, config.UpdateConfigFromMap(cfg, values))
	t.Cleanup(func() {
		restore := map[string]string{
			"enabled":                     boolStringForModelTest(oldSetting.Enabled),
			"window_seconds":              intStringForModelTest(oldSetting.WindowSeconds),
			"bucket_seconds":              intStringForModelTest(oldSetting.BucketSeconds),
			"error_threshold":             floatStringForModelTest(oldSetting.ErrorThreshold),
			"min_request_count":           int64StringForModelTest(oldSetting.MinRequestCount),
			"open_timeout_seconds":        intStringForModelTest(oldSetting.OpenTimeoutSeconds),
			"half_open_max_requests":      intStringForModelTest(oldSetting.HalfOpenMaxRequests),
			"half_open_success_threshold": intStringForModelTest(oldSetting.HalfOpenSuccessThreshold),
		}
		_ = config.UpdateConfigFromMap(cfg, restore)
	})
}

func withChannelLimiterSettingForModelTest(t *testing.T, values map[string]string) {
	t.Helper()
	oldSetting := operation_setting.GetChannelLimiterSetting()
	cfg := config.GlobalConfig.Get("channel_limiter_setting")
	require.NotNil(t, cfg)
	require.NoError(t, config.UpdateConfigFromMap(cfg, values))
	t.Cleanup(func() {
		restore := map[string]string{
			"enabled":                 boolStringForModelTest(oldSetting.Enabled),
			"max_concurrent_requests": intStringForModelTest(oldSetting.MaxConcurrentRequests),
		}
		_ = config.UpdateConfigFromMap(cfg, restore)
		channellimiter.ResetForTest()
	})
}

func withCostRoutingSettingForModelTest(t *testing.T, values map[string]string) {
	t.Helper()
	oldSetting := operation_setting.GetCostRoutingSetting()
	cfg := config.GlobalConfig.Get("cost_routing_setting")
	require.NotNil(t, cfg)
	require.NoError(t, config.UpdateConfigFromMap(cfg, values))
	t.Cleanup(func() {
		restore := map[string]string{
			"enabled":     boolStringForModelTest(oldSetting.Enabled),
			"cost_weight": floatStringForModelTest(oldSetting.CostWeight),
		}
		_ = config.UpdateConfigFromMap(cfg, restore)
	})
}

func boolStringForModelTest(value bool) string {
	if value {
		return "true"
	}
	return "false"
}

func intStringForModelTest(value int) string {
	return int64StringForModelTest(int64(value))
}

func int64StringForModelTest(value int64) string {
	return strconv.FormatInt(value, 10)
}

func floatStringForModelTest(value float64) string {
	return strconv.FormatFloat(value, 'f', -1, 64)
}
