package doubao

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/types"
	"github.com/stretchr/testify/assert"
)

func TestResolveSeedanceVideoTierPricing(t *testing.T) {
	oldRate := operation_setting.USDExchangeRate
	operation_setting.USDExchangeRate = 7.5
	defer func() { operation_setting.USDExchangeRate = oldRate }()

	req := relaycommon.TaskSubmitReq{
		Size: "720p",
		Metadata: map[string]interface{}{
			"content": []interface{}{
				map[string]interface{}{"type": "video_url"},
			},
		},
	}
	info := &relaycommon.RelayInfo{
		OriginModelName: "doubao-seedance-2-0-260128",
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelOtherSettings: dto.ChannelOtherSettings{
				SeedanceVideoTierPricesCNY: map[string]interface{}{
					"default": dto.SeedanceVideoTierPrices{
						P720WithVideoInput:     42,
						P720WithoutVideoInput:  70,
						P1080WithVideoInput:    54,
						P1080WithoutVideoInput: 90,
					},
				},
			},
		},
	}

	pricing := resolveSeedanceVideoTierPricing(req, info)

	if assert.NotNil(t, pricing) {
		assert.Equal(t, "720p_with_video_input", pricing.Tier)
		assert.Equal(t, 42.0, pricing.SelectedPriceCNYPer1M)
		assert.Equal(t, 42.0/7.5, pricing.SelectedPriceUSDPer1M)
	}
}

func TestSelectSeedanceVideoTierPricesSupportsDirectConfig(t *testing.T) {
	prices, ok := selectSeedanceVideoTierPrices(map[string]interface{}{
		"720p_with_video_input":     float64(42),
		"720p_without_video_input":  float64(70),
		"1080p_with_video_input":    float64(54),
		"1080p_without_video_input": float64(90),
	}, "doubao-seedance-2-0-260128")

	assert.True(t, ok)
	assert.Equal(t, 90.0, prices.P1080WithoutVideoInput)
}

func TestAdjustBillingOnCompleteUsesFrozenVideoTierPrice(t *testing.T) {
	task := &model.Task{
		PrivateData: model.TaskPrivateData{
			BillingContext: &model.TaskBillingContext{
				GroupRatio: 2,
				VideoTierPricing: &types.TaskVideoTierPricing{
					SelectedPriceUSDPer1M: 12,
				},
			},
		},
	}
	taskResult := &relaycommon.TaskInfo{
		Status:      string(model.TaskStatusSuccess),
		TotalTokens: 1_000_000,
	}

	actualQuota := (&TaskAdaptor{}).AdjustBillingOnComplete(task, taskResult)

	assert.Equal(t, int(12*common.QuotaPerUnit*2), actualQuota)
}
