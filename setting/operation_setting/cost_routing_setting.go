package operation_setting

import "github.com/QuantumNous/new-api/setting/config"

type CostRoutingSetting struct {
	Enabled    bool    `json:"enabled"`
	CostWeight float64 `json:"cost_weight"`
}

var costRoutingSetting = CostRoutingSetting{
	Enabled:    false,
	CostWeight: 0.2,
}

func init() {
	config.GlobalConfig.Register("cost_routing_setting", &costRoutingSetting)
}

func GetCostRoutingSetting() CostRoutingSetting {
	setting := costRoutingSetting
	if setting.CostWeight < 0 {
		setting.CostWeight = 0
	}
	if setting.CostWeight > 1 {
		setting.CostWeight = 1
	}
	return setting
}
