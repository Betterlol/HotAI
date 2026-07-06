package model

import (
	"testing"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestUpsertPerfMetricStoresLatencyPercentiles(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&PerfMetric{}))
	oldDB := DB
	DB = db
	t.Cleanup(func() {
		DB = oldDB
	})

	require.NoError(t, UpsertPerfMetric(&PerfMetric{
		ModelName:      "gpt-test",
		Group:          "default",
		BucketTs:       100,
		RequestCount:   4,
		SuccessCount:   3,
		TotalLatencyMs: 1000,
		P50LatencyMs:   200,
		P90LatencyMs:   400,
		P95LatencyMs:   400,
		P99LatencyMs:   400,
	}))

	rows, err := GetPerfMetrics("gpt-test", "default", 0, 200)
	require.NoError(t, err)
	require.Len(t, rows, 1)
	assert.Equal(t, int64(200), rows[0].P50LatencyMs)
	assert.Equal(t, int64(400), rows[0].P99LatencyMs)
}
