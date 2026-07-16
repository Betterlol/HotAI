package integration

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/controller"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/config"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// mockUpstream returns an httptest.Server that responds with the given status
// and optional JSON body.
func mockUpstream(status int, body string) *httptest.Server {
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(status)
		if body != "" {
			_, _ = w.Write([]byte(body))
		}
	}))
}

// seedRetryChannel creates a channel with the given properties and a valid key.
func seedRetryChannel(t *testing.T, id int, name string, priority int64, weight uint, baseURL string, models ...string) *model.Channel {
	t.Helper()
	ch := &model.Channel{
		Id:     id,
		Name:   name,
		Type:   constant.ChannelTypeOpenAI,
		Models: strings.Join(models, ","),
		Key:    "sk-test-key-" + name,
		Group:  "default",
		Status: common.ChannelStatusEnabled,
	}
	if priority != 0 {
		ch.Priority = &priority
	}
	if weight != 0 {
		ch.Weight = &weight
	}
	if baseURL != "" {
		ch.BaseURL = &baseURL
	}
	require.NoError(t, model.DB.Create(ch).Error, "seed channel failed")
	require.NoError(t, ch.AddAbilities(nil), "add abilities failed")
	return ch
}

// newTestRouter creates a minimal gin router with the relay endpoint and
// the middleware chain used in production.
func newTestRouter(t *testing.T) *gin.Engine {
	t.Helper()
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(gin.Recovery())
	r.Use(middleware.CORS())
	r.Use(middleware.DecompressRequestMiddleware())
	r.Use(middleware.BodyStorageCleanup())
	r.Use(middleware.StatsMiddleware())

	api := r.Group("/v1")
	api.Use(middleware.RouteTag("relay"))
	api.Use(middleware.SystemPerformanceCheck())
	api.Use(middleware.TokenAuth())
	api.Use(middleware.ModelRequestRateLimit())
	{
		httpRouter := api.Group("")
		httpRouter.Use(middleware.Distribute())
		httpRouter.POST("/chat/completions", func(c *gin.Context) {
			controller.Relay(c, types.RelayFormatOpenAI)
		})
	}
	return r
}

// newTestRequest creates an HTTP request to the relay endpoint with the given
// token key and body.
func newTestRequest(t *testing.T, serverURL string, tokenKey string, body string) *http.Request {
	t.Helper()
	req, err := http.NewRequest(http.MethodPost, serverURL+"/v1/chat/completions", strings.NewReader(body))
	require.NoError(t, err)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+tokenKey)
	return req
}

// newTestServer returns an httptest.Server wrapping the test router.
func newTestServer(t *testing.T, router *gin.Engine) *httptest.Server {
	t.Helper()
	return httptest.NewServer(router)
}

func setupModelRatio(t *testing.T, modelName string, ratio float64) {
	t.Helper()
	jsonStr := fmt.Sprintf(`{"%s": %f}`, modelName, ratio)
	require.NoError(t, ratio_setting.UpdateModelRatioByJSONString(jsonStr))
}

func TestFailover500FallsBackToNextChannel(t *testing.T) {
	truncateTables(t)
	resetAllConfigs(t)
	resetState(t)

	common.RetryTimes = 1
	defer func() { common.RetryTimes = 0 }()

	seedUser(t, 1, "failover-user", common.RoleCommonUser)
	tok := seedToken(t, 1, 1, "failover")

	upA := mockUpstream(http.StatusInternalServerError, `{"error":{"message":"upstream 500","type":"server_error"}}`)
	upB := mockUpstream(http.StatusOK, `{"id":"chatcmpl-ok","choices":[{"message":{"role":"assistant","content":"pong"}}],"usage":{"prompt_tokens":1,"completion_tokens":1,"total_tokens":2}}`)
	defer upA.Close()
	defer upB.Close()

	seedRetryChannel(t, 1, "chan-a", 100, 10, upA.URL, "gpt-test")
	seedRetryChannel(t, 2, "chan-b", 50, 5, upB.URL, "gpt-test")
	resetState(t)
	setupModelRatio(t, "gpt-test", 1.0)

	router := newTestRouter(t)
	server := newTestServer(t, router)
	defer server.Close()

	body := `{"model":"gpt-test","messages":[{"role":"user","content":"hi"}]}`
	req := newTestRequest(t, server.URL, tok.Key, body)
	resp, err := server.Client().Do(req)
	require.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusOK, resp.StatusCode, "expected 200 after failover to channel B")
}

