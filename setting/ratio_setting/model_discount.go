package ratio_setting

import (
	"errors"
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/types"
)

// ModelDiscount 为全局模型折扣系数：模型名 -> 最终折扣系数。
// 1 表示不打折；0 表示免费；命中即使用该值。
var modelDiscountMap = types.NewRWMap[string, float64]()

// UserModelRatio 为个人模型折扣系数：userId -> (模型名 -> 最终折扣系数)。
// 用户命中后优先于全局模型折扣。
var userModelRatioMap = types.NewRWMap[string, map[string]float64]()

const DefaultModelDiscount = 1.0

func GetModelDiscount(name string) (float64, bool) {
	if discount, ok := modelDiscountMap.Get(name); ok {
		return discount, true
	}
	normalized := FormatMatchingModelName(name)
	if normalized != name {
		if discount, ok := modelDiscountMap.Get(normalized); ok {
			return discount, true
		}
	}
	return DefaultModelDiscount, false
}

func ModelDiscount2JSONString() string {
	return modelDiscountMap.MarshalJSONString()
}

func UpdateModelDiscountByJSONString(jsonStr string) error {
	return types.LoadFromJsonStringWithCallback(modelDiscountMap, jsonStr, InvalidateExposedDataCache)
}

func CheckModelDiscount(jsonStr string) error {
	checkMap := make(map[string]float64)
	if err := common.Unmarshal([]byte(jsonStr), &checkMap); err != nil {
		return err
	}
	for name, discount := range checkMap {
		if discount < 0 {
			return errors.New("model discount must be not less than 0: " + name)
		}
	}
	return nil
}

func GetModelDiscountCopy() map[string]float64 {
	return modelDiscountMap.ReadAll()
}

func GetUserModelRatio(userId int, modelName string) (float64, bool) {
	userRatios, ok := userModelRatioMap.Get(strconv.Itoa(userId))
	if !ok {
		return DefaultModelDiscount, false
	}
	if ratio, ok := userRatios[modelName]; ok {
		return ratio, true
	}
	normalized := FormatMatchingModelName(modelName)
	if normalized != modelName {
		if ratio, ok := userRatios[normalized]; ok {
			return ratio, true
		}
	}
	return DefaultModelDiscount, false
}

func GetUserModelRatioForUser(userId int) map[string]float64 {
	userRatios, ok := userModelRatioMap.Get(strconv.Itoa(userId))
	if !ok {
		return map[string]float64{}
	}
	result := make(map[string]float64, len(userRatios))
	for k, v := range userRatios {
		result[k] = v
	}
	return result
}

func UserModelRatio2JSONString() string {
	return userModelRatioMap.MarshalJSONString()
}

func UpdateUserModelRatioByJSONString(jsonStr string) error {
	return types.LoadFromJsonString(userModelRatioMap, jsonStr)
}

func CheckUserModelRatio(jsonStr string) error {
	checkMap := make(map[string]map[string]float64)
	if err := common.Unmarshal([]byte(jsonStr), &checkMap); err != nil {
		return err
	}
	for userId, ratios := range checkMap {
		for modelName, ratio := range ratios {
			if ratio < 0 {
				return errors.New("user model ratio must be not less than 0: user " + userId + ", model " + modelName)
			}
		}
	}
	return nil
}

// MergeUserModelRatioJSON 读取当前全量 map，替换指定 userId 段后返回完整 JSON 字符串。
func MergeUserModelRatioJSON(userId int, ratios map[string]float64) (string, error) {
	full := userModelRatioMap.ReadAll()
	key := strconv.Itoa(userId)
	if len(ratios) == 0 {
		delete(full, key)
	} else {
		copied := make(map[string]float64, len(ratios))
		for k, v := range ratios {
			copied[k] = v
		}
		full[key] = copied
	}
	bytes, err := common.Marshal(full)
	if err != nil {
		return "", err
	}
	return string(bytes), nil
}

// GetEffectiveModelDiscount 按 A 方案返回最终折扣系数及其来源：
// user_model（个人模型折扣） > model（全局模型折扣） > default（1）。
func GetEffectiveModelDiscount(userId int, modelName string) (float64, string) {
	if ratio, ok := GetUserModelRatio(userId, modelName); ok {
		return ratio, "user_model"
	}
	if discount, ok := GetModelDiscount(modelName); ok {
		return discount, "model"
	}
	return DefaultModelDiscount, "default"
}
