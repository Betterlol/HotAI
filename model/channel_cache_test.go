package model

import (
	"strconv"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/pkg/circuitbreaker"
	"github.com/QuantumNous/new-api/setting/config"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
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
