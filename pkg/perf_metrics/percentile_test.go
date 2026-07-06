package perfmetrics

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestCalculatePercentilesUsesNearestRank(t *testing.T) {
	percentiles := calculatePercentiles([]int64{400, 100, 300, 200})

	assert.Equal(t, int64(200), percentiles.p50)
	assert.Equal(t, int64(400), percentiles.p90)
	assert.Equal(t, int64(400), percentiles.p95)
	assert.Equal(t, int64(400), percentiles.p99)
}

func TestAtomicBucketSnapshotsAndDrainsPercentiles(t *testing.T) {
	bucket := &atomicBucket{}
	for _, latency := range []int64{100, 200, 300, 400} {
		bucket.add(Sample{Model: "gpt-test", Group: "default", LatencyMs: latency, Success: true})
	}

	snapshot := bucket.snapshot()
	assert.Equal(t, int64(200), snapshot.p50LatencyMs)
	assert.Equal(t, int64(400), snapshot.p90LatencyMs)
	assert.Equal(t, int64(4), snapshot.requestCount)

	drained := bucket.drain()
	assert.Equal(t, int64(200), drained.p50LatencyMs)
	assert.Equal(t, int64(400), drained.p99LatencyMs)
	assert.Equal(t, int64(4), drained.requestCount)

	afterDrain := bucket.snapshot()
	assert.Zero(t, afterDrain.requestCount)
	assert.Zero(t, afterDrain.p50LatencyMs)
}
