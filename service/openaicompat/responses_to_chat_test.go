package openaicompat

import (
	"testing"

	"github.com/QuantumNous/new-api/dto"
	"github.com/stretchr/testify/require"
)

func TestResponsesRequestToChatCompletionsRequest(t *testing.T) {
	stream := true
	zero := 0.0
	maxTokens := uint(1024)
	request := &dto.OpenAIResponsesRequest{
		Model:             "glm-5.3",
		Instructions:      []byte(`"follow instructions"`),
		Input:             []byte(`[{"type":"message","role":"user","content":[{"type":"input_text","text":"hello"}]},{"type":"function_call","call_id":"call_1","name":"shell","arguments":"{\"cmd\":\"pwd\"}"},{"type":"function_call_output","call_id":"call_1","output":"/tmp"}]`),
		Tools:             []byte(`[{"type":"function","name":"shell","description":"run a command","parameters":{"type":"object"}}]`),
		ToolChoice:        []byte(`{"type":"function","name":"shell"}`),
		ParallelToolCalls: []byte(`false`),
		Stream:            &stream,
		Temperature:       &zero,
		MaxOutputTokens:   &maxTokens,
		Reasoning:         &dto.Reasoning{Effort: "high"},
	}

	got, err := ResponsesRequestToChatCompletionsRequest(request)
	require.NoError(t, err)
	require.Equal(t, "glm-5.3", got.Model)
	require.Len(t, got.Messages, 4)
	require.Equal(t, "system", got.Messages[0].Role)
	require.Equal(t, "follow instructions", got.Messages[0].Content)
	require.Equal(t, "hello", got.Messages[1].Content)
	require.Len(t, got.Messages[2].ParseToolCalls(), 1)
	require.Equal(t, "call_1", got.Messages[3].ToolCallId)
	require.Equal(t, "/tmp", got.Messages[3].Content)
	require.Len(t, got.Tools, 1)
	require.Equal(t, "shell", got.Tools[0].Function.Name)
	require.Equal(t, "high", got.ReasoningEffort)
	require.NotNil(t, got.Temperature)
	require.Zero(t, *got.Temperature)
	require.NotNil(t, got.ParallelTooCalls)
	require.False(t, *got.ParallelTooCalls)
	require.NotNil(t, got.StreamOptions)
	require.True(t, got.StreamOptions.IncludeUsage)
}

func TestResponsesRequestToChatCompletionsRejectsStatefulAndHostedFeatures(t *testing.T) {
	t.Run("previous response", func(t *testing.T) {
		_, err := ResponsesRequestToChatCompletionsRequest(&dto.OpenAIResponsesRequest{
			Model:              "glm-5.3",
			Input:              []byte(`"hello"`),
			PreviousResponseID: "resp_123",
		})
		require.ErrorContains(t, err, "previous_response_id")
	})

	t.Run("hosted tool", func(t *testing.T) {
		_, err := ResponsesRequestToChatCompletionsRequest(&dto.OpenAIResponsesRequest{
			Model: "glm-5.3",
			Input: []byte(`"hello"`),
			Tools: []byte(`[{"type":"web_search_preview"}]`),
		})
		require.ErrorContains(t, err, "web_search_preview")
	})
}
