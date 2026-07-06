package operation_setting

import "github.com/QuantumNous/new-api/setting/config"

type LatencyRoutingSetting struct {
	Enabled      bool    `json:"enabled"`
	WeightFactor float64 `json:"weight_factor"`
}

var latencyRoutingSetting = LatencyRoutingSetting{
	Enabled:      false,
	WeightFactor: 0.3,
}

func init() {
	config.GlobalConfig.Register("latency_routing_setting", &latencyRoutingSetting)
}

func GetLatencyRoutingSetting() LatencyRoutingSetting {
	setting := latencyRoutingSetting
	if setting.WeightFactor < 0 {
		setting.WeightFactor = 0
	}
	if setting.WeightFactor > 1 {
		setting.WeightFactor = 1
	}
	return setting
}
