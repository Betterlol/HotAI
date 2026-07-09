package routing

// ChannelData contains per-channel input for score calculation.
// All values are pre-computed by the caller (channel_cache.go).
type ChannelData struct {
	ChannelID    int
	BaseWeight   int
	ResponseTime int
	Cost         float64
	SuccessRate  float64 // [0,1] from channel success tracker; -1 if unknown
}

// ChannelScore holds the calculated score for a single channel
// with all intermediate dimensions for explainability.
type ChannelScore struct {
	ChannelID                  int
	FinalWeight                int
	BaseWeight                 int
	LatencyAdjustedWeight      int
	CostAdjustedWeight         int
	SuccessRateAdjustedWeight  int
}