func TestFailover401DisablesChannelAndFallsBack(t *testing.T) {
	truncateTables(t)
	resetAllConfigs(t)
	resetState(t)

	common.RetryTimes = 1
	common.AutomaticDisableChannelEnabled = true
	defer func() {
		common.RetryTimes = 0
		common.AutomaticDisableChannelEnabled = false
	}()

	seedUser(t, 1, "failover-user", common.RoleCommonUser)
	tok := seedToken(t, 1, 1, "failover")

	upA := mockUpstream(http.StatusUnauthorized, `{"error":{"message":"invalid api key","type":"authentication_error"}}`)
	upB := mockUpstream(http.StatusOK, `{"id":"chatcmpl-ok","choices":[{"message":{"role":"assistant","content":"pong"}}],"usage":{"prompt_tokens":1,"completion_tokens":1,"total_tokens":2}}`)
	defer upA.Close()
	defer upB.Close()

	seedRetryChannel(t, 1, "chan-a", 100, 10, upA.URL, "gpt-test")
	seedRetryChannel(t, 2, "chan-b", 50, 5, upB.URL, "gpt-test")
	resetState(t)
	setupModelRatio(t, "gpt-test", 1.0)

	router := newTestRouter(t)
	server := newTestServer(t, router)
	defer server.Close()

	body := `{"model":"gpt-test","messages":[{"role":"user","content":"hi"}]}`
	req := newTestRequest(t, server.URL, tok.Key, body)
	resp, err := server.Client().Do(req)
	require.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusOK, resp.StatusCode, "expected 200 after retry to channel B")

	require.Eventually(t, func() bool {
		chA, _ := model.GetChannelById(1, false)
		if chA == nil {
			return false
		}
		return chA.Status == common.ChannelStatusAutoDisabled
	}, 2*time.Second, 50*time.Millisecond, "channel A should be auto-disabled after 401")
}

func TestFailover429RetriesOtherChannel(t *testing.T) {
	truncateTables(t)
	resetAllConfigs(t)
	resetState(t)

	common.RetryTimes = 1
	defer func() { common.RetryTimes = 0 }()

	seedUser(t, 1, "failover-user", common.RoleCommonUser)
	tok := seedToken(t, 1, 1, "failover")

	upA := mockUpstream(http.StatusTooManyRequests, `{"error":{"message":"rate limit","type":"rate_limit_error"}}`)
	upB := mockUpstream(http.StatusOK, `{"id":"chatcmpl-ok","choices":[{"message":{"role":"assistant","content":"pong"}}],"usage":{"prompt_tokens":1,"completion_tokens":1,"total_tokens":2}}`)
	defer upA.Close()
	defer upB.Close()

	seedRetryChannel(t, 1, "chan-a", 100, 10, upA.URL, "gpt-test")
	seedRetryChannel(t, 2, "chan-b", 50, 5, upB.URL, "gpt-test")
	resetState(t)

	cfg := config.GlobalConfig.Get("retry_setting")
	if cfg != nil {
		_ = config.UpdateConfigFromMap(cfg, map[string]string{
			"ratelimit_retry_interval": "10",
			"ratelimit_retry_times":    "3",
		})
	}
	setupModelRatio(t, "gpt-test", 1.0)

	router := newTestRouter(t)
	server := newTestServer(t, router)
	defer server.Close()

	body := `{"model":"gpt-test","messages":[{"role":"user","content":"hi"}]}`
	req := newTestRequest(t, server.URL, tok.Key, body)

	start := time.Now()
	resp, err := server.Client().Do(req)
	elapsed := time.Since(start)
	require.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusOK, resp.StatusCode, "expected 200 after retry on channel B")
	assert.True(t, elapsed >= 10*time.Millisecond, "expected at least one rate-limit backoff")
}

