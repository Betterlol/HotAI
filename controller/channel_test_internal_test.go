package controller

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/pkg/billingexpr"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/setting/config"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestSettleTestQuotaUsesTieredBilling(t *testing.T) {
	info := &relaycommon.RelayInfo{
		TieredBillingSnapshot: &billingexpr.BillingSnapshot{
			BillingMode:   "tiered_expr",
			ExprString:    `param("stream") == true ? tier("stream", p * 3) : tier("base", p * 2)`,
			ExprHash:      billingexpr.ExprHashString(`param("stream") == true ? tier("stream", p * 3) : tier("base", p * 2)`),
			GroupRatio:    1,
			EstimatedTier: "stream",
			QuotaPerUnit:  common.QuotaPerUnit,
			ExprVersion:   1,
		},
		BillingRequestInput: &billingexpr.RequestInput{
			Body: []byte(`{"stream":true}`),
		},
	}

	quota, result := settleTestQuota(info, types.PriceData{
		ModelRatio:      1,
		CompletionRatio: 2,
	}, &dto.Usage{
		PromptTokens: 1000,
	})

	require.Equal(t, 1500, quota)
	require.NotNil(t, result)
	require.Equal(t, "stream", result.MatchedTier)
}

func TestBuildTestLogOtherInjectsTieredInfo(t *testing.T) {
	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())

	info := &relaycommon.RelayInfo{
		TieredBillingSnapshot: &billingexpr.BillingSnapshot{
			BillingMode: "tiered_expr",
			ExprString:  `tier("base", p * 2)`,
		},
		ChannelMeta: &relaycommon.ChannelMeta{},
	}
	priceData := types.PriceData{
		GroupRatioInfo: types.GroupRatioInfo{GroupRatio: 1},
	}
	usage := &dto.Usage{
		PromptTokensDetails: dto.InputTokenDetails{
			CachedTokens: 12,
		},
	}

	other := buildTestLogOther(ctx, info, priceData, usage, &billingexpr.TieredResult{
		MatchedTier: "base",
	})

	require.Equal(t, "tiered_expr", other["billing_mode"])
	require.Equal(t, "base", other["matched_tier"])
	require.NotEmpty(t, other["expr_b64"])
}

func TestResolveChannelTestUserIDUsesRequestUser(t *testing.T) {
	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Set("id", 2)

	userID, err := resolveChannelTestUserID(ctx)

	require.NoError(t, err)
	require.Equal(t, 2, userID)
}

func TestSelectChannelsForAutomaticTestPassiveRecoveryOnlyUsesAutoDisabled(t *testing.T) {
	channels := []*model.Channel{
		{Id: 1, Status: common.ChannelStatusEnabled},
		{Id: 2, Status: common.ChannelStatusAutoDisabled},
		{Id: 3, Status: common.ChannelStatusManuallyDisabled},
	}

	selected := selectChannelsForAutomaticTest(channels, operation_setting.ChannelTestModePassiveRecovery)

	require.Len(t, selected, 1)
	require.Equal(t, 2, selected[0].Id)
}

func TestSelectChannelsForAutomaticTestScheduledSkipsManualDisabled(t *testing.T) {
	channels := []*model.Channel{
		{Id: 1, Status: common.ChannelStatusEnabled},
		{Id: 2, Status: common.ChannelStatusAutoDisabled},
		{Id: 3, Status: common.ChannelStatusManuallyDisabled},
	}

	selected := selectChannelsForAutomaticTest(channels, operation_setting.ChannelTestModeScheduledAll)

	require.Len(t, selected, 2)
	require.Equal(t, 1, selected[0].Id)
	require.Equal(t, 2, selected[1].Id)
}

func TestShouldAutoDisableChannelSkipsWhenCircuitBreakerEnabled(t *testing.T) {
	oldAutomaticDisable := common.AutomaticDisableChannelEnabled
	common.AutomaticDisableChannelEnabled = true
	t.Cleanup(func() {
		common.AutomaticDisableChannelEnabled = oldAutomaticDisable
	})
	withCircuitBreakerEnabledForControllerTest(t, true)

	err := types.NewOpenAIError(errors.New("invalid key"), types.ErrorCodeChannelInvalidKey, http.StatusUnauthorized)
	channelError := types.ChannelError{ChannelId: 1, AutoBan: true}

	require.False(t, shouldAutoDisableChannel(channelError, err))
}

func TestShouldAutoDisableChannelUsesLegacyAutoBanWhenCircuitBreakerDisabled(t *testing.T) {
	oldAutomaticDisable := common.AutomaticDisableChannelEnabled
	common.AutomaticDisableChannelEnabled = true
	t.Cleanup(func() {
		common.AutomaticDisableChannelEnabled = oldAutomaticDisable
	})
	withCircuitBreakerEnabledForControllerTest(t, false)

	err := types.NewOpenAIError(errors.New("invalid key"), types.ErrorCodeChannelInvalidKey, http.StatusUnauthorized)
	channelError := types.ChannelError{ChannelId: 1, AutoBan: true}

	require.True(t, shouldAutoDisableChannel(channelError, err))
}

func TestTestAllChannelsRejectsExistingActiveTask(t *testing.T) {
	db := setupModelListControllerTestDB(t)
	require.NoError(t, db.AutoMigrate(&model.SystemTask{}, &model.SystemTaskLock{}))

	existing, err := model.CreateSystemTask(model.SystemTaskTypeChannelTest, nil, nil)
	require.NoError(t, err)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/api/channel/test", nil)

	TestAllChannels(ctx)

	require.Equal(t, http.StatusConflict, recorder.Code)
	require.Contains(t, recorder.Body.String(), existing.TaskID)
	require.Contains(t, recorder.Body.String(), "已有通道测试任务正在运行或等待中")
}

func withCircuitBreakerEnabledForControllerTest(t *testing.T, enabled bool) {
	t.Helper()
	oldSetting := operation_setting.GetCircuitBreakerSetting()
	cfg := config.GlobalConfig.Get("circuit_breaker_setting")
	require.NotNil(t, cfg)
	value := "false"
	if enabled {
		value = "true"
	}
	require.NoError(t, config.UpdateConfigFromMap(cfg, map[string]string{"enabled": value}))
	t.Cleanup(func() {
		restore := map[string]string{
			"enabled":                     boolStringForControllerTest(oldSetting.Enabled),
			"window_seconds":              intStringForControllerTest(oldSetting.WindowSeconds),
			"bucket_seconds":              intStringForControllerTest(oldSetting.BucketSeconds),
			"error_threshold":             floatStringForControllerTest(oldSetting.ErrorThreshold),
			"min_request_count":           int64StringForControllerTest(oldSetting.MinRequestCount),
			"open_timeout_seconds":        intStringForControllerTest(oldSetting.OpenTimeoutSeconds),
			"half_open_max_requests":      intStringForControllerTest(oldSetting.HalfOpenMaxRequests),
			"half_open_success_threshold": intStringForControllerTest(oldSetting.HalfOpenSuccessThreshold),
		}
		_ = config.UpdateConfigFromMap(cfg, restore)
	})
}

func boolStringForControllerTest(value bool) string {
	if value {
		return "true"
	}
	return "false"
}

func intStringForControllerTest(value int) string {
	return strconv.Itoa(value)
}

func int64StringForControllerTest(value int64) string {
	return strconv.FormatInt(value, 10)
}

func floatStringForControllerTest(value float64) string {
	return strconv.FormatFloat(value, 'f', -1, 64)
}
