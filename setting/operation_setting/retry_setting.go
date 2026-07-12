package operation_setting

import "github.com/QuantumNous/new-api/setting/config"

type RetrySetting struct {
	RateLimitRetryInterval int `json:"ratelimit_retry_interval"` // milliseconds
	RateLimitRetryTimes    int `json:"ratelimit_retry_times"`
}

var retrySetting = RetrySetting{
	RateLimitRetryInterval: 1000, // 1 second
	RateLimitRetryTimes:    3,
}

func init() {
	config.GlobalConfig.Register("retry_setting", &retrySetting)
}

func GetRetrySetting() RetrySetting {
	s := retrySetting
	if s.RateLimitRetryInterval <= 0 {
		s.RateLimitRetryInterval = 1000
	}
	if s.RateLimitRetryTimes <= 0 {
		s.RateLimitRetryTimes = 3
	}
	return s
}
