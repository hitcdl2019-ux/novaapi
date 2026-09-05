package types

import "fmt"

type GroupRatioInfo struct {
	GroupRatio        float64
	GroupSpecialRatio float64
	HasSpecialRatio   bool
	DiscountSource    string
}

type PriceData struct {
	FreeModel                        bool
	ModelPrice                       float64
	ModelRatio                       float64
	CompletionRatio                  float64
	CacheRatio                       float64
	CacheCreationRatio               float64
	CacheCreation5mRatio             float64
	CacheCreation1hRatio             float64
	ImageRatio                       float64
	AudioRatio                       float64
	AudioCompletionRatio             float64
	OtherRatios                      map[string]float64
	UsePrice                         bool
	Quota                            int // 按次计费的最终额度（MJ / Task）
	QuotaToPreConsume                int // 按量计费的预消耗额度
	GroupRatioInfo                   GroupRatioInfo
	TaskVideoTierPricing             *TaskVideoTierPricing
	AllowPerCallCompletionAdjustment bool
}

type TaskVideoTierPricing struct {
	SelectedPriceUSDPer1M float64 `json:"selected_price_usd_per_1m,omitempty"`
	SelectedPriceCNYPer1M float64 `json:"selected_price_cny_per_1m,omitempty"`
	CNYExchangeRate       float64 `json:"cny_exchange_rate,omitempty"`
	Resolution            string  `json:"resolution,omitempty"`
	HasVideoInput         bool    `json:"has_video_input,omitempty"`
	Tier                  string  `json:"tier,omitempty"`
}

func (p *PriceData) AddOtherRatio(key string, ratio float64) {
	if p.OtherRatios == nil {
		p.OtherRatios = make(map[string]float64)
	}
	if ratio <= 0 {
		return
	}
	p.OtherRatios[key] = ratio
}

func (p *PriceData) ToSetting() string {
	return fmt.Sprintf("ModelPrice: %f, ModelRatio: %f, CompletionRatio: %f, CacheRatio: %f, GroupRatio: %f, UsePrice: %t, CacheCreationRatio: %f, CacheCreation5mRatio: %f, CacheCreation1hRatio: %f, QuotaToPreConsume: %d, ImageRatio: %f, AudioRatio: %f, AudioCompletionRatio: %f", p.ModelPrice, p.ModelRatio, p.CompletionRatio, p.CacheRatio, p.GroupRatioInfo.GroupRatio, p.UsePrice, p.CacheCreationRatio, p.CacheCreation5mRatio, p.CacheCreation1hRatio, p.QuotaToPreConsume, p.ImageRatio, p.AudioRatio, p.AudioCompletionRatio)
}
