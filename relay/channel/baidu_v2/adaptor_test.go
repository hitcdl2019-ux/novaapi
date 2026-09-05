package baidu_v2

import (
	"testing"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/types"
)

func TestGetRequestURLClaude(t *testing.T) {
	adaptor := &Adaptor{}
	info := &relaycommon.RelayInfo{
		RelayMode:   constant.RelayModeUnknown,
		RelayFormat: types.RelayFormatClaude,
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelBaseUrl: "https://qianfan.baidubce.com",
		},
	}

	got, err := adaptor.GetRequestURL(info)
	if err != nil {
		t.Fatalf("GetRequestURL returned error: %v", err)
	}

	want := "https://qianfan.baidubce.com/v2/chat/completions"
	if got != want {
		t.Fatalf("GetRequestURL = %q, want %q", got, want)
	}
}
