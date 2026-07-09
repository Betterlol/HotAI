package channelsuccessrate

import (
	"sync"
	"time"
)

type channelStats struct {
	mu      sync.Mutex
	total   int64
	success int64
	started time.Time
}

var (
	windows   sync.Map
	windowDur = 5 * time.Minute
	minTotal  = int64(10)
)

// SetWindowDuration overrides the sliding window size (for testing).
func SetWindowDuration(d time.Duration) {
	windowDur = d
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

func getStats(channelID int) *channelStats {
	actual, _ := windows.LoadOrStore(channelID, &channelStats{started: time.Now()})
	return actual.(*channelStats)
}

// Record records a success or failure for the given channel.
func Record(channelID int, success bool) {
	if channelID <= 0 {
		return
	}
	s := getStats(channelID)
	s.mu.Lock()
	defer s.mu.Unlock()

	if time.Since(s.started) > windowDur {
		s.started = time.Now()
		s.total = 0
		s.success = 0
	}
	s.total++
	if success {
		s.success++
	}
}

// GetSuccessRate returns the success rate for the given channel as a float64
// in [0, 1]. If there are fewer samples than minTotal, returns -1 to signal
// "insufficient data".
func GetSuccessRate(channelID int) float64 {
	if channelID <= 0 {
		return -1
	}
	s := getStats(channelID)
	s.mu.Lock()
	defer s.mu.Unlock()

	if time.Since(s.started) > windowDur {
		s.started = time.Now()
		s.total = 0
		s.success = 0
	}
	if s.total < minTotal {
		return -1
	}
	return float64(s.success) / float64(s.total)
}
