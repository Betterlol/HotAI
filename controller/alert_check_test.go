package controller

import (
	"testing"
	"time"

	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestAlertCooldownAllowsFirstFireAndBlocksRepeat(t *testing.T) {
	oldCooldown := globalAlertCooldown
	globalAlertCooldown = alertCooldown{lastFired: make(map[string]time.Time)}
	defer func() {
		globalAlertCooldown = oldCooldown
	}()

	assert.True(t, globalAlertCooldown.shouldFire("key1"))
	assert.False(t, globalAlertCooldown.shouldFire("key1"))
	assert.True(t, globalAlertCooldown.shouldFire("key2"))
	assert.False(t, globalAlertCooldown.shouldFire("key2"))
	assert.Len(t, globalAlertCooldown.lastFired, 2)
}

func withAlertDB(t *testing.T) (*gorm.DB, alertCooldown) {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.PerfMetric{}))
	oldDB := model.DB
	model.DB = db
	t.Cleanup(func() {
		model.DB = oldDB
	})

	oldCooldown := globalAlertCooldown
	fresh := alertCooldown{lastFired: make(map[string]time.Time)}
	globalAlertCooldown = fresh
	t.Cleanup(func() {
		globalAlertCooldown = oldCooldown
	})
	return db, fresh
}

func TestCheckSuccessRateDropFiresWhenBelowThreshold(t *testing.T) {
	_, cooldown := withAlertDB(t)

	now := time.Now().Unix()
	bucketTs := now - 60
	require.NoError(t, model.DB.Create(&model.PerfMetric{
		ModelName:    "gpt-test",
		Group:        "default",
		BucketTs:     bucketTs,
		RequestCount: 100,
		SuccessCount: 80,
	}).Error)

	origSender := sendAlertNotificationFunc
	sendAlertNotificationFunc = func(notifyType, subject, content string, channels []string) {}
	defer func() { sendAlertNotificationFunc = origSender }()

	setting := operation_setting.GetAlertSetting()
	setting.Enabled = true
	setting.SuccessRateDropEnabled = true
	setting.SuccessRateThreshold = 95

	checkSuccessRateDrop(nil, setting)

	assert.Contains(t, cooldown.lastFired, "a-01:overall")
}

func TestCheckSuccessRateDropSkipsWhenAboveThreshold(t *testing.T) {
	_, cooldown := withAlertDB(t)

	now := time.Now().Unix()
	bucketTs := now - 60
	require.NoError(t, model.DB.Create(&model.PerfMetric{
		ModelName:    "gpt-test",
		Group:        "default",
		BucketTs:     bucketTs,
		RequestCount: 100,
		SuccessCount: 96,
	}).Error)

	origSender := sendAlertNotificationFunc
	sendAlertNotificationFunc = func(notifyType, subject, content string, channels []string) {}
	defer func() { sendAlertNotificationFunc = origSender }()

	setting := operation_setting.GetAlertSetting()
	setting.Enabled = true
	setting.SuccessRateDropEnabled = true
	setting.SuccessRateThreshold = 95

	checkSuccessRateDrop(nil, setting)

	assert.Empty(t, cooldown.lastFired)
}

func TestCheckSuccessRateDropSkipsWhenNoTraffic(t *testing.T) {
	_, cooldown := withAlertDB(t)

	origSender := sendAlertNotificationFunc
	sendAlertNotificationFunc = func(notifyType, subject, content string, channels []string) {}
	defer func() { sendAlertNotificationFunc = origSender }()

	setting := operation_setting.GetAlertSetting()
	setting.Enabled = true
	setting.SuccessRateDropEnabled = true
	setting.SuccessRateThreshold = 95

	checkSuccessRateDrop(nil, setting)

	assert.Empty(t, cooldown.lastFired)
}

func TestCheckModelUnavailableFiresWhenAllFail(t *testing.T) {
	_, cooldown := withAlertDB(t)

	now := time.Now().Unix()
	bucketTs := now - 60
	require.NoError(t, model.DB.Create(&model.PerfMetric{
		ModelName:    "gpt-test",
		Group:        "default",
		BucketTs:     bucketTs,
		RequestCount: 50,
		SuccessCount: 0,
	}).Error)
	require.NoError(t, model.DB.Create(&model.PerfMetric{
		ModelName:    "claude-test",
		Group:        "default",
		BucketTs:     bucketTs,
		RequestCount: 30,
		SuccessCount: 30,
	}).Error)

	origSender := sendAlertNotificationFunc
	sendAlertNotificationFunc = func(notifyType, subject, content string, channels []string) {}
	defer func() { sendAlertNotificationFunc = origSender }()

	setting := operation_setting.GetAlertSetting()
	setting.Enabled = true
	setting.ModelUnavailableEnabled = true

	checkModelUnavailable(nil, setting)

	assert.Contains(t, cooldown.lastFired, "a-02:gpt-test")
	assert.NotContains(t, cooldown.lastFired, "a-02:claude-test")
}

func TestCheckModelUnavailableSkipsWhenModelHasSuccess(t *testing.T) {
	_, cooldown := withAlertDB(t)

	now := time.Now().Unix()
	bucketTs := now - 60
	require.NoError(t, model.DB.Create(&model.PerfMetric{
		ModelName:    "gpt-test",
		Group:        "default",
		BucketTs:     bucketTs,
		RequestCount: 50,
		SuccessCount: 1,
	}).Error)

	origSender := sendAlertNotificationFunc
	sendAlertNotificationFunc = func(notifyType, subject, content string, channels []string) {}
	defer func() { sendAlertNotificationFunc = origSender }()

	setting := operation_setting.GetAlertSetting()
	setting.Enabled = true
	setting.ModelUnavailableEnabled = true

	checkModelUnavailable(nil, setting)

	assert.Empty(t, cooldown.lastFired)
}

func TestCheckModelUnavailableRespectsCooldown(t *testing.T) {
	_, cooldown := withAlertDB(t)

	now := time.Now().Unix()
	bucketTs := now - 60
	require.NoError(t, model.DB.Create(&model.PerfMetric{
		ModelName:    "gpt-test",
		Group:        "default",
		BucketTs:     bucketTs,
		RequestCount: 50,
		SuccessCount: 0,
	}).Error)

	origSender := sendAlertNotificationFunc
	sendAlertNotificationFunc = func(notifyType, subject, content string, channels []string) {}
	defer func() { sendAlertNotificationFunc = origSender }()

	setting := operation_setting.GetAlertSetting()
	setting.Enabled = true
	setting.ModelUnavailableEnabled = true

	checkModelUnavailable(nil, setting)
	assert.Contains(t, cooldown.lastFired, "a-02:gpt-test")

	checkModelUnavailable(nil, setting)
	assert.Len(t, cooldown.lastFired, 1)
}

func TestAlertCheckHandlerEnabled(t *testing.T) {
	handler := alertCheckHandler{}
	assert.Equal(t, model.SystemTaskTypeAlertCheck, handler.Type())
	assert.Equal(t, time.Minute, handler.Interval())
	assert.Nil(t, handler.NewPayload())

	assert.False(t, handler.Enabled())
}
