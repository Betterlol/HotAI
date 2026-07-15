package integration

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	channellimiter "github.com/QuantumNous/new-api/pkg/channel_limiter"
	channelsuccessrate "github.com/QuantumNous/new-api/pkg/channel_successrate"
	"github.com/QuantumNous/new-api/pkg/circuitbreaker"
	"github.com/QuantumNous/new-api/setting/config"

	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

// seedUser creates a user in the test DB.
func seedUser(t *testing.T, id int, username string, role int) {
	t.Helper()
	user := &model.User{
		Id:       id,
		Username: username,
		Role:     role,
		Status:   common.UserStatusEnabled,
		Quota:    100000000,
	}
	require.NoError(t, model.DB.Create(user).Error, "seedUser failed")
}

// seedToken creates an API token owned by the given user.
func seedToken(t *testing.T, id int, userID int, key string) *model.Token {
	t.Helper()
	tok := &model.Token{
		Id:           id,
		UserId:       userID,
		Key:          key,
		Name:         "test-token",
		Status:       common.TokenStatusEnabled,
		RemainQuota:  100000000,
		UnlimitedQuota: true,
	}
	require.NoError(t, model.DB.Create(tok).Error, "seedToken failed")
	return tok
}

// seedChannel creates a channel and its abilities.
func seedChannel(t *testing.T, id int, name string, chType int, models string, baseURL string, opts ...channelOption) *model.Channel {
	t.Helper()
	ch := &model.Channel{
		Id:     id,
		Name:   name,
		Type:   chType,
		Models: models,
		Key:    "sk-test-key",
		Group:  "default",
		Status: common.ChannelStatusEnabled,
	}
	for _, opt := range opts {
		opt(ch)
	}
	if baseURL != "" {
		ch.BaseURL = &baseURL
	}
	require.NoError(t, model.DB.Create(ch).Error, "seedChannel failed")
	require.NoError(t, ch.AddAbilities(nil), "seedChannel AddAbilities failed")
	return ch
}

type channelOption func(*model.Channel)

func WithWeight(w uint) channelOption {
	return func(ch *model.Channel) { ch.Weight = &w }
}

func WithPriority(p int64) channelOption {
	return func(ch *model.Channel) { ch.Priority = &p }
}

func WithResponseTime(rt int) channelOption {
	return func(ch *model.Channel) { ch.ResponseTime = rt }
}

func WithPrice(pricePerToken float64) channelOption {
	return func(ch *model.Channel) { ch.PricePerToken = &pricePerToken }
}

// resetState clears in-memory state between tests.
func resetState(t *testing.T) {
	t.Helper()
	model.InitChannelCache()
	circuitbreaker.ResetForTest()
	channellimiter.ResetForTest()
	channelsuccessrate.ResetForTest()
}

// truncateTables clears all test data and resets state.
func truncateTables(t *testing.T) {
	t.Helper()
	clearDB := func() {
		model.DB.Session(&gorm.Session{AllowGlobalUpdate: true}).Unscoped().Delete(&model.User{})
		model.DB.Session(&gorm.Session{AllowGlobalUpdate: true}).Unscoped().Delete(&model.Token{})
		model.DB.Session(&gorm.Session{AllowGlobalUpdate: true}).Unscoped().Delete(&model.Channel{})
		model.DB.Session(&gorm.Session{AllowGlobalUpdate: true}).Unscoped().Delete(&model.Ability{})
		model.DB.Session(&gorm.Session{AllowGlobalUpdate: true}).Unscoped().Delete(&model.Log{})
		resetState(t)
	}
	clearDB()
	t.Cleanup(clearDB)
}

func resetAllConfigs(t *testing.T) {
	t.Helper()
	resetConfig(t, "cost_routing_setting", map[string]string{"enabled": "false", "cost_weight": "0.2"})
	resetConfig(t, "latency_routing_setting", map[string]string{"enabled": "false", "weight_factor": "0.3"})
	resetConfig(t, "success_rate_routing_setting", map[string]string{"enabled": "false", "weight_factor": "0.3", "window_minutes": "5", "min_samples": "10"})
	resetConfig(t, "circuit_breaker_setting", map[string]string{"enabled": "false"})
	resetConfig(t, "channel_limiter_setting", map[string]string{"enabled": "false"})
}

func resetConfig(t *testing.T, name string, values map[string]string) {
	t.Helper()
	cfg := config.GlobalConfig.Get(name)
	if cfg == nil {
		return
	}
	config.UpdateConfigFromMap(cfg, values)
}

func guardCostRouting(t *testing.T, enabled string, costWeight string) {
	t.Helper()
	cfg := config.GlobalConfig.Get("cost_routing_setting")
	require.NotNil(t, cfg)
	old := map[string]string{
		"enabled":     "false",
		"cost_weight": "0.2",
	}
	require.NoError(t, config.UpdateConfigFromMap(cfg, map[string]string{
		"enabled":     enabled,
		"cost_weight": costWeight,
	}))
	t.Cleanup(func() {
		config.UpdateConfigFromMap(cfg, old)
		resetState(t)
	})
}

func guardLatencyRouting(t *testing.T, enabled string, weightFactor string) {
	t.Helper()
	cfg := config.GlobalConfig.Get("latency_routing_setting")
	require.NotNil(t, cfg)
	old := map[string]string{
		"enabled":       "false",
		"weight_factor": "0.3",
	}
	require.NoError(t, config.UpdateConfigFromMap(cfg, map[string]string{
		"enabled":       enabled,
		"weight_factor": weightFactor,
	}))
	t.Cleanup(func() {
		config.UpdateConfigFromMap(cfg, old)
		resetState(t)
	})
}

func guardSuccessRateRouting(t *testing.T, enabled string, weightFactor string) {
	t.Helper()
	cfg := config.GlobalConfig.Get("success_rate_routing_setting")
	require.NotNil(t, cfg)
	old := map[string]string{
		"enabled":       "false",
		"weight_factor": "0.3",
	}
	require.NoError(t, config.UpdateConfigFromMap(cfg, map[string]string{
		"enabled":       enabled,
		"weight_factor": weightFactor,
	}))
	t.Cleanup(func() {
		config.UpdateConfigFromMap(cfg, old)
		resetState(t)
	})
}
