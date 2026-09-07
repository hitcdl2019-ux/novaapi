package helper

import (
	"bytes"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/pkg/billingexpr"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/setting/billing_setting"
	"github.com/QuantumNous/new-api/setting/config"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestModelPriceHelperPerCallUsesTieredVideoPricing(t *testing.T) {
	gin.SetMode(gin.TestMode)

	saved := map[string]string{}
	require.NoError(t, config.GlobalConfig.SaveToDB(func(key, value string) error {
		saved[key] = value
		return nil
	}))
	t.Cleanup(func() {
		require.NoError(t, config.GlobalConfig.LoadFromDB(saved))
	})
	require.NoError(t, config.GlobalConfig.LoadFromDB(map[string]string{
		"billing_setting.billing_mode": `{"tiered-video-model":"tiered_expr"}`,
		"billing_setting.billing_expr": `{"tiered-video-model":"param(\"resolution\") == \"720p\" ? tier(\"720p_text\", c * cny(70)) : tier(\"unconfigured\", c * 0)"}`,
	}))

	body := []byte(`{"model":"tiered-video-model","prompt":"test","duration":5,"metadata":{"resolution":"720p","content":[]}}`)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/video/generations", io.NopCloser(bytes.NewReader(body)))
	ctx.Request.Header.Set("Content-Type", "application/json")
	ctx.Set("group", "default")
	info := &relaycommon.RelayInfo{
		OriginModelName: "tiered-video-model",
		UserGroup:       "default",
		UsingGroup:      "default",
		TaskRelayInfo:   &relaycommon.TaskRelayInfo{},
	}
	require.Nil(t, relaycommon.ValidateBasicTaskRequest(ctx, info, "generate"))

	priceData, err := ModelPriceHelperPerCall(ctx, info)
	require.NoError(t, err)
	require.True(t, priceData.UsePrice)
	require.Equal(t, "720p_text", info.TieredBillingSnapshot.EstimatedTier)
	require.NotNil(t, priceData.TaskVideoTierPricing)
	require.InDelta(t, 70/operation_setting.USDExchangeRate, priceData.TaskVideoTierPricing.SelectedPriceUSDPer1M, 1e-9)
	require.Equal(t, billingexpr.QuotaRound(5*1.5/operation_setting.USDExchangeRate*common.QuotaPerUnit), priceData.Quota)
	require.True(t, priceData.AllowPerCallCompletionAdjustment)
}

func TestModelPriceHelperTieredUsesPreloadedRequestInput(t *testing.T) {
	gin.SetMode(gin.TestMode)

	saved := map[string]string{}
	require.NoError(t, config.GlobalConfig.SaveToDB(func(key, value string) error {
		saved[key] = value
		return nil
	}))
	t.Cleanup(func() {
		require.NoError(t, config.GlobalConfig.LoadFromDB(saved))
	})

	require.NoError(t, config.GlobalConfig.LoadFromDB(map[string]string{
		"billing_setting.billing_mode": `{"tiered-test-model":"tiered_expr"}`,
		"billing_setting.billing_expr": `{"tiered-test-model":"param(\"stream\") == true ? tier(\"stream\", p * 3) : tier(\"base\", p * 2)"}`,
	}))

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	req := httptest.NewRequest(http.MethodPost, "/api/channel/test/1", nil)
	req.Body = nil
	req.ContentLength = 0
	req.Header.Set("Content-Type", "application/json")
	ctx.Request = req
	ctx.Set("group", "default")

	info := &relaycommon.RelayInfo{
		OriginModelName: "tiered-test-model",
		UserGroup:       "default",
		UsingGroup:      "default",
		RequestHeaders:  map[string]string{"Content-Type": "application/json"},
		BillingRequestInput: &billingexpr.RequestInput{
			Headers: map[string]string{"Content-Type": "application/json"},
			Body:    []byte(`{"stream":true}`),
		},
	}

	priceData, err := ModelPriceHelper(ctx, info, 1000, &types.TokenCountMeta{})
	require.NoError(t, err)
	require.Equal(t, 1500, priceData.QuotaToPreConsume)
	require.NotNil(t, info.TieredBillingSnapshot)
	require.Equal(t, "stream", info.TieredBillingSnapshot.EstimatedTier)
	require.Equal(t, billing_setting.BillingModeTieredExpr, info.TieredBillingSnapshot.BillingMode)
	require.Equal(t, common.QuotaPerUnit, info.TieredBillingSnapshot.QuotaPerUnit)
}
