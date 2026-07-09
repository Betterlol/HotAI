package operation_setting

import "github.com/QuantumNous/new-api/setting/config"

type SuccessRateRoutingSetting struct {
	Enabled      bool    `json:"enabled"`
	WeightFactor float64 `json:"weight_factor"`
	WindowMinutes int    `json:"window_minutes"`
	MinSamples   int64   `json:"min_samples"`
}

var successRateRoutingSetting = SuccessRateRoutingSetting{
	Enabled:       false,
	WeightFactor:  0.3,
	WindowMinutes: 5,
	MinSamples:    10,
}

func init() {
	config.GlobalConfig.Register("success_rate_routing_setting", &successRateRoutingSetting)
}

func GetSuccessRateRoutingSetting() SuccessRateRoutingSetting {
	setting := successRateRoutingSetting
	if setting.WeightFactor < 0 {
		setting.WeightFactor = 0
	}
	if setting.WeightFactor > 1 {
		setting.WeightFactor = 1
	}
	if setting.WindowMinutes < 1 {
		setting.WindowMinutes = 1
	}
	if setting.MinSamples < 1 {
		setting.MinSamples = 1
	}
	return setting
}
