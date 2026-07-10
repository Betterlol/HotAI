package channelsuccessrate

import (
	"sync"
	"sync/atomic"
	"time"
)

type channelStats struct {
	currTotal   atomic.Int64
	currSuccess atomic.Int64
	prevTotal   atomic.Int64
	prevSuccess atomic.Int64
	windowStart atomic.Int64
}

var (
	windows    sync.Map
	windowDur  = 5 * time.Minute
	windowNano = windowDur.Nanoseconds()
	minTotal   = int64(10)
)

// SetWindowDuration overrides the sliding window size (for testing).
func SetWindowDuration(d time.Duration) {
	windowDur = d
	windowNano = d.Nanoseconds()
}

// SetMinTotal overrides the minimum sample count (for testing).
func SetMinTotal(n int64) {
	minTotal = n
}

// ResetForTest clears all tracked state.
func ResetForTest() {
	windows.Range(func(key, _ interface{}) bool {
		windows.Delete(key)
		return true
	})
}

func getOrCreate(channelID int) *channelStats {
	actual, _ := windows.LoadOrStore(channelID, &channelStats{
		windowStart: atomic.Int64{},
	})
	s := actual.(*channelStats)
	s.windowStart.CompareAndSwap(0, time.Now().UnixNano())
	return s
}

// Record records a success or failure for the given channel.
func Record(channelID int, success bool) {
	if channelID <= 0 {
		return
	}
	s := getOrCreate(channelID)
	tryRotate(s)
	s.currTotal.Add(1)
	if success {
		s.currSuccess.Add(1)
	}
}

// GetSuccessRate returns the estimated success rate for the given channel
// using a weighted two-bucket smooth window. Returns [0, 1] or -1 if
// insufficient data.
func GetSuccessRate(channelID int) float64 {
	if channelID <= 0 {
		return -1
	}
	s := getOrCreate(channelID)
	tryRotate(s)

	elapsed := time.Now().UnixNano() - s.windowStart.Load()
	if elapsed < 0 {
		elapsed = 0
	}
	ratio := float64(elapsed) / float64(windowNano)
	if ratio > 1 {
		ratio = 1
	}

	prevW := 1 - ratio
	estTotal := int64(float64(s.prevTotal.Load())*prevW+0.5) + s.currTotal.Load()
	estSuccess := int64(float64(s.prevSuccess.Load())*prevW+0.5) + s.currSuccess.Load()

	if estTotal < minTotal {
		return -1
	}
	return float64(estSuccess) / float64(estTotal)
}

func tryRotate(s *channelStats) {
	now := time.Now().UnixNano()
	start := s.windowStart.Load()
	if now-start <= windowNano {
		return
	}
	if s.windowStart.CompareAndSwap(start, now) {
		s.prevTotal.Store(s.currTotal.Swap(0))
		s.prevSuccess.Store(s.currSuccess.Swap(0))
	}
}

// Remove deletes tracked state for the given channel to prevent memory leaks.
func Remove(channelID int) {
	if channelID <= 0 {
		return
	}
	windows.Delete(channelID)
}
