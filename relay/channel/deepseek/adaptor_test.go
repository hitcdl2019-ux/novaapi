package deepseek

import (
	"reflect"
	"testing"

	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
)

func TestGetRequestURLResponses(t *testing.T) {
	adaptor := &Adaptor{}
	info := &relaycommon.RelayInfo{
		RelayMode: relayconstant.RelayModeResponses,
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelBaseUrl: "https://api.deepseek.com/",
		},
	}

	got, err := adaptor.GetRequestURL(info)
	if err != nil {
		t.Fatalf("GetRequestURL returned error: %v", err)
	}

	want := "https://api.deepseek.com/v1/responses"
	if got != want {
		t.Fatalf("GetRequestURL = %q, want %q", got, want)
	}
}

func TestConvertOpenAIResponsesRequestPassThrough(t *testing.T) {
	adaptor := &Adaptor{}
	request := dto.OpenAIResponsesRequest{
		Model: "deepseek-v4-pro",
		Input: []byte(`"hello"`),
	}

	got, err := adaptor.ConvertOpenAIResponsesRequest(nil, nil, request)
	if err != nil {
		t.Fatalf("ConvertOpenAIResponsesRequest returned error: %v", err)
	}

	gotRequest, ok := got.(dto.OpenAIResponsesRequest)
	if !ok {
		t.Fatalf("ConvertOpenAIResponsesRequest returned %T, want dto.OpenAIResponsesRequest", got)
	}
	if !reflect.DeepEqual(gotRequest, request) {
		t.Fatalf("ConvertOpenAIResponsesRequest = %#v, want %#v", gotRequest, request)
	}
}
