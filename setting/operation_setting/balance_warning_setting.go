package operation_setting

import "github.com/QuantumNous/new-api/setting/config"

type BalanceWarningSetting struct {
	Enabled   bool    `json:"enabled"`
	Threshold float64 `json:"threshold"` // USD, e.g. 10.0
}

var balanceWarningSetting = BalanceWarningSetting{
	Enabled:   false,
	Threshold: 10.0,
}

func init() {
	config.GlobalConfig.Register("balance_warning_setting", &balanceWarningSetting)
}

func GetBalanceWarningSetting() BalanceWarningSetting {
	setting := balanceWarningSetting
	if setting.Threshold < 0 {
		setting.Threshold = 0
	}
	return setting
}
