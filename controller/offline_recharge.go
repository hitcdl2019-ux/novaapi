package controller

import (
	"errors"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

const offlineRechargeUploadDir = "upload/offline-recharge"

type createOfflineRechargeRequest struct {
	Amount          float64 `json:"amount"`
	ContactName     string  `json:"contact_name"`
	ContactMethod   string  `json:"contact_method"`
	InvoiceRequired bool    `json:"invoice_required"`
	Remark          string  `json:"remark"`
}

type createInvoiceRequest struct {
	RechargeRequestId  int     `json:"recharge_request_id"`
	RechargeRequestIds []int   `json:"recharge_request_ids"`
	InvoiceType        string  `json:"invoice_type"`
	Title              string  `json:"title"`
	TaxNo              string  `json:"tax_no"`
	Email              string  `json:"email"`
	Address            string  `json:"address"`
	Phone              string  `json:"phone"`
	BankName           string  `json:"bank_name"`
	BankAccount        string  `json:"bank_account"`
	Remark             string  `json:"remark"`
	Amount             float64 `json:"amount"`
}

type reviewRequest struct {
	Remark string `json:"remark"`
}

func sanitizeUploadExt(filename string) (string, error) {
	ext := strings.ToLower(filepath.Ext(filename))
	switch ext {
	case ".jpg", ".jpeg", ".png", ".webp", ".pdf":
		return ext, nil
	default:
		return "", errors.New("unsupported file type")
	}
}

func saveUploadedFile(c *gin.Context, formKey string, prefix string) (string, error) {
	file, err := c.FormFile(formKey)
	if err != nil {
		return "", err
	}
	ext, err := sanitizeUploadExt(file.Filename)
	if err != nil {
		return "", err
	}
	if err = os.MkdirAll(offlineRechargeUploadDir, 0750); err != nil {
		return "", err
	}
	filename := fmt.Sprintf("%s_%d_%s%s", prefix, common.GetTimestamp(), common.GetRandomString(8), ext)
	dst := filepath.Join(offlineRechargeUploadDir, filename)
	if err = c.SaveUploadedFile(file, dst); err != nil {
		return "", err
	}
	return dst, nil
}

func sendLocalFile(c *gin.Context, path string) {
	clean := filepath.Clean(path)
	baseDir := filepath.Clean(offlineRechargeUploadDir)
	if !strings.HasPrefix(clean, baseDir) {
		c.Status(http.StatusForbidden)
		return
	}
	c.File(clean)
}

func GetOfflineRechargeSummary(c *gin.Context) {
	summary, err := model.GetOfflineRechargeSummary(c.GetInt("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, summary)
}

func GetUserOfflineRechargeRequests(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	items, total, err := model.GetUserOfflineRechargeRequests(c.GetInt("id"), pageInfo)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(items)
	common.ApiSuccess(c, pageInfo)
}

func CreateOfflineRechargeRequest(c *gin.Context) {
	var req createOfflineRechargeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	if req.Amount <= 0 {
		common.ApiErrorMsg(c, "amount must be greater than 0")
		return
	}
	username := c.GetString("username")
	item := &model.OfflineRechargeRequest{
		UserId:          c.GetInt("id"),
		Username:        username,
		Amount:          req.Amount,
		ContactName:     req.ContactName,
		ContactMethod:   req.ContactMethod,
		InvoiceRequired: req.InvoiceRequired,
		Remark:          req.Remark,
	}
	if err := model.CreateOfflineRechargeRequest(item); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, item)
}

func UploadOfflineRechargeProof(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	path, err := saveUploadedFile(c, "file", "proof")
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if err = model.UpdateOfflineRechargeProof(id, c.GetInt("id"), path, c.PostForm("payment_remark")); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"payment_proof_url": path})
}

