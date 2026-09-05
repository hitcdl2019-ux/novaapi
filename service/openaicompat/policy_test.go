package openaicompat

import (
	"testing"

	"github.com/QuantumNous/new-api/setting/model_setting"
	"github.com/stretchr/testify/require"
)

func TestShouldResponsesUseChatCompletionsPolicy(t *testing.T) {
	policy := model_setting.ChatCompletionsToResponsesPolicy{
		Enabled:       true,
		ChannelTypes:  []int{26, 35},
		ModelPatterns: []string{`^glm-.*$`, `^MiniMax-.*$`},
	}

	require.True(t, ShouldChatCompletionsUseResponsesPolicy(policy, 0, 26, "glm-5.3"))
	require.True(t, ShouldChatCompletionsUseResponsesPolicy(policy, 0, 35, "MiniMax-M2.1"))
	require.False(t, ShouldChatCompletionsUseResponsesPolicy(policy, 0, 18, "deepseek-v4-pro"))
	require.False(t, ShouldChatCompletionsUseResponsesPolicy(policy, 0, 26, "deepseek-v4-pro"))
}

func TestShouldResponsesUseChatCompletionsPolicyDisabled(t *testing.T) {
	policy := model_setting.ChatCompletionsToResponsesPolicy{
		Enabled:       false,
		AllChannels:   true,
		ModelPatterns: []string{`.*`},
	}

	require.False(t, ShouldChatCompletionsUseResponsesPolicy(policy, 1, 26, "glm-5.3"))
}
