package channellimiter

import (
	"sync"
	"sync/atomic"

	"github.com/QuantumNous/new-api/setting/operation_setting"
)

var counters sync.Map

type counter struct {
	val atomic.Int64
}

func getCounter(channelID int) *counter {
	actual, _ := counters.LoadOrStore(channelID, &counter{})
	return actual.(*counter)
}

func canAcquireLocked(channelID int, max int64) bool {
	if channelID <= 0 || max <= 0 {
		return true
	}
	c := getCounter(channelID)
	return c.val.Load() < max
}

func Acquire(channelID int) bool {
	setting := operation_setting.GetChannelLimiterSetting()
	if !setting.Enabled || setting.MaxConcurrentRequests <= 0 || channelID <= 0 {
		return true
	}
	max := int64(setting.MaxConcurrentRequests)
	c := getCounter(channelID)
	cur := c.val.Add(1)
	if cur <= max {
		return true
	}
	c.val.Add(-1)
	return false
}

func Release(channelID int) {
	if channelID <= 0 {
		return
	}
	val, ok := counters.Load(channelID)
	if !ok {
		return
	}
	c := val.(*counter)
	cur := c.val.Add(-1)
	if cur <= 0 {
		counters.Delete(channelID)
	}
}

func CanAcquire(channelID int) bool {
	setting := operation_setting.GetChannelLimiterSetting()
	if !setting.Enabled || setting.MaxConcurrentRequests <= 0 || channelID <= 0 {
		return true
	}
	return canAcquireLocked(channelID, int64(setting.MaxConcurrentRequests))
}

func InFlight(channelID int) int {
	if channelID <= 0 {
		return 0
	}
	val, ok := counters.Load(channelID)
	if !ok {
		return 0
	}
	return int(val.(*counter).val.Load())
}

func Remove(channelID int) {
	if channelID <= 0 {
		return
	}
	counters.Delete(channelID)
}

func ResetForTest() {
	counters.Range(func(key, _ interface{}) bool {
		counters.Delete(key)
		return true
	})
}
