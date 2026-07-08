package middleware

import (
	"net/http/httptest"
	"strconv"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	channellimiter "github.com/QuantumNous/new-api/pkg/channel_limiter"
	"github.com/QuantumNous/new-api/setting/config"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAcquireAffinityChannelFallsBackWhenLimiterFull(t *testing.T) {
	gin.SetMode(gin.TestMode)
	withChannelLimiterSettingForMiddlewareTest(t, map[string]string{"enabled": "true", "max_concurrent_requests": "1"})
	channellimiter.ResetForTest()
	t.Cleanup(channellimiter.ResetForTest)
	require.True(t, channellimiter.Acquire(1))

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	common.SetContextKey(ctx, constant.ContextKeyAutoGroup, "vip")

	acquired := acquireAffinityChannel(ctx, &model.Channel{Id: 1}, "vip", "auto")

	assert.False(t, acquired)
	assert.Equal(t, "", common.GetContextKeyString(ctx, constant.ContextKeyAutoGroup))
	assert.Equal(t, 1, channellimiter.InFlight(1))
}

func TestAcquireAffinityChannelAcquiresAvailableLimiter(t *testing.T) {
	gin.SetMode(gin.TestMode)
	withChannelLimiterSettingForMiddlewareTest(t, map[string]string{"enabled": "true", "max_concurrent_requests": "1"})
	channellimiter.ResetForTest()
	t.Cleanup(channellimiter.ResetForTest)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)

	acquired := acquireAffinityChannel(ctx, &model.Channel{Id: 1}, "default", "default")

	assert.True(t, acquired)
	assert.Equal(t, 1, channellimiter.InFlight(1))
}

func withChannelLimiterSettingForMiddlewareTest(t *testing.T, values map[string]string) {
	t.Helper()
	oldSetting := operation_setting.GetChannelLimiterSetting()
	cfg := config.GlobalConfig.Get("channel_limiter_setting")
	require.NotNil(t, cfg)
	require.NoError(t, config.UpdateConfigFromMap(cfg, values))
	t.Cleanup(func() {
		restore := map[string]string{
			"enabled":                 boolStringForMiddlewareTest(oldSetting.Enabled),
			"max_concurrent_requests": strconv.Itoa(oldSetting.MaxConcurrentRequests),
		}
		_ = config.UpdateConfigFromMap(cfg, restore)
	})
}

func boolStringForMiddlewareTest(value bool) string {
	if value {
		return "true"
	}
	return "false"
}
