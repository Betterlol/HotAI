package operation_setting

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestCostRoutingSettingDefaultsDisabled(t *testing.T) {
	oldSetting := costRoutingSetting
	t.Cleanup(func() {
		costRoutingSetting = oldSetting
	})
	costRoutingSetting = CostRoutingSetting{Enabled: false, CostWeight: 0.2}

	setting := GetCostRoutingSetting()

	assert.False(t, setting.Enabled)
	assert.Equal(t, 0.2, setting.CostWeight)
}

func TestCostRoutingSettingClampsCostWeight(t *testing.T) {
	oldSetting := costRoutingSetting
	t.Cleanup(func() {
		costRoutingSetting = oldSetting
	})

	costRoutingSetting = CostRoutingSetting{Enabled: true, CostWeight: -1}
	assert.Equal(t, float64(0), GetCostRoutingSetting().CostWeight)

	costRoutingSetting = CostRoutingSetting{Enabled: true, CostWeight: 2}
	assert.Equal(t, float64(1), GetCostRoutingSetting().CostWeight)
}
