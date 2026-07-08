package operation_setting

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestChannelLimiterSettingDefaultsDisabled(t *testing.T) {
	oldSetting := channelLimiterSetting
	t.Cleanup(func() {
		channelLimiterSetting = oldSetting
	})
	channelLimiterSetting = ChannelLimiterSetting{Enabled: false, MaxConcurrentRequests: 0}

	setting := GetChannelLimiterSetting()

	assert.False(t, setting.Enabled)
	assert.Zero(t, setting.MaxConcurrentRequests)
}

func TestChannelLimiterSettingClampsInvalidValues(t *testing.T) {
	oldSetting := channelLimiterSetting
	t.Cleanup(func() {
		channelLimiterSetting = oldSetting
	})
	channelLimiterSetting = ChannelLimiterSetting{Enabled: true, MaxConcurrentRequests: -1}

	setting := GetChannelLimiterSetting()

	assert.True(t, setting.Enabled)
	assert.Zero(t, setting.MaxConcurrentRequests)
}
