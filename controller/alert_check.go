package controller

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/operation_setting"
)

const (
	alertCheckCooldownDuration = 30 * time.Minute
)

type alertCooldown struct {
	mu       sync.Mutex
	lastFired map[string]time.Time
}

var globalAlertCooldown = alertCooldown{
	lastFired: make(map[string]time.Time),
}

func (a *alertCooldown) shouldFire(key string) bool {
	a.mu.Lock()
	defer a.mu.Unlock()
	if t, ok := a.lastFired[key]; ok && time.Since(t) < alertCheckCooldownDuration {
		return false
	}
	a.lastFired[key] = time.Now()
	return true
}

type alertCheckHandler struct{}

func (alertCheckHandler) Type() string { return model.SystemTaskTypeAlertCheck }

func (alertCheckHandler) Enabled() bool {
	return operation_setting.GetAlertSetting().Enabled
}

func (alertCheckHandler) Interval() time.Duration { return time.Minute }

func (alertCheckHandler) NewPayload() any { return nil }

func (alertCheckHandler) Run(ctx context.Context, task *model.SystemTask, runnerID string) {
	setting := operation_setting.GetAlertSetting()
	if !setting.Enabled {
		finishSystemTaskHandler(task, runnerID, model.SystemTaskStatusSucceeded, nil, nil)
		return
	}

	checkSuccessRateDrop(ctx, setting)
	checkModelUnavailable(ctx, setting)

	finishSystemTaskHandler(task, runnerID, model.SystemTaskStatusSucceeded, nil, nil)
}

func checkSuccessRateDrop(ctx context.Context, setting operation_setting.AlertSetting) {
	if !setting.SuccessRateDropEnabled {
		return
	}

	threshold := setting.SuccessRateThreshold
	if threshold <= 0 || threshold > 100 {
		threshold = 95
	}

	fiveMinutesAgo := time.Now().Add(-5 * time.Minute).Unix()
	now := time.Now().Unix()

	summaries, err := model.GetPerfMetricsSummaryAll(fiveMinutesAgo, now, nil)
	if err != nil {
		common.SysLog(fmt.Sprintf("alert check A-01 query failed: %v", err))
		return
	}

	var totalRequests, totalSuccess int64
	for _, s := range summaries {
		totalRequests += s.RequestCount
		totalSuccess += s.SuccessCount
	}

	if totalRequests == 0 {
		return
	}

	successRate := float64(totalSuccess) / float64(totalRequests) * 100
	if successRate >= threshold {
		return
	}

	if !globalAlertCooldown.shouldFire("a-01:overall") {
		return
	}

	subject := fmt.Sprintf("告警: 平台成功率下降至 %.1f%%", successRate)
	content := fmt.Sprintf("最近 5 分钟平台整体请求成功率为 %.1f%% (阈值 %.1f%%)，总请求 %d，成功 %d，失败 %d。",
		successRate, threshold, totalRequests, totalSuccess, totalRequests-totalSuccess)
	sendAlertNotificationFunc(dto.NotifyTypeSuccessRateDrop, subject, content, []string{dto.NotifyTypeEmail, dto.NotifyTypeWebhook})
}

func checkModelUnavailable(ctx context.Context, setting operation_setting.AlertSetting) {
	if !setting.ModelUnavailableEnabled {
		return
	}

	fiveMinutesAgo := time.Now().Add(-5 * time.Minute).Unix()
	now := time.Now().Unix()

	summaries, err := model.GetPerfMetricsSummaryAll(fiveMinutesAgo, now, nil)
	if err != nil {
		common.SysLog(fmt.Sprintf("alert check A-02 query failed: %v", err))
		return
	}

	for _, s := range summaries {
		if s.RequestCount > 0 && s.SuccessCount == 0 {
			modelName := s.ModelName
			if !globalAlertCooldown.shouldFire(fmt.Sprintf("a-02:%s", modelName)) {
				continue
			}

			subject := fmt.Sprintf("告警: 模型 %s 全面不可用", modelName)
			content := fmt.Sprintf("模型「%s」最近 5 分钟所有请求均失败 (请求 %d，成功 0)。请检查该模型对应的渠道状态。",
				modelName, s.RequestCount)
			sendAlertNotificationFunc(dto.NotifyTypeModelUnavailable, subject, content, []string{dto.NotifyTypeEmail, dto.NotifyTypeWebhook, dto.NotifyTypeBark})
		}
	}
}

var sendAlertNotificationFunc = sendAlertNotification

func sendAlertNotification(notifyType, subject, content string, channels []string) {
	user := model.GetRootUser()
	if user == nil {
		common.SysLog("alert notification failed: no root user found")
		return
	}

	baseSetting := user.GetSetting()
	for _, ch := range channels {
		channelSetting := baseSetting
		channelSetting.NotifyType = ch
		if err := service.NotifyUser(user.Id, user.Email, channelSetting, dto.NewNotify(notifyType, subject, content, nil)); err != nil {
			common.SysLog(fmt.Sprintf("alert notify via %s failed: %v", ch, err))
		}
	}
}
