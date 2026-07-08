package operation_setting

import "github.com/QuantumNous/new-api/setting/config"

type ChannelLimiterSetting struct {
	Enabled               bool `json:"enabled"`
	MaxConcurrentRequests int  `json:"max_concurrent_requests"`
}

var channelLimiterSetting = ChannelLimiterSetting{
	Enabled:               false,
	MaxConcurrentRequests: 0,
}

func init() {
	config.GlobalConfig.Register("channel_limiter_setting", &channelLimiterSetting)
}

func GetChannelLimiterSetting() ChannelLimiterSetting {
	setting := channelLimiterSetting
	if setting.MaxConcurrentRequests < 0 {
		setting.MaxConcurrentRequests = 0
	}
	return setting
}
