package openaicompat

import (
	"errors"
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
)

func ResponsesRequestToChatCompletionsRequest(request *dto.OpenAIResponsesRequest) (*dto.GeneralOpenAIRequest, error) {
	if request == nil {
		return nil, errors.New("responses request is nil")
	}
	if request.PreviousResponseID != "" {
		return nil, errors.New("responses-to-chat compatibility does not support previous_response_id")
	}
	if len(request.Conversation) > 0 {
		return nil, errors.New("responses-to-chat compatibility does not support conversation")
	}
	if len(request.ContextManagement) > 0 {
		return nil, errors.New("responses-to-chat compatibility does not support context_management")
	}

	chat := &dto.GeneralOpenAIRequest{
		Model:                request.Model,
		Stream:               request.Stream,
		MaxCompletionTokens:  request.MaxOutputTokens,
		Temperature:          request.Temperature,
		TopP:                 request.TopP,
		TopLogProbs:          request.TopLogProbs,
		User:                 request.User,
		Metadata:             request.Metadata,
		PromptCacheRetention: request.PromptCacheRetention,
	}
	if request.Reasoning != nil {
		chat.ReasoningEffort = request.Reasoning.Effort
	}
	if request.Stream != nil && *request.Stream {
		chat.StreamOptions = &dto.StreamOptions{IncludeUsage: true}
	}
	if len(request.ParallelToolCalls) > 0 {
		var parallel bool
		if err := common.Unmarshal(request.ParallelToolCalls, &parallel); err != nil {
			return nil, fmt.Errorf("invalid parallel_tool_calls: %w", err)
		}
		chat.ParallelTooCalls = &parallel
	}

	instructions, err := rawString(request.Instructions)
	if err != nil {
		return nil, fmt.Errorf("invalid instructions: %w", err)
	}
	if instructions != "" {
		chat.Messages = append(chat.Messages, dto.Message{Role: "system", Content: instructions})
	}
	messages, err := responsesInputToMessages(request.Input)
	if err != nil {
		return nil, err
	}
	chat.Messages = append(chat.Messages, messages...)

	chat.Tools, err = responsesToolsToChatTools(request.Tools)
	if err != nil {
		return nil, err
	}
	chat.ToolChoice, err = responsesToolChoiceToChat(request.ToolChoice)
	if err != nil {
		return nil, err
	}
	return chat, nil
}

func responsesInputToMessages(raw []byte) ([]dto.Message, error) {
	if len(raw) == 0 {
		return nil, errors.New("responses-to-chat compatibility requires input")
	}
	if common.GetJsonType(raw) == "string" {
		text, err := rawString(raw)
		if err != nil {
			return nil, fmt.Errorf("invalid input: %w", err)
		}
		return []dto.Message{{Role: "user", Content: text}}, nil
	}

	var items []map[string]any
	if err := common.Unmarshal(raw, &items); err != nil {
		return nil, fmt.Errorf("invalid responses input: %w", err)
	}
	messages := make([]dto.Message, 0, len(items))
	for _, item := range items {
		itemType := common.Interface2String(item["type"])
		switch itemType {
		case "message", "":
			role := common.Interface2String(item["role"])
			if role == "" {
				role = "user"
			}
			content, err := responsesMessageContent(item["content"])
			if err != nil {
				return nil, err
			}
			messages = append(messages, dto.Message{Role: role, Content: content})
		case "function_call":
			arguments, err := argumentsString(item["arguments"])
			if err != nil {
				return nil, fmt.Errorf("invalid function_call arguments: %w", err)
			}
			toolCall := dto.ToolCallRequest{
				ID:   common.Interface2String(item["call_id"]),
				Type: "function",
				Function: dto.FunctionRequest{
					Name:      common.Interface2String(item["name"]),
					Arguments: arguments,
				},
			}
			message := dto.Message{Role: "assistant"}
			message.SetToolCalls([]dto.ToolCallRequest{toolCall})
			messages = append(messages, message)
		case "function_call_output":
			output, err := contentString(item["output"])
			if err != nil {
				return nil, fmt.Errorf("invalid function_call_output: %w", err)
			}
			messages = append(messages, dto.Message{Role: "tool", ToolCallId: common.Interface2String(item["call_id"]), Content: output})
		case "reasoning":
			// Encrypted reasoning cannot be represented by Chat Completions. The visible
			// conversation and tool calls remain sufficient for stateless continuation.
			continue
		default:
			return nil, fmt.Errorf("responses-to-chat compatibility does not support input item type %q", itemType)
		}
	}
	return messages, nil
}

func responsesMessageContent(value any) (any, error) {
	if text, ok := value.(string); ok {
		return text, nil
	}
	parts, ok := value.([]any)
	if !ok {
		return nil, errors.New("responses-to-chat compatibility requires string or array message content")
	}
	var text strings.Builder
	for _, partValue := range parts {
		part, ok := partValue.(map[string]any)
		if !ok {
			return nil, errors.New("invalid responses message content part")
		}
		typeName := common.Interface2String(part["type"])
		switch typeName {
		case "input_text", "output_text", "text":
			text.WriteString(common.Interface2String(part["text"]))
		default:
			return nil, fmt.Errorf("responses-to-chat compatibility does not support content type %q", typeName)
		}
	}
	return text.String(), nil
}

func responsesToolsToChatTools(raw []byte) ([]dto.ToolCallRequest, error) {
	if len(raw) == 0 {
		return nil, nil
	}
	var tools []map[string]any
	if err := common.Unmarshal(raw, &tools); err != nil {
		return nil, fmt.Errorf("invalid tools: %w", err)
	}
	result := make([]dto.ToolCallRequest, 0, len(tools))
	for _, tool := range tools {
		toolType := common.Interface2String(tool["type"])
		if toolType != "function" {
			return nil, fmt.Errorf("responses-to-chat compatibility does not support tool type %q", toolType)
		}
		result = append(result, dto.ToolCallRequest{
			Type: "function",
			Function: dto.FunctionRequest{
				Name:        common.Interface2String(tool["name"]),
				Description: common.Interface2String(tool["description"]),
				Parameters:  tool["parameters"],
			},
		})
	}
	return result, nil
}

func responsesToolChoiceToChat(raw []byte) (any, error) {
	if len(raw) == 0 {
		return nil, nil
	}
	if common.GetJsonType(raw) == "string" {
		var choice string
		if err := common.Unmarshal(raw, &choice); err != nil {
			return nil, err
		}
		return choice, nil
	}
	var choice map[string]any
	if err := common.Unmarshal(raw, &choice); err != nil {
		return nil, err
	}
	if common.Interface2String(choice["type"]) != "function" {
		return nil, fmt.Errorf("responses-to-chat compatibility does not support tool_choice type %q", choice["type"])
	}
	return map[string]any{"type": "function", "function": map[string]any{"name": choice["name"]}}, nil
}

func rawString(raw []byte) (string, error) {
	if len(raw) == 0 || string(raw) == "null" {
		return "", nil
	}
	var value string
	if err := common.Unmarshal(raw, &value); err != nil {
		return "", err
	}
	return value, nil
}

func contentString(value any) (string, error) {
	if text, ok := value.(string); ok {
		return text, nil
	}
	data, err := common.Marshal(value)
	return string(data), err
}

func argumentsString(value any) (string, error) {
	if text, ok := value.(string); ok {
		return text, nil
	}
	return contentString(value)
}
