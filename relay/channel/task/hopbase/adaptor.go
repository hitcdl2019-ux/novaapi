package hopbase

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relay/channel"
	"github.com/QuantumNous/new-api/relay/channel/task/taskcommon"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
	"github.com/tidwall/gjson"
)

type TaskAdaptor struct {
	taskcommon.BaseBilling
	baseURL string
	apiKey  string
}

func (a *TaskAdaptor) Init(info *relaycommon.RelayInfo) {
	a.baseURL = strings.TrimRight(info.ChannelBaseUrl, "/")
	a.apiKey = info.ApiKey
}

func (a *TaskAdaptor) ValidateRequestAndSetAction(c *gin.Context, info *relaycommon.RelayInfo) *dto.TaskError {
	var req relaycommon.TaskSubmitReq
	if err := common.UnmarshalBodyReusable(c, &req); err != nil {
		return service.TaskErrorWrapperLocal(err, "invalid_request", http.StatusBadRequest)
	}
	if strings.TrimSpace(req.Model) == "" {
		return service.TaskErrorWrapperLocal(fmt.Errorf("model field is required"), "missing_model", http.StatusBadRequest)
	}
	content, _ := req.Metadata["content"].([]interface{})
	if strings.TrimSpace(req.Prompt) == "" && len(content) == 0 {
		return service.TaskErrorWrapperLocal(fmt.Errorf("prompt or content is required"), "invalid_request", http.StatusBadRequest)
	}
	info.Action = constant.TaskActionGenerate
	c.Set("task_request", req)
	return nil
}

func (a *TaskAdaptor) BuildRequestURL(_ *relaycommon.RelayInfo) (string, error) {
	return a.baseURL + "/v1/video/generate", nil
}

func (a *TaskAdaptor) BuildRequestHeader(_ *gin.Context, req *http.Request, _ *relaycommon.RelayInfo) error {
	req.Header.Set("Authorization", "Bearer "+a.apiKey)
	req.Header.Set("Content-Type", "application/json")
	return nil
}

func (a *TaskAdaptor) BuildRequestBody(c *gin.Context, info *relaycommon.RelayInfo) (io.Reader, error) {
	req, err := relaycommon.GetTaskRequest(c)
	if err != nil {
		return nil, err
	}
	body := make(map[string]interface{}, len(req.Metadata)+4)
	for k, v := range req.Metadata {
		body[k] = v
	}
	body["model"] = req.Model
	if info.IsModelMapped {
		body["model"] = info.UpstreamModelName
	}
	if req.Duration != 0 {
		body["duration"] = req.Duration
	}
	if _, ok := body["content"]; !ok && strings.TrimSpace(req.Prompt) != "" {
		body["content"] = []interface{}{map[string]interface{}{"type": "text", "text": req.Prompt}}
	}
	data, err := common.Marshal(body)
	return bytes.NewReader(data), err
}

func (a *TaskAdaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, body io.Reader) (*http.Response, error) {
	return channel.DoTaskApiRequest(a, c, info, body)
}

func (a *TaskAdaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (string, []byte, *dto.TaskError) {
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", nil, service.TaskErrorWrapper(err, "read_response_body_failed", http.StatusInternalServerError)
	}
	_ = resp.Body.Close()
	taskID := firstString(body, "task.id", "data.task.id", "data.id", "id")
	if taskID == "" {
		return "", body, service.TaskErrorWrapper(fmt.Errorf("task.id is empty: %s", body), "invalid_response", http.StatusBadGateway)
	}
	video := dto.NewOpenAIVideo()
	video.ID, video.TaskID, video.Model, video.CreatedAt = info.PublicTaskID, info.PublicTaskID, info.OriginModelName, time.Now().Unix()
	c.JSON(http.StatusOK, video)
	return taskID, body, nil
}

func (a *TaskAdaptor) FetchTask(baseURL, key string, body map[string]any, proxy string) (*http.Response, error) {
	taskID, ok := body["task_id"].(string)
	if !ok || taskID == "" {
		return nil, fmt.Errorf("invalid task_id")
	}
	req, err := http.NewRequest(http.MethodGet, strings.TrimRight(baseURL, "/")+"/v1/video/tasks/"+taskID, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+key)
	client, err := service.GetHttpClientWithProxy(proxy)
	if err != nil {
		return nil, err
	}
	return client.Do(req)
}

func (a *TaskAdaptor) ParseTaskResult(body []byte) (*relaycommon.TaskInfo, error) {
	status := firstString(body, "status", "task.status", "data.status", "data.task.status")
	result := &relaycommon.TaskInfo{}
	switch strings.ToLower(status) {
	case "pending":
		result.Status, result.Progress = string(model.TaskStatusQueued), "20%"
	case "processing":
		result.Status, result.Progress = string(model.TaskStatusInProgress), "50%"
	case "completed":
		result.Status, result.Progress = string(model.TaskStatusSuccess), "100%"
	case "failed":
		result.Status, result.Progress = string(model.TaskStatusFailure), "100%"
	default:
		return nil, fmt.Errorf("unknown HopBase task status %q", status)
	}
	result.TotalTokens = int(firstInt(body, "usage.completion_tokens", "task.usage.completion_tokens", "data.usage.completion_tokens"))
	result.Url = firstString(body, "outputs.0.url", "outputs.0", "task.outputs.0.url", "task.outputs.0", "data.outputs.0.url", "data.outputs.0")
	result.Reason = firstString(body, "error.message", "task.error.message", "data.error.message", "message")
	return result, nil
}

func (a *TaskAdaptor) AdjustBillingOnComplete(task *model.Task, result *relaycommon.TaskInfo) int {
	if task == nil || result == nil || result.Status != string(model.TaskStatusSuccess) || result.TotalTokens <= 0 {
		return 0
	}
	ctx := task.PrivateData.BillingContext
	if ctx == nil || ctx.VideoTierPricing == nil {
		return 0
	}
	return int(float64(result.TotalTokens) * ctx.VideoTierPricing.SelectedPriceUSDPer1M / 1_000_000 * common.QuotaPerUnit * ctx.GroupRatio)
}

func (a *TaskAdaptor) ConvertToOpenAIVideo(task *model.Task) ([]byte, error) {
	result, err := a.ParseTaskResult(task.Data)
	if err != nil {
		return nil, err
	}
	video := dto.NewOpenAIVideo()
	video.ID, video.TaskID, video.Model = task.TaskID, task.TaskID, task.Properties.OriginModelName
	video.Status = task.Status.ToVideoStatus()
	video.SetProgressStr(task.Progress)
	video.SetMetadata("url", result.Url)
	return common.Marshal(video)
}

func (a *TaskAdaptor) GetModelList() []string { return []string{} }
func (a *TaskAdaptor) GetChannelName() string { return "HopBase" }

func firstString(body []byte, paths ...string) string {
	for _, path := range paths {
		if v := gjson.GetBytes(body, path); v.Exists() {
			if s := v.String(); s != "" {
				return s
			}
		}
	}
	return ""
}
func firstInt(body []byte, paths ...string) int64 {
	for _, path := range paths {
		if v := gjson.GetBytes(body, path); v.Exists() {
			return v.Int()
		}
	}
	return 0
}

var _ channel.TaskAdaptor = (*TaskAdaptor)(nil)
var _ channel.OpenAIVideoConverter = (*TaskAdaptor)(nil)
