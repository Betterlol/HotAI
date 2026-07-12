package integration

import (
	"testing"

	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/pkg/circuitbreaker"
	"github.com/QuantumNous/new-api/setting/config"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestBreakerBlocksOpenChannel(t *testing.T) {
	truncateTables(t)
	resetAllConfigs(t)
	resetState(t)

	seedChannel(t, 1, "breaker-a", 1, "gpt-test", "", WithWeight(10))
	seedChannel(t, 2, "breaker-b", 1, "gpt-test", "", WithWeight(10))

	cfg := config.GlobalConfig.Get("circuit_breaker_setting")
	require.NotNil(t, cfg)
	require.NoError(t, config.UpdateConfigFromMap(cfg, map[string]string{
		"enabled":              "true",
		"window_seconds":       "10",
		"bucket_seconds":       "1",
		"error_threshold":      "0.5",
		"min_request_count":    "1",
		"open_timeout_seconds": "60",
	}))
	t.Cleanup(func() {
		config.UpdateConfigFromMap(cfg, map[string]string{"enabled": "false"})
		resetState(t)
	})

	resetState(t)

	// Trip breaker for channel 1 (single failure with min_request_count=1 and threshold=0.5)
	circuitbreaker.MarkFailure(1)
	assert.Equal(t, circuitbreaker.StateOpen, circuitbreaker.GetState(1))

	for i := 0; i < 20; i++ {
		ch, err := model.GetRandomSatisfiedChannel("default", "gpt-test", 0, "")
		require.NoError(t, err)
		require.NotNil(t, ch)
		assert.Equal(t, 2, ch.Id, "only channel 2 should be selectable when channel 1 is OPEN")
	}
}

func TestBreakerEnabledPreservesHealthyChannel(t *testing.T) {
	truncateTables(t)
	resetAllConfigs(t)
	resetState(t)

	seedChannel(t, 1, "healthy", 1, "gpt-test", "", WithWeight(10))
	seedChannel(t, 2, "failing", 1, "gpt-test", "", WithWeight(10))

	cfg := config.GlobalConfig.Get("circuit_breaker_setting")
	require.NotNil(t, cfg)
	require.NoError(t, config.UpdateConfigFromMap(cfg, map[string]string{
		"enabled":              "true",
		"window_seconds":       "10",
		"bucket_seconds":       "1",
		"error_threshold":      "0.5",
		"min_request_count":    "1",
		"open_timeout_seconds": "60",
	}))
	t.Cleanup(func() {
		config.UpdateConfigFromMap(cfg, map[string]string{"enabled": "false"})
		resetState(t)
	})

	resetState(t)

	// Trip breaker for channel 2 only
	circuitbreaker.MarkFailure(2)
	assert.Equal(t, circuitbreaker.StateOpen, circuitbreaker.GetState(2))

	// Healthy channel should still be selected
	ch, err := model.GetRandomSatisfiedChannel("default", "gpt-test", 0, "")
	require.NoError(t, err)
	require.NotNil(t, ch)
	assert.Equal(t, 1, ch.Id)
}

func TestBreakerRemoveCleansUpBeforeTest(t *testing.T) {
	truncateTables(t)
	resetAllConfigs(t)
	resetState(t)

	seedChannel(t, 1, "removed", 1, "gpt-test", "", WithWeight(10))

	circuitbreaker.MarkFailure(1)

	circuitbreaker.Remove(1)
	assert.Equal(t, circuitbreaker.StateClosed, circuitbreaker.GetState(1),
		"after Remove, state should revert to default (CLOSED)")
}
