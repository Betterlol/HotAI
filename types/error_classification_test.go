package types

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestIsRateLimit(t *testing.T) {
	assert.True(t, IsRateLimit(&NewAPIError{StatusCode: http.StatusTooManyRequests}))
	assert.False(t, IsRateLimit(&NewAPIError{StatusCode: http.StatusInternalServerError}))
	assert.False(t, IsRateLimit(nil))
}

func TestIsAuthError(t *testing.T) {
	assert.True(t, IsAuthError(&NewAPIError{StatusCode: http.StatusUnauthorized}))
	assert.True(t, IsAuthError(&NewAPIError{StatusCode: http.StatusForbidden}))
	assert.True(t, IsAuthError(&NewAPIError{errorCode: ErrorCodeChannelInvalidKey}))
	assert.True(t, IsAuthError(&NewAPIError{errorCode: ErrorCodeAccessDenied}))
	assert.False(t, IsAuthError(&NewAPIError{StatusCode: http.StatusTooManyRequests}))
	assert.False(t, IsAuthError(nil))
}

func TestIsTimeout(t *testing.T) {
	assert.True(t, IsTimeout(&NewAPIError{StatusCode: http.StatusGatewayTimeout}))
	assert.True(t, IsTimeout(&NewAPIError{StatusCode: http.StatusRequestTimeout}))
	assert.True(t, IsTimeout(&NewAPIError{errorCode: ErrorCodeDoRequestFailed}))
	assert.True(t, IsTimeout(&NewAPIError{errorCode: ErrorCodeChannelResponseTimeExceeded}))
	assert.False(t, IsTimeout(&NewAPIError{StatusCode: http.StatusBadGateway}))
	assert.False(t, IsTimeout(nil))
}
