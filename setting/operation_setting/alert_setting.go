package operation_setting

import "github.com/QuantumNous/new-api/setting/config"

type AlertSetting struct {
	Enabled                 bool     `json:"enabled"`
	SuccessRateDropEnabled  bool     `json:"success_rate_drop_enabled"`
	ModelUnavailableEnabled bool     `json:"model_unavailable_enabled"`
	SuccessRateThreshold    float64  `json:"success_rate_threshold"`
}

var alertSetting = AlertSetting{
	Enabled:                 false,
	SuccessRateDropEnabled:  true,
	ModelUnavailableEnabled: true,
	SuccessRateThreshold:    95,
}

func init() {
	config.GlobalConfig.Register("alert_setting", &alertSetting)
}

func GetAlertSetting() AlertSetting {
	setting := alertSetting
	if setting.SuccessRateThreshold <= 0 || setting.SuccessRateThreshold > 100 {
		setting.SuccessRateThreshold = 95
	}
	return setting
}
