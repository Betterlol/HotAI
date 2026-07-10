package channelsuccessrate

import (
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestRecordAndGetSuccessRate(t *testing.T) {
	ResetForTest()
	SetMinTotal(3)
	SetWindowDuration(5 * time.Minute)

	Record(1, true)
	Record(1, true)
	Record(1, true)

	rate := GetSuccessRate(1)
	assert.Equal(t, 1.0, rate)
}

func TestGetSuccessRatePartial(t *testing.T) {
	ResetForTest()
	SetMinTotal(3)

	Record(1, true)
	Record(1, false)
	Record(1, true)

	rate := GetSuccessRate(1)
	assert.Equal(t, 2.0/3.0, rate)
}

func TestGetSuccessRateInsufficientData(t *testing.T) {
	ResetForTest()
	SetMinTotal(5)
	SetWindowDuration(5 * time.Minute)

	Record(1, true)
	Record(1, true)

	rate := GetSuccessRate(1)
	assert.Equal(t, -1.0, rate)
}

func TestGetSuccessRateNoRecords(t *testing.T) {
	ResetForTest()
	SetMinTotal(1)

	rate := GetSuccessRate(1)
	assert.Equal(t, -1.0, rate)
}

func TestGetSuccessRateZeroChannelID(t *testing.T) {
	ResetForTest()
	SetMinTotal(1)

	Record(0, true)
	rate := GetSuccessRate(0)
	assert.Equal(t, -1.0, rate)
}

func TestSmoothWindowTransition(t *testing.T) {
	ResetForTest()
	SetMinTotal(1)
	SetWindowDuration(200 * time.Millisecond)

	// Fill current window with 100% success
	Record(1, true)
	Record(1, true)
	Record(1, true)

	// Immediately after filling, rate should be 1.0
	assert.Equal(t, 1.0, GetSuccessRate(1))

	// Wait for window to expire
	time.Sleep(250 * time.Millisecond)

	// After expiration, curr bucket was rotated to prev and curr reset to 0.
	// The prevW should be close to 0 (elapsed ≈ 0 since rotation just happened),
	// so estimated rate should be 0/0 → insufficient data.
	// But actually, prev bucket has (3 success, 3 total), curr bucket has (0, 0).
	// prevW = 1 - (≈0/200ms) ≈ 1, so estTotal = 3*1 + 0 = 3, estSuccess = 3*1 + 0 = 3.
	// Since minTotal = 1, rate should be 1.0.
	first := GetSuccessRate(1)
	assert.Equal(t, 1.0, first, "smooth window should preserve prev bucket data after rotation")

	// Now record a failure — this goes into the current bucket
	Record(1, false)
	// Current is now (1 fail, 1 total), prev is (3 success, 3 total)
	// elapsed since rotation is small → prevW ≈ 1, so estimated rate is close to 3/4 = 0.75
	val := GetSuccessRate(1)
	assert.Greater(t, val, 0.5)
	assert.Less(t, val, 1.0)
	assert.InDelta(t, 0.75, val, 0.15, "should blend prev success with current failure")
}

func TestTumblingWindowExpiration(t *testing.T) {
	ResetForTest()
	SetMinTotal(1)
	SetWindowDuration(100 * time.Millisecond)

	Record(1, true)
	assert.Equal(t, 1.0, GetSuccessRate(1))

	time.Sleep(150 * time.Millisecond)

	// Old data rotated to prev, curr is empty.
	// But prev bucket's data is still counted with prevW weight.
	rate := GetSuccessRate(1)
	assert.NotEqual(t, -1.0, rate, "smooth window should not return -1 right after boundary")
	assert.InDelta(t, 1.0, rate, 0.01, "should preserve rate from prev bucket")
}

func TestMultipleChannels(t *testing.T) {
	ResetForTest()
	SetMinTotal(1)

	Record(1, true)
	Record(1, false)
	Record(2, true)
	Record(2, true)

	assert.Equal(t, 0.5, GetSuccessRate(1))
	assert.Equal(t, 1.0, GetSuccessRate(2))
}

func TestRemove(t *testing.T) {
	ResetForTest()
	SetMinTotal(1)

	Record(42, true)
	assert.Equal(t, 1.0, GetSuccessRate(42))

	Remove(42)
	rate := GetSuccessRate(42)
	assert.Equal(t, -1.0, rate)
}

func TestRemoveNonexistent(t *testing.T) {
	ResetForTest()
	Remove(999)
	Remove(0)
	Remove(-1)
}

func TestRemoveThenRecreate(t *testing.T) {
	ResetForTest()
	SetMinTotal(1)
	SetWindowDuration(5 * time.Minute)

	Record(42, true)
	Remove(42)
	Record(42, true)
	Record(42, true)

	rate := GetSuccessRate(42)
	assert.Equal(t, 1.0, rate)
}

func TestConcurrentRecordAndGet(t *testing.T) {
	ResetForTest()
	SetMinTotal(1)

	var wg sync.WaitGroup
	for i := 0; i < 50; i++ {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()
			Record(100, id%3 != 0)
		}(i)
	}
	wg.Wait()

	rate := GetSuccessRate(100)
	assert.Greater(t, rate, 0.0)
	assert.LessOrEqual(t, rate, 1.0)
}
