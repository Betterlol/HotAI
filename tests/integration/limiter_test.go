package integration

import (
	"testing"

	"github.com/QuantumNous/new-api/model"
	channellimiter "github.com/QuantumNous/new-api/pkg/channel_limiter"
	"github.com/QuantumNous/new-api/setting/config"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestLimiterReleasesCorrectly(t *testing.T) {
	truncateTables(t)
	resetAllConfigs(t)

	seedChannel(t, 1, "release-test", 1, "gpt-test", "", WithWeight(10))
	model.InitChannelCache()

	limCfg := config.GlobalConfig.Get("channel_limiter_setting")
	require.NotNil(t, limCfg)
	require.NoError(t, config.UpdateConfigFromMap(limCfg, map[string]string{
		"enabled":                 "true",
		"max_concurrent_requests": "1",
	}))
	t.Cleanup(func() {
		config.UpdateConfigFromMap(limCfg, map[string]string{"enabled": "false"})
	})

	require.True(t, channellimiter.Acquire(1))
	assert.Equal(t, 1, channellimiter.InFlight(1))

	channellimiter.Release(1)
	assert.Zero(t, channellimiter.InFlight(1))

	ch, err := model.GetRandomSatisfiedChannel("default", "gpt-test", 0, "")
	require.NoError(t, err)
	require.NotNil(t, ch)
	assert.Equal(t, 1, ch.Id)
}
