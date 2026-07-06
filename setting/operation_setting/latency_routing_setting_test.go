package operation_setting

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestLatencyRoutingSettingDefaultsDisabled(t *testing.T) {
	oldSetting := latencyRoutingSetting
	t.Cleanup(func() {
		latencyRoutingSetting = oldSetting
	})
	latencyRoutingSetting = LatencyRoutingSetting{Enabled: false, WeightFactor: 0.3}

	setting := GetLatencyRoutingSetting()

	assert.False(t, setting.Enabled)
	assert.Equal(t, 0.3, setting.WeightFactor)
}

func TestLatencyRoutingSettingClampsWeightFactor(t *testing.T) {
	oldSetting := latencyRoutingSetting
	t.Cleanup(func() {
		latencyRoutingSetting = oldSetting
	})

	latencyRoutingSetting = LatencyRoutingSetting{Enabled: true, WeightFactor: -1}
	assert.Equal(t, float64(0), GetLatencyRoutingSetting().WeightFactor)

	latencyRoutingSetting = LatencyRoutingSetting{Enabled: true, WeightFactor: 2}
	assert.Equal(t, float64(1), GetLatencyRoutingSetting().WeightFactor)
}
