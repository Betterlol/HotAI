package perfmetrics

import "sort"

func calculatePercentiles(samples []int64) percentileCounters {
	if len(samples) == 0 {
		return percentileCounters{}
	}
	sorted := append([]int64(nil), samples...)
	sort.Slice(sorted, func(i, j int) bool {
		return sorted[i] < sorted[j]
	})
	return percentileCounters{
		p50: percentile(sorted, 50),
		p90: percentile(sorted, 90),
		p95: percentile(sorted, 95),
		p99: percentile(sorted, 99),
	}
}

func percentile(sorted []int64, p int) int64 {
	if len(sorted) == 0 {
		return 0
	}
	if p <= 0 {
		return sorted[0]
	}
	if p >= 100 {
		return sorted[len(sorted)-1]
	}
	index := (len(sorted)*p + 99) / 100
	if index <= 0 {
		return sorted[0]
	}
	if index > len(sorted) {
		return sorted[len(sorted)-1]
	}
	return sorted[index-1]
}
