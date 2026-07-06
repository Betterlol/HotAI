package logger

import (
	"bytes"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestLogInfoOutputsJSONWhenConfigured(t *testing.T) {
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

	LogInfo(nil, "hello observability")

	var entry map[string]string
	require.NoError(t, common.Unmarshal(bytes.TrimSpace(buffer.Bytes()), &entry))
	assert.Equal(t, "INFO", entry["level"])
	assert.Equal(t, "SYSTEM", entry["request_id"])
	assert.Equal(t, "hello observability", entry["msg"])
	assert.NotEmpty(t, entry["time"])
}
