package controller

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func affinityRetryContext(t *testing.T) *gin.Context {
	t.Helper()

	setting := operation_setting.GetChannelAffinitySetting()
	original := *setting
	*setting = operation_setting.ChannelAffinitySetting{
		Enabled:           true,
		DefaultTTLSeconds: 60,
		Rules: []operation_setting.ChannelAffinityRule{
			{
				Name:               "retry-test",
				ModelRegex:         []string{"^test-model$"},
				PathRegex:          []string{"^/v1/chat/completions$"},
				KeySources:         []operation_setting.ChannelAffinityKeySource{{Type: "request_header", Key: "X-Affinity-Key"}},
				SkipRetryOnFailure: true,
			},
		},
	}
	t.Cleanup(func() { *setting = original })

	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	c.Request.Header.Set("X-Affinity-Key", "retry-test-key")
	_, _ = service.GetPreferredChannelByAffinity(c, "test-model", "default")
	require.True(t, service.ShouldSkipRetryAfterChannelAffinityFailure(c))
	return c
}

func TestShouldRetryChannelAffinityStatusMatrix(t *testing.T) {
	tests := []struct {
		name       string
		statusCode int
		retryTimes int
		want       bool
	}{
		{name: "429 retries on another channel", statusCode: http.StatusTooManyRequests, retryTimes: 1, want: true},
		{name: "429 respects exhausted retries", statusCode: http.StatusTooManyRequests, retryTimes: 0, want: false},
		{name: "500 remains fail-fast", statusCode: http.StatusInternalServerError, retryTimes: 1, want: false},
		{name: "503 remains fail-fast", statusCode: http.StatusServiceUnavailable, retryTimes: 1, want: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			c := affinityRetryContext(t)
			err := types.NewOpenAIError(errors.New("upstream error"), types.ErrorCodeBadResponseStatusCode, tt.statusCode)
			require.Equal(t, tt.want, shouldRetry(c, err, tt.retryTimes))
		})
	}
}

func TestShouldRetryTaskRelayChannelAffinityStatusMatrix(t *testing.T) {
	tests := []struct {
		name       string
		statusCode int
		retryTimes int
		want       bool
	}{
		{name: "429 retries on another channel", statusCode: http.StatusTooManyRequests, retryTimes: 1, want: true},
		{name: "429 respects exhausted retries", statusCode: http.StatusTooManyRequests, retryTimes: 0, want: false},
		{name: "500 remains fail-fast", statusCode: http.StatusInternalServerError, retryTimes: 1, want: false},
		{name: "503 remains fail-fast", statusCode: http.StatusServiceUnavailable, retryTimes: 1, want: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			c := affinityRetryContext(t)
			err := &dto.TaskError{StatusCode: tt.statusCode}
			require.Equal(t, tt.want, shouldRetryTaskRelay(c, 1, err, tt.retryTimes))
		})
	}
}
