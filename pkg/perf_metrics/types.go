package perfmetrics

import (
	"sync"
	"sync/atomic"
)

type Store interface {
	Record(sample Sample)
	Query(params QueryParams) (QueryResult, error)
}

type Sample struct {
	Model        string
	Group        string
	LatencyMs    int64
	TtftMs       int64
	HasTtft      bool
	Success      bool
	OutputTokens int64
	GenerationMs int64
}

type QueryParams struct {
	Model string
	Group string
	Hours int
}

type BucketPoint struct {
	Ts           int64   `json:"ts"`
	AvgTtftMs    int64   `json:"avg_ttft_ms"`
	AvgLatencyMs int64   `json:"avg_latency_ms"`
	P50LatencyMs int64   `json:"p50_latency_ms"`
	P90LatencyMs int64   `json:"p90_latency_ms"`
	P95LatencyMs int64   `json:"p95_latency_ms"`
	P99LatencyMs int64   `json:"p99_latency_ms"`
	SuccessRate  float64 `json:"success_rate"`
	AvgTps       float64 `json:"avg_tps"`
}

type GroupResult struct {
	Group        string        `json:"group"`
	AvgTtftMs    int64         `json:"avg_ttft_ms"`
	AvgLatencyMs int64         `json:"avg_latency_ms"`
	P50LatencyMs int64         `json:"p50_latency_ms"`
	P90LatencyMs int64         `json:"p90_latency_ms"`
	P95LatencyMs int64         `json:"p95_latency_ms"`
	P99LatencyMs int64         `json:"p99_latency_ms"`
	SuccessRate  float64       `json:"success_rate"`
	AvgTps       float64       `json:"avg_tps"`
	Series       []BucketPoint `json:"series"`
}

type QueryResult struct {
	ModelName    string        `json:"model_name"`
	SeriesSchema string        `json:"series_schema"`
	Groups       []GroupResult `json:"groups"`
}

type ModelSummary struct {
	ModelName          string    `json:"model_name"`
	AvgLatencyMs       int64     `json:"avg_latency_ms"`
	P50LatencyMs       int64     `json:"p50_latency_ms"`
	P90LatencyMs       int64     `json:"p90_latency_ms"`
	P95LatencyMs       int64     `json:"p95_latency_ms"`
	P99LatencyMs       int64     `json:"p99_latency_ms"`
	SuccessRate        float64   `json:"success_rate"`
	AvgTps             float64   `json:"avg_tps"`
	RecentSuccessRates []float64 `json:"recent_success_rates,omitempty"`
	RequestCount       int64     `json:"request_count"`
}

type SummaryAllResult struct {
	Models []ModelSummary `json:"models"`
}

type bucketKey struct {
	model    string
	group    string
	bucketTs int64
}

type counters struct {
	requestCount   int64
	successCount   int64
	totalLatencyMs int64
	ttftSumMs      int64
	ttftCount      int64
	outputTokens   int64
	generationMs   int64
	p50LatencyMs   int64
	p90LatencyMs   int64
	p95LatencyMs   int64
	p99LatencyMs   int64
}

type atomicBucket struct {
	requestCount   atomic.Int64
	successCount   atomic.Int64
	totalLatencyMs atomic.Int64
	ttftSumMs      atomic.Int64
	ttftCount      atomic.Int64
	outputTokens   atomic.Int64
	generationMs   atomic.Int64
	latencyMu      sync.Mutex
	latencySamples []int64
	pending        percentileCounters
}

type percentileCounters struct {
	p50 int64
	p90 int64
	p95 int64
	p99 int64
}

func (b *atomicBucket) add(sample Sample) {
	b.requestCount.Add(1)
	if sample.Success {
		b.successCount.Add(1)
	}
	if sample.LatencyMs > 0 {
		b.totalLatencyMs.Add(sample.LatencyMs)
		b.latencyMu.Lock()
		b.latencySamples = append(b.latencySamples, sample.LatencyMs)
		b.latencyMu.Unlock()
	}
	if sample.HasTtft && sample.TtftMs >= 0 {
		b.ttftSumMs.Add(sample.TtftMs)
		b.ttftCount.Add(1)
	}
	if sample.OutputTokens > 0 && sample.GenerationMs > 0 {
		b.outputTokens.Add(sample.OutputTokens)
		b.generationMs.Add(sample.GenerationMs)
	}
}

func (b *atomicBucket) snapshot() counters {
	percentiles := b.snapshotPercentiles()
	return counters{
		requestCount:   b.requestCount.Load(),
		successCount:   b.successCount.Load(),
		totalLatencyMs: b.totalLatencyMs.Load(),
		ttftSumMs:      b.ttftSumMs.Load(),
		ttftCount:      b.ttftCount.Load(),
		outputTokens:   b.outputTokens.Load(),
		generationMs:   b.generationMs.Load(),
		p50LatencyMs:   percentiles.p50,
		p90LatencyMs:   percentiles.p90,
		p95LatencyMs:   percentiles.p95,
		p99LatencyMs:   percentiles.p99,
	}
}

func (b *atomicBucket) drain() counters {
	percentiles := b.drainPercentiles()
	return counters{
		requestCount:   b.requestCount.Swap(0),
		successCount:   b.successCount.Swap(0),
		totalLatencyMs: b.totalLatencyMs.Swap(0),
		ttftSumMs:      b.ttftSumMs.Swap(0),
		ttftCount:      b.ttftCount.Swap(0),
		outputTokens:   b.outputTokens.Swap(0),
		generationMs:   b.generationMs.Swap(0),
		p50LatencyMs:   percentiles.p50,
		p90LatencyMs:   percentiles.p90,
		p95LatencyMs:   percentiles.p95,
		p99LatencyMs:   percentiles.p99,
	}
}

func (b *atomicBucket) addCounters(c counters) {
	if c.requestCount != 0 {
		b.requestCount.Add(c.requestCount)
	}
	if c.successCount != 0 {
		b.successCount.Add(c.successCount)
	}
	if c.totalLatencyMs != 0 {
		b.totalLatencyMs.Add(c.totalLatencyMs)
	}
	if c.ttftSumMs != 0 {
		b.ttftSumMs.Add(c.ttftSumMs)
	}
	if c.ttftCount != 0 {
		b.ttftCount.Add(c.ttftCount)
	}
	if c.outputTokens != 0 {
		b.outputTokens.Add(c.outputTokens)
	}
	if c.generationMs != 0 {
		b.generationMs.Add(c.generationMs)
	}
	if c.p50LatencyMs != 0 || c.p90LatencyMs != 0 || c.p95LatencyMs != 0 || c.p99LatencyMs != 0 {
		b.latencyMu.Lock()
		b.pending = percentileCounters{p50: c.p50LatencyMs, p90: c.p90LatencyMs, p95: c.p95LatencyMs, p99: c.p99LatencyMs}
		b.latencyMu.Unlock()
	}
}

func (b *atomicBucket) snapshotPercentiles() percentileCounters {
	b.latencyMu.Lock()
	defer b.latencyMu.Unlock()
	if len(b.latencySamples) == 0 {
		return b.pending
	}
	return calculatePercentiles(b.latencySamples)
}

func (b *atomicBucket) drainPercentiles() percentileCounters {
	b.latencyMu.Lock()
	defer b.latencyMu.Unlock()
	if len(b.latencySamples) == 0 {
		pending := b.pending
		b.pending = percentileCounters{}
		return pending
	}
	percentiles := calculatePercentiles(b.latencySamples)
	b.latencySamples = nil
	b.pending = percentileCounters{}
	return percentiles
}
