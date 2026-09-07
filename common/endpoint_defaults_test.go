package common

import (
	"testing"

	"github.com/QuantumNous/new-api/constant"
)

func TestDefaultOpenAIVideoEndpoint(t *testing.T) {
	info, ok := GetDefaultEndpointInfo(constant.EndpointTypeOpenAIVideo)
	if !ok {
		t.Fatal("OpenAI video endpoint is not registered")
	}
	if info.Path != "/v1/video/generations" || info.Method != "POST" {
		t.Fatalf("unexpected OpenAI video endpoint: %+v", info)
	}
}
