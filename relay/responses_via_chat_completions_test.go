package relay

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	appconstant "github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

type responsesViaChatTestAdaptor struct {
	request *dto.GeneralOpenAIRequest
	body    string
}

func (a *responsesViaChatTestAdaptor) Init(*relaycommon.RelayInfo) {}
func (a *responsesViaChatTestAdaptor) GetRequestURL(*relaycommon.RelayInfo) (string, error) {
	return "", nil
}
func (a *responsesViaChatTestAdaptor) SetupRequestHeader(*gin.Context, *http.Header, *relaycommon.RelayInfo) error {
	return nil
}
func (a *responsesViaChatTestAdaptor) ConvertOpenAIRequest(_ *gin.Context, _ *relaycommon.RelayInfo, request *dto.GeneralOpenAIRequest) (any, error) {
	a.request = request
	return request, nil
}
func (a *responsesViaChatTestAdaptor) ConvertRerankRequest(*gin.Context, int, dto.RerankRequest) (any, error) {
	return nil, nil
}
func (a *responsesViaChatTestAdaptor) ConvertEmbeddingRequest(*gin.Context, *relaycommon.RelayInfo, dto.EmbeddingRequest) (any, error) {
	return nil, nil
}
func (a *responsesViaChatTestAdaptor) ConvertAudioRequest(*gin.Context, *relaycommon.RelayInfo, dto.AudioRequest) (io.Reader, error) {
	return nil, nil
}
func (a *responsesViaChatTestAdaptor) ConvertImageRequest(*gin.Context, *relaycommon.RelayInfo, dto.ImageRequest) (any, error) {
	return nil, nil
}
func (a *responsesViaChatTestAdaptor) ConvertOpenAIResponsesRequest(*gin.Context, *relaycommon.RelayInfo, dto.OpenAIResponsesRequest) (any, error) {
	return nil, nil
}
func (a *responsesViaChatTestAdaptor) DoRequest(_ *gin.Context, _ *relaycommon.RelayInfo, body io.Reader) (any, error) {
	data, err := io.ReadAll(body)
	if err != nil {
		return nil, err
	}
	a.body = string(data)
	responseBody := `{"id":"chatcmpl_1","model":"glm-5.3","choices":[{"index":0,"message":{"role":"assistant","content":"ok"},"finish_reason":"stop"}],"usage":{"prompt_tokens":3,"completion_tokens":1,"total_tokens":4}}`
	return &http.Response{StatusCode: http.StatusOK, Body: io.NopCloser(strings.NewReader(responseBody)), Header: make(http.Header)}, nil
}
func (a *responsesViaChatTestAdaptor) DoResponse(*gin.Context, *http.Response, *relaycommon.RelayInfo) (any, *types.NewAPIError) {
	return nil, nil
}
func (a *responsesViaChatTestAdaptor) GetModelList() []string { return nil }
func (a *responsesViaChatTestAdaptor) GetChannelName() string { return "test" }
func (a *responsesViaChatTestAdaptor) ConvertClaudeRequest(*gin.Context, *relaycommon.RelayInfo, *dto.ClaudeRequest) (any, error) {
	return nil, nil
}
func (a *responsesViaChatTestAdaptor) ConvertGeminiRequest(*gin.Context, *relaycommon.RelayInfo, *dto.GeminiChatRequest) (any, error) {
	return nil, nil
}

func TestResponsesViaChatCompletionsConvertsRequestAndMode(t *testing.T) {
	request := &dto.OpenAIResponsesRequest{Model: "glm-5.3", Input: []byte(`"hello"`)}
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", nil)
	info := &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{UpstreamModelName: "glm-5.3"}}
	adaptor := &responsesViaChatTestAdaptor{}

	usage, apiErr := responsesViaChatCompletions(c, info, adaptor, request)

	require.Nil(t, apiErr)
	require.Equal(t, relayconstant.RelayModeChatCompletions, info.RelayMode)
	require.Equal(t, "/v1/chat/completions", info.RequestURLPath)
	require.NotNil(t, adaptor.request)
	require.Equal(t, "hello", adaptor.request.Messages[0].Content)
	require.Contains(t, adaptor.body, `"messages"`)
	require.Equal(t, 3, usage.InputTokens)
	require.Equal(t, 1, usage.OutputTokens)
}

