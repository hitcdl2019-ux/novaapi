package controller

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

func Playground(c *gin.Context) {
	var newAPIError *types.NewAPIError

	defer func() {
		if newAPIError != nil {
			c.JSON(newAPIError.StatusCode, gin.H{
				"error": newAPIError.ToOpenAIError(),
			})
		}
	}()

	useAccessToken := c.GetBool("use_access_token")
	if useAccessToken {
		newAPIError = types.NewError(errors.New("暂不支持使用 access token"), types.ErrorCodeAccessDenied, types.ErrOptionWithSkipRetry())
		return
	}

	// Read request body
	bodyBytes, err := io.ReadAll(c.Request.Body)
	if err != nil {
		newAPIError = types.NewError(fmt.Errorf("error reading body: %w", err), types.ErrorCodeInvalidRequest, types.ErrOptionWithSkipRetry())
		return
	}
	c.Request.Body.Close()

	var requestBody map[string]interface{}
	if err := json.Unmarshal(bodyBytes, &requestBody); err != nil {
		newAPIError = types.NewError(fmt.Errorf("error parsing body: %w", err), types.ErrorCodeInvalidRequest, types.ErrOptionWithSkipRetry())
		return
	}

	// Check for web search and augment user message with results
	webSearch, _ := requestBody["web_search"].(bool)
	common.SysLog(fmt.Sprintf("[playground] web_search=%v", webSearch))
	if webSearch {
		messages, ok := requestBody["messages"].([]interface{})
		if ok && len(messages) > 0 {
			lastMsg, ok := messages[len(messages)-1].(map[string]interface{})
			if ok {
				userQuery, _ := lastMsg["content"].(string)
				if userQuery != "" {
					common.SysLog(fmt.Sprintf("[playground] searching: %s", userQuery))
					searchResults, err := service.SearchWithTavily(userQuery)
					if err != nil {
						common.SysLog(fmt.Sprintf("[playground] Tavily error: %v", err))
					} else {
						common.SysLog(fmt.Sprintf("[playground] Tavily OK: %d chars", len(searchResults)))
						lastMsg["content"] = searchResults + "\n\n---\nBased on the above web search results, answer: " + userQuery
						messages[len(messages)-1] = lastMsg
						requestBody["messages"] = messages
					}
				}
			}
		}
		delete(requestBody, "web_search")
	}

	// Rewrite request body
	newBody, _ := json.Marshal(requestBody)
	c.Request.Body = io.NopCloser(strings.NewReader(string(newBody)))
	c.Request.ContentLength = int64(len(newBody))

	// Determine relay format: image generation models use OpenAIImage format
	relayFormat := types.RelayFormatOpenAI
	if modelName, ok := requestBody["model"].(string); ok && common.IsImageGenerationModel(modelName) {
		// Convert chat messages to image prompt
		if messages, ok := requestBody["messages"].([]interface{}); ok && len(messages) > 0 {
			lastMsg, ok := messages[len(messages)-1].(map[string]interface{})
			if ok {
				if content, ok := lastMsg["content"].(string); ok && content != "" {
					requestBody["prompt"] = content
				}
			}
		}
		// Keep only image-related fields
		imageBody := map[string]interface{}{
			"model":  requestBody["model"],
			"prompt": requestBody["prompt"],
		}
		if _, ok := imageBody["prompt"]; !ok || imageBody["prompt"] == nil {
			imageBody["prompt"] = "Generate an image"
		}
		if n, ok := requestBody["n"]; ok {
			imageBody["n"] = n
		}
		if size, ok := requestBody["size"]; ok {
			imageBody["size"] = size
		}
		if quality, ok := requestBody["quality"]; ok {
			imageBody["quality"] = quality
		}
		if responseFormat, ok := requestBody["response_format"]; ok {
			imageBody["response_format"] = responseFormat
		}
		body, _ := json.Marshal(imageBody)
		common.SysLog(fmt.Sprintf("[playground] image request body: %s", string(body)))
		c.Request.Body = io.NopCloser(strings.NewReader(string(body)))
		c.Request.ContentLength = int64(len(body))
		common.CleanupBodyStorage(c)
		relayFormat = types.RelayFormatOpenAIImage
	}

	relayInfo, err := relaycommon.GenRelayInfo(c, relayFormat, nil, nil)
	if err != nil {
		newAPIError = types.NewError(err, types.ErrorCodeInvalidRequest, types.ErrOptionWithSkipRetry())
		return
	}

	userId := c.GetInt("id")

	userCache, err := model.GetUserCache(userId)
	if err != nil {
		newAPIError = types.NewError(err, types.ErrorCodeQueryDataError, types.ErrOptionWithSkipRetry())
		return
	}
	userCache.WriteContext(c)

	tempToken := &model.Token{
		UserId: userId,
		Name:   fmt.Sprintf("playground-%s", relayInfo.UsingGroup),
		Group:  relayInfo.UsingGroup,
	}
	_ = middleware.SetupContextForToken(c, tempToken)

	Relay(c, relayFormat)
}
