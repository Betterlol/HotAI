package controller

import (
	"context"
	"net/http"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

type HealthResponse struct {
	Status  string `json:"status"`
	Uptime  string `json:"uptime"`
	Version string `json:"version"`
	DB      string `json:"db"`
	Redis   string `json:"redis,omitempty"`
	Memory  string `json:"memory,omitempty"`
}

func GetHealth(c *gin.Context) {
	uptime := time.Since(time.Unix(common.StartTime, 0)).String()

	dbStatus := "ok"
	if err := model.PingDB(); err != nil {
		dbStatus = "error: " + err.Error()
	}

	redisStatus := ""
	if common.RedisEnabled && common.RDB != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		defer cancel()
		if _, err := common.RDB.Ping(ctx).Result(); err != nil {
			redisStatus = "error: " + err.Error()
		} else {
			redisStatus = "ok"
		}
	}

	overallStatus := "ok"
	if dbStatus != "ok" || strings.HasPrefix(redisStatus, "error:") {
		overallStatus = "degraded"
	}

	memory := ""
	if common.MemoryCacheEnabled {
		memory = "enabled"
	} else {
		memory = "disabled"
	}

	c.JSON(http.StatusOK, HealthResponse{
		Status:  overallStatus,
		Uptime:  uptime,
		Version: common.Version,
		DB:      dbStatus,
		Redis:   redisStatus,
		Memory:  memory,
	})
}