func TestChatCompletionsResponseToResponses(t *testing.T) {
	body := `{"id":"chatcmpl_1","model":"glm-5.3","choices":[{"index":0,"message":{"role":"assistant","content":"hello","tool_calls":[{"id":"call_1","type":"function","function":{"name":"shell","arguments":"{\"cmd\":\"pwd\"}"}}]},"finish_reason":"tool_calls"}],"usage":{"prompt_tokens":10,"completion_tokens":4,"total_tokens":14}}`
	response := &http.Response{StatusCode: http.StatusOK, Body: io.NopCloser(strings.NewReader(body)), Header: make(http.Header)}
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	info := &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{UpstreamModelName: "glm-5.3"}}

	usage, apiErr := chatCompletionsResponseToResponses(c, info, response)
	require.Nil(t, apiErr)
	require.Equal(t, 10, usage.InputTokens)
	require.Equal(t, 4, usage.OutputTokens)

	var converted dto.OpenAIResponsesResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &converted))
	require.Equal(t, "response", converted.Object)
	require.Equal(t, "glm-5.3", converted.Model)
	require.Len(t, converted.Output, 2)
	require.Equal(t, "message", converted.Output[0].Type)
	require.Equal(t, "hello", converted.Output[0].Content[0].Text)
	require.Equal(t, "function_call", converted.Output[1].Type)
	require.Equal(t, "call_1", converted.Output[1].CallId)
	require.Equal(t, "shell", converted.Output[1].Name)
	require.Equal(t, `{"cmd":"pwd"}`, converted.Output[1].ArgumentsString())
}

func TestChatCompletionsStreamToResponses(t *testing.T) {
	oldTimeout := appconstant.StreamingTimeout
	appconstant.StreamingTimeout = 30
	t.Cleanup(func() { appconstant.StreamingTimeout = oldTimeout })

	sse := strings.Join([]string{
		`data: {"id":"chatcmpl_1","model":"glm-5.3","choices":[{"index":0,"delta":{"role":"assistant","content":"hel"},"finish_reason":null}]}`,
		`data: {"id":"chatcmpl_1","model":"glm-5.3","choices":[{"index":0,"delta":{"content":"lo"},"finish_reason":null}]}`,
		`data: {"id":"chatcmpl_1","model":"glm-5.3","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"id":"call_1","type":"function","function":{"name":"shell","arguments":"{\"cmd\":"}}]},"finish_reason":null}]}`,
		`data: {"id":"chatcmpl_1","model":"glm-5.3","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"\"pwd\"}"}}]},"finish_reason":"tool_calls"}],"usage":{"prompt_tokens":10,"completion_tokens":5,"total_tokens":15}}`,
		`data: [DONE]`,
		"",
	}, "\n\n")
	response := &http.Response{StatusCode: http.StatusOK, Body: io.NopCloser(strings.NewReader(sse)), Header: make(http.Header)}
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", nil)
	info := &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{UpstreamModelName: "glm-5.3"}}

	usage, apiErr := chatCompletionsStreamToResponses(c, info, response)
	require.Nil(t, apiErr)
	require.Equal(t, 10, usage.InputTokens)
	require.Equal(t, 5, usage.OutputTokens)

	result := recorder.Body.String()
	require.Contains(t, result, "event: response.created")
	require.Contains(t, result, `"type":"response.output_text.delta"`)
	require.Contains(t, result, `"delta":"hel"`)
	require.Contains(t, result, `"type":"response.function_call_arguments.delta"`)
	require.Contains(t, result, `"arguments":"{\"cmd\":\"pwd\"}"`)
	require.Contains(t, result, `"type":"response.completed"`)
}

func TestChatCompletionsStreamToResponsesDoesNotCompleteAfterInvalidChunk(t *testing.T) {
	oldTimeout := appconstant.StreamingTimeout
	appconstant.StreamingTimeout = 30
	t.Cleanup(func() { appconstant.StreamingTimeout = oldTimeout })

	response := &http.Response{
		StatusCode: http.StatusOK,
		Body:       io.NopCloser(strings.NewReader("data: {invalid}\n\n")),
		Header:     make(http.Header),
	}
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", nil)
	info := &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{UpstreamModelName: "glm-5.3"}}

	usage, apiErr := chatCompletionsStreamToResponses(c, info, response)

	require.Nil(t, usage)
	require.NotNil(t, apiErr)
	require.Contains(t, recorder.Body.String(), `"type":"response.failed"`)
	require.NotContains(t, recorder.Body.String(), `"type":"response.completed"`)
}
