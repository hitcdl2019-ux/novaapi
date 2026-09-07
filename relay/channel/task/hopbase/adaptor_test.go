package hopbase

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestBuildRequestBodyPreservesHopBaseParameters(t *testing.T) {
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Set("task_request", relaycommon.TaskSubmitReq{
		Model: "public-model", Duration: 5,
		Metadata: map[string]interface{}{
			"resolution": "720p", "ratio": "16:9", "generate_audio": false,
			"content": []interface{}{map[string]interface{}{"type": "text", "text": "cat"}},
		},
	})
	info := &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{IsModelMapped: true, UpstreamModelName: "dreamina-seedance-2-5-260628"}}
	body, err := (&TaskAdaptor{}).BuildRequestBody(ctx, info)
	require.NoError(t, err)
	data, err := io.ReadAll(body)
	require.NoError(t, err)
	require.JSONEq(t, `{"model":"dreamina-seedance-2-5-260628","duration":5,"resolution":"720p","ratio":"16:9","generate_audio":false,"content":[{"type":"text","text":"cat"}]}`, string(data))
}

func TestDoResponseAndParseTask(t *testing.T) {
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	info := &relaycommon.RelayInfo{OriginModelName: "model", TaskRelayInfo: &relaycommon.TaskRelayInfo{PublicTaskID: "task_public"}}
	resp := &http.Response{Body: io.NopCloser(strings.NewReader(`{"task":{"id":"vt123"}}`))}
	id, _, taskErr := (&TaskAdaptor{}).DoResponse(ctx, resp, info)
	require.Nil(t, taskErr)
	require.Equal(t, "vt123", id)

	result, err := (&TaskAdaptor{}).ParseTaskResult([]byte(`{"status":"completed","outputs":["https://example.com/video.mp4"],"usage":{"completion_tokens":1234}}`))
	require.NoError(t, err)
	require.Equal(t, string(model.TaskStatusSuccess), result.Status)
	require.Equal(t, 1234, result.TotalTokens)
	require.Equal(t, "https://example.com/video.mp4", result.Url)
}

func TestAdjustBillingOnComplete(t *testing.T) {
	task := &model.Task{PrivateData: model.TaskPrivateData{BillingContext: &model.TaskBillingContext{GroupRatio: 1.5, VideoTierPricing: &types.TaskVideoTierPricing{SelectedPriceUSDPer1M: 10}}}}
	result := &relaycommon.TaskInfo{Status: string(model.TaskStatusSuccess), TotalTokens: 200_000}
	require.Equal(t, int(2*common.QuotaPerUnit*1.5), (&TaskAdaptor{}).AdjustBillingOnComplete(task, result))
}
