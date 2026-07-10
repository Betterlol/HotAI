package types

import "net/http"

const (
	ErrorTypeAuthFailure = ErrorType("auth_failure")
	ErrorTypeRateLimit   = ErrorType("rate_limit")
	ErrorTypeTimeout     = ErrorType("timeout")
)

// IsRateLimit returns true if the error indicates a rate limit (429) response
// from the upstream provider.
func IsRateLimit(err *NewAPIError) bool {
	if err == nil {
		return false
	}
	return err.StatusCode == http.StatusTooManyRequests
}

// IsAuthError returns true if the error indicates an authentication or
// authorization failure (401, 403) from the upstream provider.
func IsAuthError(err *NewAPIError) bool {
	if err == nil {
		return false
	}
	return err.StatusCode == http.StatusUnauthorized ||
		err.StatusCode == http.StatusForbidden ||
		err.errorCode == ErrorCodeChannelInvalidKey ||
		err.errorCode == ErrorCodeAccessDenied
}

// IsTimeout returns true if the error indicates a timeout or upstream
// connectivity failure.
func IsTimeout(err *NewAPIError) bool {
	if err == nil {
		return false
	}
	if err.StatusCode == http.StatusGatewayTimeout ||
		err.StatusCode == http.StatusRequestTimeout {
		return true
	}
	return err.errorCode == ErrorCodeDoRequestFailed ||
		err.errorCode == ErrorCodeChannelResponseTimeExceeded
}
