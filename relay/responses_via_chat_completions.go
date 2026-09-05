package relay

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/relay/channel"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

func responsesViaChatCompletions(c *gin.Context, info *relaycommon.RelayInfo, adaptor channel.Adaptor, request *dto.OpenAIResponsesRequest) (*dto.Usage, *types.NewAPIError) {
	chatRequest, err := service.ResponsesRequestToChatCompletionsRequest(request)
	if err != nil {
		return nil, types.NewErrorWithStatusCode(err, types.ErrorCodeConvertRequestFailed, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
	}

	info.RelayMode = relayconstant.RelayModeChatCompletions
	info.RequestURLPath = "/v1/chat/completions"
	info.AppendRequestConversion(types.RelayFormatOpenAI)

	converted, err := adaptor.ConvertOpenAIRequest(c, info, chatRequest)
	if err != nil {
		return nil, types.NewError(err, types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
	}
	jsonData, err := common.Marshal(converted)
	if err != nil {
		return nil, types.NewError(err, types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
	}
	jsonData, err = relaycommon.RemoveDisabledFields(jsonData, info.ChannelOtherSettings, info.ChannelSetting.PassThroughBodyEnabled)
	if err != nil {
		return nil, types.NewError(err, types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
	}
	if len(info.ParamOverride) > 0 {
		jsonData, err = relaycommon.ApplyParamOverrideWithRelayInfo(jsonData, info)
		if err != nil {
			return nil, newAPIErrorFromParamOverride(err)
		}
	}

	response, err := adaptor.DoRequest(c, info, bytes.NewReader(jsonData))
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeDoRequestFailed, http.StatusInternalServerError)
	}
	httpResponse, ok := response.(*http.Response)
	if !ok || httpResponse == nil {
		return nil, types.NewOpenAIError(fmt.Errorf("invalid chat completions response type %T", response), types.ErrorCodeBadResponse, http.StatusInternalServerError)
	}
	if httpResponse.StatusCode < http.StatusOK || httpResponse.StatusCode >= http.StatusMultipleChoices {
		return nil, service.RelayErrorHandler(c.Request.Context(), httpResponse, false)
	}
	if info.IsStream {
		return chatCompletionsStreamToResponses(c, info, httpResponse)
	}
	return chatCompletionsResponseToResponses(c, info, httpResponse)
}

func chatCompletionsResponseToResponses(c *gin.Context, info *relaycommon.RelayInfo, response *http.Response) (*dto.Usage, *types.NewAPIError) {
	defer service.CloseResponseBodyGracefully(response)
	body, err := io.ReadAll(response.Body)
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeReadResponseBodyFailed, http.StatusInternalServerError)
	}
	var chat dto.OpenAITextResponse
	if err := common.Unmarshal(body, &chat); err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}
	if openAIError := chat.GetOpenAIError(); openAIError != nil && openAIError.Type != "" {
		return nil, types.WithOpenAIError(*openAIError, response.StatusCode)
	}

	converted, usage, err := buildResponsesResponse(&chat, info.UpstreamModelName)
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}
	data, err := common.Marshal(converted)
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}
	service.IOCopyBytesGracefully(c, response, data)
	return usage, nil
}

func buildResponsesResponse(chat *dto.OpenAITextResponse, fallbackModel string) (*dto.OpenAIResponsesResponse, *dto.Usage, error) {
	if chat == nil || len(chat.Choices) == 0 {
		return nil, nil, fmt.Errorf("chat completions response has no choices")
	}
	model := chat.Model
	if model == "" {
		model = fallbackModel
	}
	responseID := "resp_" + common.GetUUID()
	messageID := "msg_" + common.GetUUID()
	output := make([]dto.ResponsesOutput, 0, 1)
	message := chat.Choices[0].Message
	if text := message.StringContent(); text != "" {
		output = append(output, dto.ResponsesOutput{
			Type: "message", ID: messageID, Status: "completed", Role: "assistant",
			Content: []dto.ResponsesOutputContent{{Type: "output_text", Text: text, Annotations: []interface{}{}}},
		})
	}
	for _, toolCall := range message.ParseToolCalls() {
		arguments, err := common.Marshal(toolCall.Function.Arguments)
		if err != nil {
			return nil, nil, err
		}
		output = append(output, dto.ResponsesOutput{
			Type: "function_call", ID: "fc_" + common.GetUUID(), Status: "completed",
			CallId: toolCall.ID, Name: toolCall.Function.Name, Arguments: arguments,
		})
	}
	usage := chat.Usage
	usage.InputTokens = usage.PromptTokens
	usage.OutputTokens = usage.CompletionTokens
	usage.InputTokensDetails = &usage.PromptTokensDetails
	status, _ := common.Marshal("completed")
	return &dto.OpenAIResponsesResponse{
		ID: responseID, Object: "response", CreatedAt: int(time.Now().Unix()), Status: status,
		Model: model, Output: output, Usage: &usage,
	}, &usage, nil
}

