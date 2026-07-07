package operation_setting

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestCircuitBreakerSettingDefaultsDisabled(t *testing.T) {
	oldSetting := circuitBreakerSetting
	t.Cleanup(func() {
		circuitBreakerSetting = oldSetting
	})
	circuitBreakerSetting = CircuitBreakerSetting{
		Enabled:                  false,
		WindowSeconds:            60,
		BucketSeconds:            10,
		ErrorThreshold:           0.5,
		MinRequestCount:          10,
		OpenTimeoutSeconds:       30,
		HalfOpenMaxRequests:      3,
		HalfOpenSuccessThreshold: 2,
	}

	setting := GetCircuitBreakerSetting()

	assert.False(t, setting.Enabled)
	assert.Equal(t, 60, setting.WindowSeconds)
	assert.Equal(t, 0.5, setting.ErrorThreshold)
}

func TestCircuitBreakerSettingClampsInvalidValues(t *testing.T) {
	oldSetting := circuitBreakerSetting
	t.Cleanup(func() {
		circuitBreakerSetting = oldSetting
	})
	circuitBreakerSetting = CircuitBreakerSetting{
		WindowSeconds:            -1,
		BucketSeconds:            -1,
		ErrorThreshold:           2,
		MinRequestCount:          -1,
		OpenTimeoutSeconds:       -1,
		HalfOpenMaxRequests:      -1,
		HalfOpenSuccessThreshold: 5,
	}

	setting := GetCircuitBreakerSetting()

	assert.Equal(t, 60, setting.WindowSeconds)
	assert.Equal(t, 10, setting.BucketSeconds)
	assert.Equal(t, float64(1), setting.ErrorThreshold)
	assert.Equal(t, int64(10), setting.MinRequestCount)
	assert.Equal(t, 30, setting.OpenTimeoutSeconds)
	assert.Equal(t, 1, setting.HalfOpenMaxRequests)
	assert.Equal(t, 1, setting.HalfOpenSuccessThreshold)
}
