package controller

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/ratio_setting"

	"github.com/gin-gonic/gin"
)

const pricePerTokenFactor = 2.0 / 1000000.0

func resolveModelMapping(channel *model.Channel) map[string]string {
	if channel == nil || channel.ModelMapping == nil || *channel.ModelMapping == "" {
		return nil
	}
	var m map[string]string
	if err := common.UnmarshalJsonStr(*channel.ModelMapping, &m); err != nil {
		return nil
	}
	return m
}

func SyncChannelPricing(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "无效的渠道 ID",
		})
		return
	}

	channel, err := model.GetChannelById(id, false)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	if err := syncChannelPricing(channel); err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("sync channel pricing failed: channel=%s, error=%v", channel.Name, err))
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "渠道定价同步成功",
		"data": gin.H{
			"channel_id":   channel.Id,
			"channel_name": channel.Name,
		},
	})
}

func SyncAllChannelPricing(c *gin.Context) {
	channels, err := model.GetAllChannels(0, 0, true, false)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	type syncResult struct {
		ChannelID   int    `json:"channel_id"`
		ChannelName string `json:"channel_name"`
		Success     bool   `json:"success"`
		Error       string `json:"error,omitempty"`
	}

	results := make([]syncResult, 0, len(channels))
	for _, channel := range channels {
		result := syncResult{
			ChannelID:   channel.Id,
			ChannelName: channel.Name,
		}
		if err := syncChannelPricing(channel); err != nil {
			result.Error = err.Error()
		} else {
			result.Success = true
		}
		results = append(results, result)
	}

	successCount := 0
	for _, r := range results {
		if r.Success {
			successCount++
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": fmt.Sprintf("同步完成：%d 成功，%d 失败", successCount, len(results)-successCount),
		"data":    results,
	})
}

func syncChannelPricing(channel *model.Channel) error {
	if channel == nil {
		return fmt.Errorf("渠道为空")
	}
	if channel.Models == "" {
		return fmt.Errorf("渠道 #%d (%s) 没有配置模型", channel.Id, channel.Name)
	}

	modelRatioMap := ratio_setting.GetModelRatioCopy()
	modelPriceMap := ratio_setting.GetModelPriceCopy()

	models := strings.Split(channel.Models, ",")
	mapping := make(map[string]map[string]float64)

	modelMapping := resolveModelMapping(channel)

	for _, modelName := range models {
		modelName = strings.TrimSpace(modelName)
		if modelName == "" {
			continue
		}

		// Use upstream model name as the PriceMapping key.
		// If the channel has a ModelMapping, resolve to the upstream name;
		// otherwise the user-facing name is also the upstream name.
		upstreamModel := modelName
		if mapped, ok := modelMapping[modelName]; ok && mapped != "" {
			upstreamModel = mapped
		}

		entry := make(map[string]float64)
		hasPrice := false

		if ratio, ok := modelRatioMap[upstreamModel]; ok && ratio > 0 {
			pricePerToken := ratio * pricePerTokenFactor
			if pricePerToken > 0 {
				entry["price_per_token"] = pricePerToken
				hasPrice = true
			}
		}

		if price, ok := modelPriceMap[upstreamModel]; ok && price > 0 {
			entry["price_per_request"] = price
			hasPrice = true
		}

		if hasPrice {
			mapping[upstreamModel] = entry
		}
	}

	if len(mapping) == 0 {
		return fmt.Errorf("渠道 #%d (%s) 的模型在系统定价中未找到对应数据，无法同步", channel.Id, channel.Name)
	}

	jsonBytes, err := common.Marshal(mapping)
	if err != nil {
		return fmt.Errorf("序列化定价数据失败: %w", err)
	}
	jsonStr := string(jsonBytes)

	channel.PriceMapping = &jsonStr
	if err := channel.Update(); err != nil {
		return fmt.Errorf("更新渠道定价失败: %w", err)
	}

	return nil
}


