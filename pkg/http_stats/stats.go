package httpstats

import "sync/atomic"

var activeConnections int64

func AddActiveConnection(delta int64) {
	atomic.AddInt64(&activeConnections, delta)
}

func ActiveConnections() int64 {
	return atomic.LoadInt64(&activeConnections)
}
