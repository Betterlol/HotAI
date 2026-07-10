package circuitbreaker

import (
	"strconv"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/setting/config"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCircuitBreakerDisabledAllowsSelection(t *testing.T) {
	withCircuitBreakerSetting(t, map[string]string{"enabled": "false"})
	ResetForTest()

	MarkFailure(1)
	MarkFailure(1)

	assert.True(t, CanSelect(1))
	assert.True(t, MarkSelected(1))
	assert.Equal(t, StateClosed, GetState(1))
}

func TestCircuitBreakerOpensAndRecoversThroughHalfOpen(t *testing.T) {
	withCircuitBreakerSetting(t, map[string]string{
		"enabled":                     "true",
		"window_seconds":              "10",
		"bucket_seconds":              "1",
		"error_threshold":             "0.5",
		"min_request_count":           "2",
		"open_timeout_seconds":        "1",
		"half_open_max_requests":      "1",
		"half_open_success_threshold": "1",
	})
	ResetForTest()

	MarkFailure(7)
	assert.Equal(t, StateClosed, GetState(7))
	MarkFailure(7)

	assert.Equal(t, StateOpen, GetState(7))
	assert.False(t, CanSelect(7))

	time.Sleep(1100 * time.Millisecond)
	assert.Equal(t, StateHalfOpen, GetState(7))
	assert.True(t, CanSelect(7))
	assert.True(t, MarkSelected(7))
	assert.False(t, CanSelect(7))

	MarkSuccess(7)
	assert.Equal(t, StateClosed, GetState(7))
	assert.True(t, CanSelect(7))
}

func TestCircuitBreakerHalfOpenFailureReopens(t *testing.T) {
	withCircuitBreakerSetting(t, map[string]string{
		"enabled":                     "true",
		"window_seconds":              "10",
		"bucket_seconds":              "1",
		"error_threshold":             "0.5",
		"min_request_count":           "2",
		"open_timeout_seconds":        "1",
		"half_open_max_requests":      "1",
		"half_open_success_threshold": "1",
	})
	ResetForTest()

	MarkFailure(9)
	MarkFailure(9)
	require.Equal(t, StateOpen, GetState(9))

	time.Sleep(1100 * time.Millisecond)
	require.True(t, MarkSelected(9))
	MarkFailure(9)

	assert.Equal(t, StateOpen, GetState(9))
	assert.False(t, CanSelect(9))
}

func withCircuitBreakerSetting(t *testing.T, values map[string]string) {
	t.Helper()
	oldSetting := operation_setting.GetCircuitBreakerSetting()
	cfg := config.GlobalConfig.Get("circuit_breaker_setting")
	require.NotNil(t, cfg)
	require.NoError(t, config.UpdateConfigFromMap(cfg, values))
	t.Cleanup(func() {
		restore := map[string]string{
			"enabled":                     boolString(oldSetting.Enabled),
			"window_seconds":              intString(oldSetting.WindowSeconds),
			"bucket_seconds":              intString(oldSetting.BucketSeconds),
			"error_threshold":             floatString(oldSetting.ErrorThreshold),
			"min_request_count":           int64String(oldSetting.MinRequestCount),
			"open_timeout_seconds":        intString(oldSetting.OpenTimeoutSeconds),
			"half_open_max_requests":      intString(oldSetting.HalfOpenMaxRequests),
			"half_open_success_threshold": intString(oldSetting.HalfOpenSuccessThreshold),
		}
		_ = config.UpdateConfigFromMap(cfg, restore)
		ResetForTest()
	})
}

func boolString(value bool) string {
	if value {
		return "true"
	}
	return "false"
}

func TestCircuitBreakerRemoveCleansUp(t *testing.T) {
	withCircuitBreakerSetting(t, map[string]string{
		"enabled":              "true",
		"window_seconds":       "10",
		"bucket_seconds":       "1",
		"error_threshold":      "0.5",
		"min_request_count":    "1",
		"open_timeout_seconds": "30",
	})
	ResetForTest()

	MarkFailure(99)
	MarkFailure(99)
	assert.Equal(t, StateOpen, GetState(99))

	Remove(99)
	assert.Equal(t, StateClosed, GetState(99))
}

func intString(value int) string {
	return int64String(int64(value))
}

func int64String(value int64) string {
	return strconv.FormatInt(value, 10)
}

func floatString(value float64) string {
	return strconv.FormatFloat(value, 'f', -1, 64)
}
