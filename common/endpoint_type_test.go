package common

import (
	"reflect"
	"testing"

	"github.com/QuantumNous/new-api/constant"
)

func TestGetEndpointTypesByChannelTypeDeepSeek(t *testing.T) {
	got := GetEndpointTypesByChannelType(constant.ChannelTypeDeepSeek, "deepseek-v4-pro")
	want := []constant.EndpointType{constant.EndpointTypeOpenAI, constant.EndpointTypeOpenAIResponse}

	if !reflect.DeepEqual(got, want) {
		t.Fatalf("GetEndpointTypesByChannelType = %#v, want %#v", got, want)
	}
}
