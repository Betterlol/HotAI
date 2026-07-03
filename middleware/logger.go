package middleware

import (
	"fmt"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-gonic/gin"
)

const RouteTagKey = "route_tag"

type ginLogEntry struct {
	Level     string `json:"level"`
	Time      string `json:"time"`
	RequestID string `json:"request_id,omitempty"`
	RouteTag  string `json:"route_tag"`
	Status    int    `json:"status"`
	LatencyMs int64  `json:"latency_ms"`
	ClientIP  string `json:"client_ip"`
	Method    string `json:"method"`
	Path      string `json:"path"`
	Msg       string `json:"msg"`
}

func RouteTag(tag string) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Set(RouteTagKey, tag)
		c.Next()
	}
}

func SetUpLogger(server *gin.Engine) {
	server.Use(gin.LoggerWithFormatter(func(param gin.LogFormatterParams) string {
		var requestID string
		if param.Keys != nil {
			requestID, _ = param.Keys[common.RequestIdKey].(string)
		}
		tag, _ := param.Keys[RouteTagKey].(string)
		if tag == "" {
			tag = "web"
		}
		if common.IsJSONLogFormat() {
			entry := ginLogEntry{
				Level:     "INFO",
				Time:      param.TimeStamp.Format(time.RFC3339Nano),
				RequestID: requestID,
				RouteTag:  tag,
				Status:    param.StatusCode,
				LatencyMs: param.Latency.Milliseconds(),
				ClientIP:  param.ClientIP,
				Method:    param.Method,
				Path:      param.Path,
				Msg:       fmt.Sprintf("%s %s", param.Method, param.Path),
			}
			if data, err := common.Marshal(entry); err == nil {
				return string(data) + "\n"
			}
		}
		return fmt.Sprintf("[GIN] %s | %s | %s | %3d | %13v | %15s | %7s %s\n",
			param.TimeStamp.Format("2006/01/02 - 15:04:05"),
			tag,
			requestID,
			param.StatusCode,
			param.Latency,
			param.ClientIP,
			param.Method,
			param.Path,
		)
	}))
}
