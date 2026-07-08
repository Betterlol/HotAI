package channellimiter

import (
	"strconv"
	"testing"

	"github.com/QuantumNous/new-api/setting/config"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestLimiterDisabledAllowsAcquire(t *testing.T) {
	withLimiterSetting(t, map[string]string{"enabled": "false", "max_concurrent_requests": "1"})
	ResetForTest()

	assert.True(t, Acquire(1))
	assert.True(t, Acquire(1))
	assert.Zero(t, InFlight(1))
}

func TestLimiterEnforcesMaxConcurrentRequests(t *testing.T) {
	withLimiterSetting(t, map[string]string{"enabled": "true", "max_concurrent_requests": "1"})
	ResetForTest()

	assert.True(t, Acquire(1))
	assert.False(t, Acquire(1))
	assert.Equal(t, 1, InFlight(1))

	Release(1)
	assert.Zero(t, InFlight(1))
	assert.True(t, Acquire(1))
}

func TestReleaseClearsInFlightAfterLimiterDisabled(t *testing.T) {
	withLimiterSetting(t, map[string]string{"enabled": "true", "max_concurrent_requests": "1"})
	ResetForTest()
	require.True(t, Acquire(1))
	require.Equal(t, 1, InFlight(1))

	cfg := config.GlobalConfig.Get("channel_limiter_setting")
	require.NotNil(t, cfg)
	require.NoError(t, config.UpdateConfigFromMap(cfg, map[string]string{"enabled": "false", "max_concurrent_requests": "1"}))

	Release(1)
	assert.Zero(t, InFlight(1))
}

func withLimiterSetting(t *testing.T, values map[string]string) {
	t.Helper()
	oldSetting := operation_setting.GetChannelLimiterSetting()
	cfg := config.GlobalConfig.Get("channel_limiter_setting")
	require.NotNil(t, cfg)
	require.NoError(t, config.UpdateConfigFromMap(cfg, values))
	t.Cleanup(func() {
		restore := map[string]string{
			"enabled":                 boolStringForLimiterTest(oldSetting.Enabled),
			"max_concurrent_requests": intStringForLimiterTest(oldSetting.MaxConcurrentRequests),
		}
		_ = config.UpdateConfigFromMap(cfg, restore)
		ResetForTest()
	})
}

func boolStringForLimiterTest(value bool) string {
	if value {
		return "true"
	}
	return "false"
}

func intStringForLimiterTest(value int) string {
	return strconv.Itoa(value)
}
