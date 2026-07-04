package ratio_setting

import (
	"errors"
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/types"
)

// userVendorRatioMap 存储 (用户 × 厂商) 的专属分组倍率覆盖。
// 结构:{ "<userId>": { "<vendorId>": ratio } }
// 命中时直接作为最终 GroupRatio(替换语义),忽略基础分组倍率。
var userVendorRatioMap = types.NewRWMap[string, map[string]float64]()

// GetUserVendorRatio 返回指定用户在指定厂商上的专属倍率。
// 未配置时返回 (-1, false)。
func GetUserVendorRatio(userId, vendorId int) (float64, bool) {
	vm, ok := userVendorRatioMap.Get(strconv.Itoa(userId))
	if !ok {
		return -1, false
	}
	ratio, ok := vm[strconv.Itoa(vendorId)]
	if !ok {
		return -1, false
	}
	return ratio, true
}

func UserVendorRatio2JSONString() string {
	return userVendorRatioMap.MarshalJSONString()
}

func UpdateUserVendorRatioByJSONString(jsonStr string) error {
	return types.LoadFromJsonString(userVendorRatioMap, jsonStr)
}

// CheckUserVendorRatio 校验 JSON 字符串是否为合法的 map[string]map[string]float64,
// 且所有倍率非负。
func CheckUserVendorRatio(jsonStr string) error {
	checkMap := make(map[string]map[string]float64)
	if err := common.Unmarshal([]byte(jsonStr), &checkMap); err != nil {
		return err
	}
	for userId, vendorRatios := range checkMap {
		for vendorId, ratio := range vendorRatios {
			if ratio < 0 {
				return errors.New("user vendor ratio must be not less than 0: user " + userId + ", vendor " + vendorId)
			}
		}
	}
	return nil
}

// GetUserVendorRatioForUser 返回指定用户的 {vendorId: ratio} 拷贝(无配置则空 map)。
func GetUserVendorRatioForUser(userId int) map[string]float64 {
	vm, ok := userVendorRatioMap.Get(strconv.Itoa(userId))
	if !ok {
		return map[string]float64{}
	}
	result := make(map[string]float64, len(vm))
	for k, v := range vm {
		result[k] = v
	}
	return result
}

// MergeUserVendorRatioJSON 读取当前全量 map,替换指定 userId 段后返回合并后的完整 JSON 字符串。
// ratios 为空则删除该 userId 键。不直接修改内存 map,由 model.UpdateOption 统一持久化并重载。
func MergeUserVendorRatioJSON(userId int, ratios map[string]float64) (string, error) {
	full := userVendorRatioMap.ReadAll()
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