func TestFailover504SkipsRetry(t *testing.T) {
	truncateTables(t)
	resetAllConfigs(t)
	resetState(t)

	common.RetryTimes = 1
	defer func() { common.RetryTimes = 0 }()

	seedUser(t, 1, "failover-user", common.RoleCommonUser)
	tok := seedToken(t, 1, 1, "failover")

	upA := mockUpstream(http.StatusGatewayTimeout, `{"error":{"message":"upstream timeout","type":"timeout"}}`)
	defer upA.Close()

	seedRetryChannel(t, 1, "chan-a", 100, 10, upA.URL, "gpt-test")
	resetState(t)
	setupModelRatio(t, "gpt-test", 1.0)

	router := newTestRouter(t)
	server := newTestServer(t, router)
	defer server.Close()

	body := `{"model":"gpt-test","messages":[{"role":"user","content":"hi"}]}`
	req := newTestRequest(t, server.URL, tok.Key, body)

	resp, err := server.Client().Do(req)
	require.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusGatewayTimeout, resp.StatusCode, "expected 504 without retry")
}

func TestFailoverAllChannelsDownReturns500(t *testing.T) {
	truncateTables(t)
	resetAllConfigs(t)
	resetState(t)

	common.RetryTimes = 1
	defer func() { common.RetryTimes = 0 }()

	seedUser(t, 1, "failover-user", common.RoleCommonUser)
	tok := seedToken(t, 1, 1, "failover")

	upA := mockUpstream(http.StatusInternalServerError, `{"error":{"message":"down","type":"server_error"}}`)
	upB := mockUpstream(http.StatusInternalServerError, `{"error":{"message":"down","type":"server_error"}}`)
	defer upA.Close()
	defer upB.Close()

	seedRetryChannel(t, 1, "chan-a", 100, 10, upA.URL, "gpt-test")
	seedRetryChannel(t, 2, "chan-b", 50, 5, upB.URL, "gpt-test")
	resetState(t)
	setupModelRatio(t, "gpt-test", 1.0)

	router := newTestRouter(t)
	server := newTestServer(t, router)
	defer server.Close()

	body := `{"model":"gpt-test","messages":[{"role":"user","content":"hi"}]}`
	req := newTestRequest(t, server.URL, tok.Key, body)
	resp, err := server.Client().Do(req)
	require.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusInternalServerError, resp.StatusCode, "expected 500 when all channels fail")
}

func TestFailoverAutoGroupFallsBackToDefault(t *testing.T) {
	truncateTables(t)
	resetAllConfigs(t)
	resetState(t)

	common.RetryTimes = 1
	defer func() { common.RetryTimes = 0 }()

	seedUser(t, 1, "failover-user", common.RoleCommonUser)
	user, _ := model.GetUserById(1, false)
	require.NotNil(t, user)
	user.Group = "default"
	_ = user.Update(false)

	_ = setting.UpdateUserUsableGroupsByJSONString(`{"default":"默认分组","vip":"vip分组","auto":"auto分组"}`)

	tok := seedToken(t, 1, 1, "failover")
	tok.Group = "auto"
	_ = tok.Update()

	upDefault := mockUpstream(http.StatusOK, `{"id":"chatcmpl-ok","choices":[{"message":{"role":"assistant","content":"pong"}}],"usage":{"prompt_tokens":1,"completion_tokens":1,"total_tokens":2}}`)
	defer upDefault.Close()

	seedRetryChannel(t, 1, "default-chan", 10, 1, upDefault.URL, "gpt-test")
	resetState(t)
	setupModelRatio(t, "gpt-test", 1.0)

	router := newTestRouter(t)
	server := newTestServer(t, router)
	defer server.Close()

	body := `{"model":"gpt-test","messages":[{"role":"user","content":"hi"}]}`
	req := newTestRequest(t, server.URL, tok.Key, body)
	resp, err := server.Client().Do(req)
	require.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusOK, resp.StatusCode, "expected 200 with auto group")
}

func TestFailoverChannelReEnabledAfterTest(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping timing-dependent test in short mode")
	}
	truncateTables(t)
	resetAllConfigs(t)
	resetState(t)

	seedUser(t, 1, "failover-user", common.RoleCommonUser)

	ch := seedRetryChannel(t, 1, "chan-a", 100, 10, "", "gpt-test")
	_ = model.UpdateChannelStatus(ch.Id, "test-key", common.ChannelStatusAutoDisabled, "test")

	require.Eventually(t, func() bool {
		c, _ := model.GetChannelById(ch.Id, false)
		if c == nil {
			return false
		}
		return c.Status == common.ChannelStatusEnabled
	}, 5*time.Second, 200*time.Millisecond, "channel A should be re-enabled by automatic channel tests")
}
