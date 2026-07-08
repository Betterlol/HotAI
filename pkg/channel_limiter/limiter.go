package channellimiter

import (
	"sync"

	"github.com/QuantumNous/new-api/setting/operation_setting"
)

var (
	mu       sync.Mutex
	inFlight = map[int]int{}
)

func CanAcquire(channelID int) bool {
	setting := operation_setting.GetChannelLimiterSetting()
	if !setting.Enabled || setting.MaxConcurrentRequests <= 0 || channelID <= 0 {
		return true
	}
	mu.Lock()
	defer mu.Unlock()
	return inFlight[channelID] < setting.MaxConcurrentRequests
}

func Acquire(channelID int) bool {
	setting := operation_setting.GetChannelLimiterSetting()
	if !setting.Enabled || setting.MaxConcurrentRequests <= 0 || channelID <= 0 {
		return true
	}
	mu.Lock()
	defer mu.Unlock()
	if inFlight[channelID] >= setting.MaxConcurrentRequests {
		return false
	}
	inFlight[channelID]++
	return true
}

func Release(channelID int) {
	if channelID <= 0 {
		return
	}
	mu.Lock()
	defer mu.Unlock()
	if inFlight[channelID] <= 1 {
		delete(inFlight, channelID)
		return
	}
	inFlight[channelID]--
}

func InFlight(channelID int) int {
	mu.Lock()
	defer mu.Unlock()
	return inFlight[channelID]
}

func ResetForTest() {
	mu.Lock()
	defer mu.Unlock()
	inFlight = map[int]int{}
}