type chatToolStreamState struct {
	OutputIndex int
	ItemID      string
	CallID      string
	Name        string
	Arguments   string
	Added       bool
}

func chatCompletionsStreamToResponses(c *gin.Context, info *relaycommon.RelayInfo, response *http.Response) (*dto.Usage, *types.NewAPIError) {
	defer service.CloseResponseBodyGracefully(response)
	helper.SetEventStreamHeaders(c)

	responseID := "resp_" + common.GetUUID()
	messageID := "msg_" + common.GetUUID()
	createdAt := int(time.Now().Unix())
	sequence := 0
	outputCount := 0
	textStarted := false
	textOutputIndex := -1
	text := ""
	tools := make(map[int]*chatToolStreamState)
	usage := &dto.Usage{}
	model := info.UpstreamModelName
	statusInProgress, _ := common.Marshal("in_progress")
	baseResponse := &dto.OpenAIResponsesResponse{ID: responseID, Object: "response", CreatedAt: createdAt, Status: statusInProgress, Model: model, Output: []dto.ResponsesOutput{}}

	send := func(eventType string, fields map[string]any) error {
		sequence++
		payload := map[string]any{"type": eventType, "sequence_number": sequence}
		for key, value := range fields {
			payload[key] = value
		}
		data, err := common.Marshal(payload)
		if err != nil {
			return err
		}
		streamEvent := dto.ResponsesStreamResponse{Type: eventType}
		helper.ResponseChunkData(c, streamEvent, string(data))
		return nil
	}
	if err := send("response.created", map[string]any{"response": baseResponse}); err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}
	if err := send("response.in_progress", map[string]any{"response": baseResponse}); err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}

	helper.StreamScannerHandler(c, response, info, func(data string, result *helper.StreamResult) {
		var chunk dto.ChatCompletionsStreamResponse
		if err := common.UnmarshalJsonStr(data, &chunk); err != nil {
			result.Stop(err)
			return
		}
		if chunk.Model != "" {
			model = chunk.Model
		}
		if chunk.Usage != nil {
			*usage = *chunk.Usage
		}
		if len(chunk.Choices) == 0 {
			return
		}
		delta := chunk.Choices[0].Delta
		if content := delta.GetContentString(); content != "" {
			if !textStarted {
				textStarted = true
				textOutputIndex = outputCount
				outputCount++
				item := dto.ResponsesOutput{Type: "message", ID: messageID, Status: "in_progress", Role: "assistant", Content: []dto.ResponsesOutputContent{}}
				if err := send("response.output_item.added", map[string]any{"output_index": textOutputIndex, "item": item}); err != nil {
					result.Stop(err)
					return
				}
				if err := send("response.content_part.added", map[string]any{"item_id": messageID, "output_index": textOutputIndex, "content_index": 0, "part": dto.ResponsesOutputContent{Type: "output_text", Text: "", Annotations: []interface{}{}}}); err != nil {
					result.Stop(err)
					return
				}
			}
			text += content
			if err := send("response.output_text.delta", map[string]any{"item_id": messageID, "output_index": textOutputIndex, "content_index": 0, "delta": content}); err != nil {
				result.Stop(err)
				return
			}
		}
		for position, toolCall := range delta.ToolCalls {
			index := position
			if toolCall.Index != nil {
				index = *toolCall.Index
			}
			state := tools[index]
			if state == nil {
				state = &chatToolStreamState{OutputIndex: outputCount, ItemID: "fc_" + common.GetUUID()}
				tools[index] = state
				outputCount++
			}
			if toolCall.ID != "" {
				state.CallID = toolCall.ID
			}
			if toolCall.Function.Name != "" {
				state.Name = toolCall.Function.Name
			}
			if !state.Added {
				state.Added = true
				arguments, _ := common.Marshal("")
				item := dto.ResponsesOutput{Type: "function_call", ID: state.ItemID, Status: "in_progress", CallId: state.CallID, Name: state.Name, Arguments: arguments}
				if err := send("response.output_item.added", map[string]any{"output_index": state.OutputIndex, "item": item}); err != nil {
					result.Stop(err)
					return
				}
			}
			if toolCall.Function.Arguments != "" {
				state.Arguments += toolCall.Function.Arguments
				if err := send("response.function_call_arguments.delta", map[string]any{"item_id": state.ItemID, "output_index": state.OutputIndex, "delta": toolCall.Function.Arguments}); err != nil {
					result.Stop(err)
					return
				}
			}
		}
	})
	if info.StreamStatus != nil && (!info.StreamStatus.IsNormalEnd() || info.StreamStatus.HasErrors()) {
		err := info.StreamStatus.EndError
		if err == nil {
			err = fmt.Errorf("chat completions stream ended abnormally: %s", info.StreamStatus.Summary())
		}
		failedStatus, _ := common.Marshal("failed")
		failed := &dto.OpenAIResponsesResponse{
			ID: responseID, Object: "response", CreatedAt: createdAt, Status: failedStatus,
			Model: model, Output: []dto.ResponsesOutput{}, Error: types.OpenAIError{Type: "upstream_error", Message: err.Error()},
		}
		if sendErr := send("response.failed", map[string]any{"response": failed}); sendErr != nil {
			logger.LogError(c, "failed to send synthetic response.failed: "+sendErr.Error())
		}
		return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}

	outputs := make([]dto.ResponsesOutput, outputCount)
	if textStarted {
		_ = send("response.output_text.done", map[string]any{"item_id": messageID, "output_index": textOutputIndex, "content_index": 0, "text": text})
		part := dto.ResponsesOutputContent{Type: "output_text", Text: text, Annotations: []interface{}{}}
		_ = send("response.content_part.done", map[string]any{"item_id": messageID, "output_index": textOutputIndex, "content_index": 0, "part": part})
		item := dto.ResponsesOutput{Type: "message", ID: messageID, Status: "completed", Role: "assistant", Content: []dto.ResponsesOutputContent{part}}
		_ = send("response.output_item.done", map[string]any{"output_index": textOutputIndex, "item": item})
		outputs[textOutputIndex] = item
	}
	for index := 0; index < len(tools); index++ {
		state := tools[index]
		if state == nil {
			continue
		}
		_ = send("response.function_call_arguments.done", map[string]any{"item_id": state.ItemID, "output_index": state.OutputIndex, "arguments": state.Arguments})
		arguments, _ := common.Marshal(state.Arguments)
		item := dto.ResponsesOutput{Type: "function_call", ID: state.ItemID, Status: "completed", CallId: state.CallID, Name: state.Name, Arguments: arguments}
		_ = send("response.output_item.done", map[string]any{"output_index": state.OutputIndex, "item": item})
		outputs[state.OutputIndex] = item
	}
	usage.InputTokens = usage.PromptTokens
	usage.OutputTokens = usage.CompletionTokens
	usage.InputTokensDetails = &usage.PromptTokensDetails
	if usage.TotalTokens == 0 {
		if usage.CompletionTokens == 0 && text != "" {
			usage.CompletionTokens = service.CountTextToken(text, model)
			usage.OutputTokens = usage.CompletionTokens
		}
		if usage.PromptTokens == 0 {
			usage.PromptTokens = info.GetEstimatePromptTokens()
			usage.InputTokens = usage.PromptTokens
		}
		usage.TotalTokens = usage.PromptTokens + usage.CompletionTokens
	}
	completedStatus, _ := common.Marshal("completed")
	completed := &dto.OpenAIResponsesResponse{ID: responseID, Object: "response", CreatedAt: createdAt, Status: completedStatus, Model: model, Output: outputs, Usage: usage}
	if err := send("response.completed", map[string]any{"response": completed}); err != nil {
		logger.LogError(c, "failed to send synthetic response.completed: "+err.Error())
	}
	return usage, nil
}
