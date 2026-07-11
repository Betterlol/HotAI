package integration

import (
	"testing"

	"github.com/QuantumNous/new-api/types"
	"github.com/stretchr/testify/assert"
)

func TestIsRateLimitTrueFor429(t *testing.T) {
	err := &types.NewAPIError{StatusCode: 429}
	assert.True(t, types.IsRateLimit(err))
}

func TestIsRateLimitFalseForOtherCodes(t *testing.T) {
	assert.False(t, types.IsRateLimit(&types.NewAPIError{StatusCode: 500}))
	assert.False(t, types.IsRateLimit(&types.NewAPIError{StatusCode: 200}))
	assert.False(t, types.IsRateLimit(nil))
}

func TestIsAuthErrorTrueFor401And403(t *testing.T) {
	assert.True(t, types.IsAuthError(&types.NewAPIError{StatusCode: 401}))
	assert.True(t, types.IsAuthError(&types.NewAPIError{StatusCode: 403}))
}

func TestIsAuthErrorFalseFor429(t *testing.T) {
	assert.False(t, types.IsAuthError(&types.NewAPIError{StatusCode: 429}))
	assert.False(t, types.IsAuthError(nil))
}

func TestIsTimeoutTrueFor504(t *testing.T) {
	assert.True(t, types.IsTimeout(&types.NewAPIError{StatusCode: 504}))
	assert.True(t, types.IsTimeout(&types.NewAPIError{StatusCode: 408}))
}

func TestIsTimeoutFalseFor500(t *testing.T) {
	assert.False(t, types.IsTimeout(&types.NewAPIError{StatusCode: 500}))
}

func TestRetrySettingDefaults(t *testing.T) {
	// The defaults from the registered setting should be reasonable
	// (tested via the operation_setting tests, just verify integration)
}
