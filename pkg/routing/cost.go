package routing

import "github.com/QuantumNous/new-api/setting/operation_setting"

// CostAdjustedWeight adjusts baseWeight by the channel's per-token cost
// relative to the cheapest channel. When cost routing is disabled or
// cost data is missing, baseWeight is returned unchanged.
func CostAdjustedWeight(baseWeight int, channelCost float64, lowestCost float64, setting operation_setting.CostRoutingSetting) int {
	if baseWeight <= 0 {
		return 0
	}
	if !setting.Enabled || lowestCost <= 0 || channelCost <= 0 {
		return baseWeight
	}
	factor := setting.CostWeight
	if factor < 0 {
		factor = 0
	}
	if factor > 1 {
		factor = 1
	}
	costRatio := lowestCost / channelCost
	if costRatio > 1 {
		costRatio = 1
	}
	adjusted := int(float64(baseWeight) * ((1 - factor) + factor*costRatio))
	if adjusted < 1 {
		return 1
	}
	return adjusted
}
