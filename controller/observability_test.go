package controller

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestGetHealthReportsCoreComponents(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	oldDB := model.DB
	oldRedisEnabled := common.RedisEnabled
	oldRDB := common.RDB
	model.DB = db
	common.RedisEnabled = false
	common.RDB = nil
	t.Cleanup(func() {
		model.DB = oldDB
		common.RedisEnabled = oldRedisEnabled
		common.RDB = oldRDB
	})

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	GetHealth(ctx)

	require.Equal(t, http.StatusOK, recorder.Code)
	var body map[string]any
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &body))
	assert.Equal(t, "ok", body["status"])
	assert.Equal(t, "ok", body["db"])
	assert.NotEmpty(t, body["uptime"])
	assert.NotEmpty(t, body["version"])
	assert.Contains(t, []any{"enabled", "disabled"}, body["memory"])
}

func TestGetMetricsExposesPrometheusOutput(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/api/metrics", nil)

	GetMetrics(ctx)

	require.Equal(t, http.StatusOK, recorder.Code)
	body := recorder.Body.String()
	assert.Contains(t, body, "# HELP hotai_active_connections")
	assert.Contains(t, body, "hotai_active_connections")
	assert.True(t, strings.Contains(recorder.Header().Get("Content-Type"), "text/plain"))
}
