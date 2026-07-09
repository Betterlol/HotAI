package channelsuccessrate

import (
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

func TestWindowExpiration(t *testing.T) {
	ResetForTest()
	SetMinTotal(1)
	SetWindowDuration(100 * time.Millisecond)

	Record(1, true)
	assert.Equal(t, 1.0, GetSuccessRate(1))

	time.Sleep(150 * time.Millisecond)

	// After window expires, stats are reset → insufficient data
	rate := GetSuccessRate(1)
	assert.Equal(t, -1.0, rate)
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
