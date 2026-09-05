package middleware

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestDistributeDisabledAffinityFallsBackAndSelfHeals(t *testing.T) {
	oldDB, oldLogDB := model.DB, model.LOG_DB
	oldMemoryCacheEnabled := common.MemoryCacheEnabled
	dsn := fmt.Sprintf("file:distributor-affinity-%d?mode=memory&cache=shared", time.Now().UnixNano())
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.Channel{}, &model.Ability{}))
	model.DB, model.LOG_DB = db, db
	common.MemoryCacheEnabled = true
	t.Cleanup(func() {
		model.DB, model.LOG_DB = oldDB, oldLogDB
		common.MemoryCacheEnabled = oldMemoryCacheEnabled
	})

	disabled := model.Channel{Id: 7001, Type: constant.ChannelTypeOpenAI, Key: "disabled-test-key", Status: common.ChannelStatusManuallyDisabled, Name: "disabled", Models: "test-model", Group: "default"}
	healthy := model.Channel{Id: 7002, Type: constant.ChannelTypeOpenAI, Key: "healthy-test-key", Status: common.ChannelStatusEnabled, Name: "healthy", Models: "test-model", Group: "default"}
	require.NoError(t, db.Create(&disabled).Error)
	require.NoError(t, db.Create(&healthy).Error)
	require.NoError(t, db.Create(&model.Ability{Group: "default", Model: "test-model", ChannelId: healthy.Id, Enabled: true}).Error)
	model.InitChannelCache()

	setting := operation_setting.GetChannelAffinitySetting()
	originalSetting := *setting
	rule := operation_setting.ChannelAffinityRule{
		Name:               "disabled-channel-test",
		ModelRegex:         []string{"^test-model$"},
		PathRegex:          []string{"^/v1/chat/completions$"},
		KeySources:         []operation_setting.ChannelAffinityKeySource{{Type: "request_header", Key: "X-Affinity-Key"}},
		TTLSeconds:         60,
		SkipRetryOnFailure: true,
	}
	*setting = operation_setting.ChannelAffinitySetting{Enabled: true, SwitchOnSuccess: true, DefaultTTLSeconds: 60, Rules: []operation_setting.ChannelAffinityRule{rule}}
	t.Cleanup(func() { *setting = originalSetting })

	affinityKey := fmt.Sprintf("disabled-channel-%d", time.Now().UnixNano())
	seed, _ := gin.CreateTestContext(httptest.NewRecorder())
	seed.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	seed.Request.Header.Set("X-Affinity-Key", affinityKey)
	_, _ = service.GetPreferredChannelByAffinity(seed, "test-model", "default")
	service.RecordChannelAffinity(seed, disabled.Id)

	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.POST("/v1/chat/completions", func(c *gin.Context) {
		common.SetContextKey(c, constant.ContextKeyUsingGroup, "default")
	}, Distribute(), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"channel_id": common.GetContextKeyInt(c, constant.ContextKeyChannelId)})
	})

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/v1/chat/completions", strings.NewReader(`{"model":"test-model"}`))
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("X-Affinity-Key", affinityKey)
	router.ServeHTTP(recorder, request)

	require.Equal(t, http.StatusOK, recorder.Code)
	require.Contains(t, recorder.Body.String(), `"channel_id":7002`)

	verify, _ := gin.CreateTestContext(httptest.NewRecorder())
	verify.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	verify.Request.Header.Set("X-Affinity-Key", affinityKey)
	channelID, found := service.GetPreferredChannelByAffinity(verify, "test-model", "default")
	require.True(t, found)
	require.Equal(t, healthy.Id, channelID)
}
