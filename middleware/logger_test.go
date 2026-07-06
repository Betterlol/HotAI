package middleware

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGinLoggerOutputsJSONWhenConfigured(t *testing.T) {
	gin.SetMode(gin.TestMode)
	var buffer bytes.Buffer
	oldWriter := gin.DefaultWriter
	oldErrorWriter := gin.DefaultErrorWriter
	oldFormat := common.LogFormat
	common.LogWriterMu.Lock()
	gin.DefaultWriter = &buffer
	gin.DefaultErrorWriter = &buffer
	common.LogWriterMu.Unlock()
	common.SetLogFormat(common.LogFormatJSON)
	t.Cleanup(func() {
		common.LogWriterMu.Lock()
		gin.DefaultWriter = oldWriter
		gin.DefaultErrorWriter = oldErrorWriter
		common.LogWriterMu.Unlock()
		common.SetLogFormat(oldFormat)
	})

	engine := gin.New()
	SetUpLogger(engine)
	engine.GET("/ping", RouteTag("api"), func(c *gin.Context) {
		c.Set(common.RequestIdKey, "req-123")
		c.String(http.StatusOK, "pong")
	})

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/ping", nil)
	engine.ServeHTTP(recorder, request)

	require.Equal(t, http.StatusOK, recorder.Code)
	var entry map[string]any
	require.NoError(t, common.Unmarshal(bytes.TrimSpace(buffer.Bytes()), &entry))
	assert.Equal(t, "INFO", entry["level"])
	assert.Equal(t, "api", entry["route_tag"])
	assert.Equal(t, "req-123", entry["request_id"])
	assert.Equal(t, float64(http.StatusOK), entry["status"])
	assert.Equal(t, http.MethodGet, entry["method"])
	assert.Equal(t, "/ping", entry["path"])
}
