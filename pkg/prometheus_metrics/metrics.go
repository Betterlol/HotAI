package prometheusmetrics

import (
	"strconv"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/pkg/http_stats"
	relaycommon "github.com/QuantumNous/new-api/relay/common"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

var (
	requestTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "hotai_requests_total",
			Help: "Total relay requests by model, group, channel, and status.",
		},
		[]string{"model", "group", "channel", "status"},
	)

	requestDurationMs = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "hotai_requests_duration_ms",
			Help:    "Relay request latency in milliseconds.",
			Buckets: []float64{50, 100, 200, 500, 1000, 2000, 5000, 10000, 30000, 60000},
		},
		[]string{"model", "group", "channel"},
	)

	ttftMs = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "hotai_ttft_ms",
			Help:    "Time to first token for streaming relay requests in milliseconds.",
			Buckets: []float64{50, 100, 200, 500, 1000, 2000, 5000, 10000},
		},
		[]string{"model", "group", "channel"},
	)

	tokensTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "hotai_tokens_total",
			Help: "Relay token count by model, group, channel, and token type.",
		},
		[]string{"model", "group", "channel", "type"},
	)

	upstreamErrorsTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "hotai_upstream_errors_total",
			Help: "Relay upstream errors by model, channel, and status code.",
		},
		[]string{"model", "channel", "status_code"},
	)

	successRate = promauto.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "hotai_success_rate",
			Help: "Relay success rate over the latest in-memory 5 minute window, as a percentage.",
		},
		[]string{"model", "group", "channel"},
	)

	activeConnections = promauto.NewGaugeFunc(
		prometheus.GaugeOpts{
			Name: "hotai_active_connections",
			Help: "Current active HTTP connections.",
		},
		func() float64 {
			return float64(httpstats.ActiveConnections())
		},
	)

	channelStatus = promauto.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "hotai_channel_status",
			Help: "Last observed channel status from relay traffic. 1 means selected request succeeded, 0 means selected request failed.",
		},
		[]string{"channel"},
	)
)

var _ = activeConnections

var successWindow sync.Map

type windowStats struct {
	mu      sync.Mutex
	started time.Time
	total   int64
	success int64
}

func RecordRelaySample(info *relaycommon.RelayInfo, success bool, outputTokens int64) {
	if info == nil {
		return
	}
	modelName := labelOrDefault(info.OriginModelName, "unknown")
	groupName := labelOrDefault(info.UsingGroup, "default")
	channelID := "unknown"
	if info.ChannelMeta != nil && info.ChannelId > 0 {
		channelID = strconv.Itoa(info.ChannelId)
	}
	statusCode := statusCodeLabel(info, success)

	requestTotal.WithLabelValues(modelName, groupName, channelID, statusCode).Inc()
	requestDurationMs.WithLabelValues(modelName, groupName, channelID).Observe(float64(time.Since(info.StartTime).Milliseconds()))

	if info.IsStream && info.HasSendResponse() {
		ttftMs.WithLabelValues(modelName, groupName, channelID).Observe(float64(info.FirstResponseTime.Sub(info.StartTime).Milliseconds()))
	}
	if promptTokens := info.GetEstimatePromptTokens(); promptTokens > 0 {
		tokensTotal.WithLabelValues(modelName, groupName, channelID, "prompt_estimated").Add(float64(promptTokens))
	}
	if outputTokens > 0 {
		tokensTotal.WithLabelValues(modelName, groupName, channelID, "completion").Add(float64(outputTokens))
	}
	if !success {
		upstreamErrorsTotal.WithLabelValues(modelName, channelID, statusCode).Inc()
		channelStatus.WithLabelValues(channelID).Set(0)
	} else {
		channelStatus.WithLabelValues(channelID).Set(1)
	}
	successRate.WithLabelValues(modelName, groupName, channelID).Set(recordSuccessWindow(modelName, groupName, channelID, success))
}

func labelOrDefault(value string, fallback string) string {
	if value == "" {
		return fallback
	}
	return value
}

func statusCodeLabel(info *relaycommon.RelayInfo, success bool) string {
	if success {
		return "200"
	}
	if info.LastError != nil && info.LastError.StatusCode > 0 {
		return strconv.Itoa(info.LastError.StatusCode)
	}
	return "0"
}

func recordSuccessWindow(modelName string, groupName string, channelID string, success bool) float64 {
	key := modelName + "\x00" + groupName + "\x00" + channelID
	actual, _ := successWindow.LoadOrStore(key, &windowStats{started: time.Now()})
	stats := actual.(*windowStats)
	stats.mu.Lock()
	defer stats.mu.Unlock()
	if time.Since(stats.started) > 5*time.Minute {
		stats.started = time.Now()
		stats.total = 0
		stats.success = 0
	}
	stats.total++
	if success {
		stats.success++
	}
	return float64(stats.success) / float64(stats.total) * 100
}
