package circuitbreaker

import (
	"sync"
	"time"

	"github.com/QuantumNous/new-api/setting/operation_setting"
)

type State string

const (
	StateClosed   State = "closed"
	StateOpen     State = "open"
	StateHalfOpen State = "half_open"
)

type bucket struct {
	start   int64
	total   int64
	failure int64
}

type breaker struct {
	mu              sync.Mutex
	state           State
	buckets         []bucket
	openedAt        time.Time
	halfOpenInUse   int
	halfOpenSuccess int
}

var breakers sync.Map

func CanSelect(channelID int) bool {
	setting := operation_setting.GetCircuitBreakerSetting()
	if !setting.Enabled || channelID <= 0 {
		return true
	}
	return getBreaker(channelID, setting).canSelect(setting, time.Now())
}

func MarkSelected(channelID int) bool {
	setting := operation_setting.GetCircuitBreakerSetting()
	if !setting.Enabled || channelID <= 0 {
		return true
	}
	return getBreaker(channelID, setting).markSelected(setting, time.Now())
}

func MarkSuccess(channelID int) {
	setting := operation_setting.GetCircuitBreakerSetting()
	if !setting.Enabled || channelID <= 0 {
		return
	}
	getBreaker(channelID, setting).record(setting, time.Now(), false)
}

func MarkFailure(channelID int) {
	setting := operation_setting.GetCircuitBreakerSetting()
	if !setting.Enabled || channelID <= 0 {
		return
	}
	getBreaker(channelID, setting).record(setting, time.Now(), true)
}

func GetState(channelID int) State {
	setting := operation_setting.GetCircuitBreakerSetting()
	if channelID <= 0 {
		return StateClosed
	}
	return getBreaker(channelID, setting).currentState(setting, time.Now())
}

func ResetForTest() {
	breakers = sync.Map{}
}

func getBreaker(channelID int, setting operation_setting.CircuitBreakerSetting) *breaker {
	actual, _ := breakers.LoadOrStore(channelID, newBreaker(setting))
	return actual.(*breaker)
}

func newBreaker(setting operation_setting.CircuitBreakerSetting) *breaker {
	return &breaker{state: StateClosed, buckets: make([]bucket, bucketCount(setting))}
}

func bucketCount(setting operation_setting.CircuitBreakerSetting) int {
	count := setting.WindowSeconds / setting.BucketSeconds
	if count <= 0 {
		return 1
	}
	return count
}

func (b *breaker) canSelect(setting operation_setting.CircuitBreakerSetting, now time.Time) bool {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.refreshState(setting, now)
	switch b.state {
	case StateOpen:
		return false
	case StateHalfOpen:
		return b.halfOpenInUse < setting.HalfOpenMaxRequests
	default:
		return true
	}
}

func (b *breaker) markSelected(setting operation_setting.CircuitBreakerSetting, now time.Time) bool {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.refreshState(setting, now)
	if b.state == StateOpen {
		return false
	}
	if b.state == StateHalfOpen {
		if b.halfOpenInUse >= setting.HalfOpenMaxRequests {
			return false
		}
		b.halfOpenInUse++
	}
	return true
}

func (b *breaker) record(setting operation_setting.CircuitBreakerSetting, now time.Time, failed bool) {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.refreshState(setting, now)
	if b.state == StateHalfOpen {
		if b.halfOpenInUse > 0 {
			b.halfOpenInUse--
		}
		if failed {
			b.open(now)
			return
		}
		b.halfOpenSuccess++
		if b.halfOpenSuccess >= setting.HalfOpenSuccessThreshold {
			b.close()
		}
		return
	}
	if b.state == StateOpen {
		return
	}
	b.addSample(setting, now, failed)
	if b.shouldOpen(setting, now) {
		b.open(now)
	}
}

func (b *breaker) currentState(setting operation_setting.CircuitBreakerSetting, now time.Time) State {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.refreshState(setting, now)
	return b.state
}

func (b *breaker) refreshState(setting operation_setting.CircuitBreakerSetting, now time.Time) {
	if b.state == "" {
		b.state = StateClosed
	}
	if b.state == StateOpen && now.Sub(b.openedAt) >= time.Duration(setting.OpenTimeoutSeconds)*time.Second {
		b.state = StateHalfOpen
		b.halfOpenInUse = 0
		b.halfOpenSuccess = 0
	}
}

func (b *breaker) addSample(setting operation_setting.CircuitBreakerSetting, now time.Time, failed bool) {
	if len(b.buckets) != bucketCount(setting) {
		b.buckets = make([]bucket, bucketCount(setting))
	}
	bucketStart := now.Unix() - now.Unix()%int64(setting.BucketSeconds)
	index := int((bucketStart / int64(setting.BucketSeconds)) % int64(len(b.buckets)))
	if b.buckets[index].start != bucketStart {
		b.buckets[index] = bucket{start: bucketStart}
	}
	b.buckets[index].total++
	if failed {
		b.buckets[index].failure++
	}
}

func (b *breaker) shouldOpen(setting operation_setting.CircuitBreakerSetting, now time.Time) bool {
	total, failure := b.windowCounts(setting, now)
	if total < setting.MinRequestCount {
		return false
	}
	return float64(failure)/float64(total) >= setting.ErrorThreshold
}

func (b *breaker) windowCounts(setting operation_setting.CircuitBreakerSetting, now time.Time) (int64, int64) {
	cutoff := now.Unix() - int64(setting.WindowSeconds)
	var total int64
	var failure int64
	for _, current := range b.buckets {
		if current.start == 0 || current.start < cutoff {
			continue
		}
		total += current.total
		failure += current.failure
	}
	return total, failure
}

func (b *breaker) open(now time.Time) {
	b.state = StateOpen
	b.openedAt = now
	b.halfOpenInUse = 0
	b.halfOpenSuccess = 0
}

func (b *breaker) close() {
	b.state = StateClosed
	b.buckets = make([]bucket, len(b.buckets))
	b.halfOpenInUse = 0
	b.halfOpenSuccess = 0
}