func CancelOfflineRechargeRequest(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	if err := model.CancelOfflineRechargeRequest(id, c.GetInt("id")); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

func GetOfflineRechargeProof(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	req, err := model.GetOfflineRechargeRequestById(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if req.UserId != c.GetInt("id") || req.PaymentProofUrl == "" {
		c.Status(http.StatusForbidden)
		return
	}
	sendLocalFile(c, req.PaymentProofUrl)
}

func AdminGetOfflineRechargeRequests(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	items, total, err := model.GetAllOfflineRechargeRequests(pageInfo, c.Query("status"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(items)
	common.ApiSuccess(c, pageInfo)
}

func AdminCompleteOfflineRechargeRequest(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	var req reviewRequest
	_ = c.ShouldBindJSON(&req)
	if err := model.CompleteOfflineRechargeRequest(id, c.GetInt("id"), req.Remark); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

func AdminRejectOfflineRechargeRequest(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	var req reviewRequest
	_ = c.ShouldBindJSON(&req)
	if err := model.RejectOfflineRechargeRequest(id, c.GetInt("id"), req.Remark); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

func AdminGetOfflineRechargeProof(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	req, err := model.GetOfflineRechargeRequestById(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if req.PaymentProofUrl == "" {
		c.Status(http.StatusNotFound)
		return
	}
	sendLocalFile(c, req.PaymentProofUrl)
}

func GetUserInvoiceRequests(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	items, total, err := model.GetUserInvoiceRequests(c.GetInt("id"), pageInfo)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(items)
	common.ApiSuccess(c, pageInfo)
}

func CreateInvoiceRequest(c *gin.Context) {
	var req createInvoiceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	rechargeIds := normalizeInvoiceRechargeIds(req.RechargeRequestIds, req.RechargeRequestId)
	if len(rechargeIds) == 0 {
		common.ApiErrorMsg(c, "recharge request is not invoiceable")
		return
	}
	recharges, err := model.GetOfflineRechargeRequestsByIds(c.GetInt("id"), rechargeIds)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if len(recharges) != len(rechargeIds) {
		common.ApiErrorMsg(c, "recharge request is not invoiceable")
		return
	}
	rechargeById := make(map[int]*model.OfflineRechargeRequest, len(recharges))
	for _, recharge := range recharges {
		if recharge.Status != model.OfflineRechargeStatusCompleted {
			common.ApiErrorMsg(c, "recharge request is not invoiceable")
			return
		}
		rechargeById[recharge.Id] = recharge
	}
	var amount float64
	requestNos := make([]string, 0, len(rechargeIds))
	for _, id := range rechargeIds {
		recharge := rechargeById[id]
		amount += recharge.Amount
		requestNos = append(requestNos, recharge.RequestNo)
	}
	if amount < 100 {
		common.ApiErrorMsg(c, "invoice amount must be at least 100")
		return
	}
	exists, err := model.HasActiveInvoiceForRecharges(c.GetInt("id"), rechargeIds)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if exists {
		common.ApiErrorMsg(c, "invoice request already exists")
		return
	}
	item := &model.InvoiceRequest{
		UserId:             c.GetInt("id"),
		Username:           c.GetString("username"),
		RechargeRequestId:  rechargeIds[0],
		RechargeRequestIds: model.FormatInvoiceRechargeRequestIds(rechargeIds),
		RechargeRequestNo:  strings.Join(requestNos, ", "),
		Amount:             amount,
		InvoiceType:        req.InvoiceType,
		Title:              req.Title,
		TaxNo:              req.TaxNo,
		Email:              req.Email,
		Address:            req.Address,
		Phone:              req.Phone,
		BankName:           req.BankName,
		BankAccount:        req.BankAccount,
		Remark:             req.Remark,
	}
	if err = model.CreateInvoiceRequest(item); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, item)
}

func normalizeInvoiceRechargeIds(ids []int, fallbackId int) []int {
	result := make([]int, 0, len(ids)+1)
	seen := map[int]bool{}
	for _, id := range ids {
		if id <= 0 || seen[id] {
			continue
		}
		seen[id] = true
		result = append(result, id)
	}
	if len(result) == 0 && fallbackId > 0 {
		result = append(result, fallbackId)
	}
	return result
}

func CancelInvoiceRequest(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	if err := model.CancelInvoiceRequest(id, c.GetInt("id")); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

func GetInvoiceFile(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	req, err := model.GetInvoiceRequestById(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if req.UserId != c.GetInt("id") || req.FileUrl == "" {
		c.Status(http.StatusForbidden)
		return
	}
	sendLocalFile(c, req.FileUrl)
}

func AdminGetInvoiceRequests(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	items, total, err := model.GetAllInvoiceRequests(pageInfo, c.Query("status"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(items)
	common.ApiSuccess(c, pageInfo)
}

func AdminIssueInvoiceRequest(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	fileUrl := ""
	if _, err := c.FormFile("file"); err == nil {
		path, saveErr := saveUploadedFile(c, "file", "invoice")
		if saveErr != nil {
			common.ApiError(c, saveErr)
			return
		}
		fileUrl = path
	}
	if err := model.IssueInvoiceRequest(id, c.GetInt("id"), fileUrl, c.PostForm("remark")); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

func AdminRejectInvoiceRequest(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	var req reviewRequest
	_ = c.ShouldBindJSON(&req)
	if err := model.RejectInvoiceRequest(id, c.GetInt("id"), req.Remark); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

func AdminGetInvoiceFile(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	req, err := model.GetInvoiceRequestById(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if req.FileUrl == "" {
		c.Status(http.StatusNotFound)
		return
	}
	sendLocalFile(c, req.FileUrl)
}
