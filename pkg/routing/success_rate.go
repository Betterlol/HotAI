package routing

import (
	"github.com/QuantumNous/new-api/pkg/channel_successrate"
	"github.com/QuantumNous/new-api/setting/operation_setting"
)

// FillSuccessRate populates the SuccessRate field for each channel in the
// slice by querying the per-channel success tracker. Must be called from
// the caller before passing data to Engine.Calculate().
func FillSuccessRate(channels []ChannelData) {
	for i, ch := range channels {
		rate := channelsuccessrate.GetSuccessRate(ch.ChannelID)
		channels[i].SuccessRate = rate
	}
}

// SuccessRateAdjustedWeight adjusts baseWeight by the channel's historical
// success rate. When success rate routing is disabled or data is
// insufficient, baseWeight is returned unchanged.
func SuccessRateAdjustedWeight(baseWeight int, successRate float64, setting operation_setting.SuccessRateRoutingSetting) int {
	if baseWeight <= 0 {
		return 0
	}
	if !setting.Enabled || successRate < 0 {
		return baseWeight
	}
	factor := setting.WeightFactor
	if factor < 0 {
		factor = 0
	}
	if factor > 1 {
		factor = 1
	}
	adjusted := int(float64(baseWeight) * ((1 - factor) + factor*successRate))
	if adjusted < 1 {
		return 1
	}
	return adjusted
}
