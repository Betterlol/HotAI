package operation_setting

import "github.com/QuantumNous/new-api/setting/config"

type CircuitBreakerSetting struct {
	Enabled                  bool    `json:"enabled"`
	WindowSeconds            int     `json:"window_seconds"`
	BucketSeconds            int     `json:"bucket_seconds"`
	ErrorThreshold           float64 `json:"error_threshold"`
	MinRequestCount          int64   `json:"min_request_count"`
	OpenTimeoutSeconds       int     `json:"open_timeout_seconds"`
	HalfOpenMaxRequests      int     `json:"half_open_max_requests"`
	HalfOpenSuccessThreshold int     `json:"half_open_success_threshold"`
}

var circuitBreakerSetting = CircuitBreakerSetting{
	Enabled:                  false,
	WindowSeconds:            60,
	BucketSeconds:            10,
	ErrorThreshold:           0.5,
	MinRequestCount:          10,
	OpenTimeoutSeconds:       30,
	HalfOpenMaxRequests:      3,
	HalfOpenSuccessThreshold: 2,
}

func init() {
	config.GlobalConfig.Register("circuit_breaker_setting", &circuitBreakerSetting)
}

func GetCircuitBreakerSetting() CircuitBreakerSetting {
	setting := circuitBreakerSetting
	if setting.WindowSeconds <= 0 {
		setting.WindowSeconds = 60
	}
	if setting.BucketSeconds <= 0 || setting.BucketSeconds > setting.WindowSeconds {
		setting.BucketSeconds = 10
	}
	if setting.ErrorThreshold < 0 {
		setting.ErrorThreshold = 0
	}
	if setting.ErrorThreshold > 1 {
		setting.ErrorThreshold = 1
	}
	if setting.MinRequestCount <= 0 {
		setting.MinRequestCount = 10
	}
	if setting.OpenTimeoutSeconds <= 0 {
		setting.OpenTimeoutSeconds = 30
	}
	if setting.HalfOpenMaxRequests <= 0 {
		setting.HalfOpenMaxRequests = 1
	}
	if setting.HalfOpenSuccessThreshold <= 0 {
		setting.HalfOpenSuccessThreshold = 1
	}
	if setting.HalfOpenSuccessThreshold > setting.HalfOpenMaxRequests {
		setting.HalfOpenSuccessThreshold = setting.HalfOpenMaxRequests
	}
	return setting
}
