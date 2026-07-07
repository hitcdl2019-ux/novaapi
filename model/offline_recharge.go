package model

import (
	"errors"
	"fmt"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

const (
	OfflineRechargeStatusPendingPayment = "pending_payment"
	OfflineRechargeStatusPendingReview  = "pending_review"
	OfflineRechargeStatusCompleted      = "completed"
	OfflineRechargeStatusRejected       = "rejected"
	OfflineRechargeStatusCancelled      = "cancelled"

	InvoiceStatusPending   = "pending"
	InvoiceStatusIssued    = "issued"
	InvoiceStatusRejected  = "rejected"
	InvoiceStatusCancelled = "cancelled"
)

type OfflineRechargeRequest struct {
	Id              int     `json:"id"`
	RequestNo       string  `json:"request_no" gorm:"unique;type:varchar(64);index"`
	UserId          int     `json:"user_id" gorm:"index"`
	Username        string  `json:"username" gorm:"index;default:''"`
	BusinessNo      string  `json:"business_no" gorm:"-"`
	Amount          float64 `json:"amount" gorm:"type:decimal(18,6);default:0"`
	Quota           int64   `json:"quota" gorm:"default:0"`
	Status          string  `json:"status" gorm:"type:varchar(32);index;default:'pending_payment'"`
	ContactName     string  `json:"contact_name" gorm:"type:varchar(128);default:''"`
	ContactMethod   string  `json:"contact_method" gorm:"type:varchar(255);default:''"`
	InvoiceRequired bool    `json:"invoice_required"`
	Remark          string  `json:"remark" gorm:"type:text"`
	PaymentProofUrl string  `json:"payment_proof_url" gorm:"type:varchar(512);default:''"`
	PaymentRemark   string  `json:"payment_remark" gorm:"type:text"`
	ReviewRemark    string  `json:"review_remark" gorm:"type:text"`
	ReviewedBy      int     `json:"reviewed_by" gorm:"default:0"`
	ReviewedAt      int64   `json:"reviewed_at" gorm:"bigint;default:0"`
	CompletedAt     int64   `json:"completed_at" gorm:"bigint;default:0"`
	CreatedAt       int64   `json:"created_at" gorm:"bigint;index"`
	UpdatedAt       int64   `json:"updated_at" gorm:"bigint;index"`
}

type InvoiceRequest struct {
	Id                 int     `json:"id"`
	InvoiceNo          string  `json:"invoice_no" gorm:"unique;type:varchar(64);index"`
	UserId             int     `json:"user_id" gorm:"index"`
	Username           string  `json:"username" gorm:"index;default:''"`
	RechargeRequestId  int     `json:"recharge_request_id" gorm:"index"`
	RechargeRequestIds string  `json:"recharge_request_ids" gorm:"type:text;default:''"`
	RechargeRequestNo  string  `json:"recharge_request_no" gorm:"type:varchar(64);default:''"`
	Amount             float64 `json:"amount" gorm:"type:decimal(18,6);default:0"`
	Status             string  `json:"status" gorm:"type:varchar(32);index;default:'pending'"`
	InvoiceType        string  `json:"invoice_type" gorm:"type:varchar(32);default:''"`
	Title              string  `json:"title" gorm:"type:varchar(255);default:''"`
	TaxNo              string  `json:"tax_no" gorm:"type:varchar(128);default:''"`
	Email              string  `json:"email" gorm:"type:varchar(255);default:''"`
	Address            string  `json:"address" gorm:"type:varchar(255);default:''"`
	Phone              string  `json:"phone" gorm:"type:varchar(64);default:''"`
	BankName           string  `json:"bank_name" gorm:"type:varchar(255);default:''"`
	BankAccount        string  `json:"bank_account" gorm:"type:varchar(128);default:''"`
	Remark             string  `json:"remark" gorm:"type:text"`
	FileUrl            string  `json:"file_url" gorm:"type:varchar(512);default:''"`
	ReviewRemark       string  `json:"review_remark" gorm:"type:text"`
	ReviewedBy         int     `json:"reviewed_by" gorm:"default:0"`
	ReviewedAt         int64   `json:"reviewed_at" gorm:"bigint;default:0"`
	CreatedAt          int64   `json:"created_at" gorm:"bigint;index"`
	UpdatedAt          int64   `json:"updated_at" gorm:"bigint;index"`
}

type OfflineRechargeSummary struct {
	BalanceAmount     float64 `json:"balance_amount"`
	InvoiceableAmount float64 `json:"invoiceable_amount"`
	PendingCount      int64   `json:"pending_count"`
}

func GenerateOfflineRechargeNo() string {
	return fmt.Sprintf("RC%s%s", common.GetTimeString(), common.GetRandomString(4))
}

func GenerateInvoiceNo() string {
	return fmt.Sprintf("IV%s%s", common.GetTimeString(), common.GetRandomString(4))
}

func CreateOfflineRechargeRequest(req *OfflineRechargeRequest) error {
	now := common.GetTimestamp()
	req.RequestNo = GenerateOfflineRechargeNo()
	req.Status = OfflineRechargeStatusPendingPayment
	req.CreatedAt = now
	req.UpdatedAt = now
	return DB.Create(req).Error
}

func GetUserOfflineRechargeRequests(userId int, pageInfo *common.PageInfo) (items []*OfflineRechargeRequest, total int64, err error) {
	tx := DB.Model(&OfflineRechargeRequest{}).Where("user_id = ?", userId)
	if err = tx.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	err = tx.Order("id desc").Limit(pageInfo.GetPageSize()).Offset(pageInfo.GetStartIdx()).Find(&items).Error
	return items, total, err
}

func GetAllOfflineRechargeRequests(pageInfo *common.PageInfo, status string) (items []*OfflineRechargeRequest, total int64, err error) {
	tx := DB.Model(&OfflineRechargeRequest{})
	if status != "" {
		tx = tx.Where("status = ?", status)
	}
	if err = tx.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	err = tx.Order("id desc").Limit(pageInfo.GetPageSize()).Offset(pageInfo.GetStartIdx()).Find(&items).Error
	if err != nil {
		return nil, 0, err
	}
	fillOfflineRechargeBusinessNos(items)
	return items, total, err
}

func fillOfflineRechargeBusinessNos(items []*OfflineRechargeRequest) {
	if len(items) == 0 {
		return
	}
	userIds := make([]int, 0, len(items))
	seen := make(map[int]bool, len(items))
	for _, item := range items {
		if item.UserId == 0 || seen[item.UserId] {
			continue
		}
		seen[item.UserId] = true
		userIds = append(userIds, item.UserId)
	}
	if len(userIds) == 0 {
		return
	}
	var users []User
	if err := DB.Select("id", "business_no").Where("id in ?", userIds).Find(&users).Error; err != nil {
		return
	}
	businessNoMap := make(map[int]string, len(users))
	for _, user := range users {
		businessNoMap[user.Id] = user.BusinessNo
	}
	for _, item := range items {
		item.BusinessNo = businessNoMap[item.UserId]
	}
}

func GetOfflineRechargeRequestById(id int) (*OfflineRechargeRequest, error) {
	req := &OfflineRechargeRequest{}
	if err := DB.First(req, id).Error; err != nil {
		return nil, err
	}
	return req, nil
}

func GetOfflineRechargeRequestsByIds(userId int, ids []int) ([]*OfflineRechargeRequest, error) {
	var items []*OfflineRechargeRequest
	if len(ids) == 0 {
		return items, nil
	}
	if err := DB.Where("user_id = ? and id in ?", userId, ids).Find(&items).Error; err != nil {
		return nil, err
	}
	return items, nil
}

func UpdateOfflineRechargeProof(id int, userId int, proofUrl string, paymentRemark string) error {
	return DB.Model(&OfflineRechargeRequest{}).
		Where("id = ? and user_id = ? and status in ?", id, userId, []string{OfflineRechargeStatusPendingPayment, OfflineRechargeStatusPendingReview}).
		Updates(map[string]interface{}{
			"payment_proof_url": proofUrl,
			"payment_remark":    paymentRemark,
			"status":            OfflineRechargeStatusPendingReview,
			"updated_at":        common.GetTimestamp(),
		}).Error
}

func CancelOfflineRechargeRequest(id int, userId int) error {
	result := DB.Model(&OfflineRechargeRequest{}).
		Where("id = ? and user_id = ? and status in ?", id, userId, []string{OfflineRechargeStatusPendingPayment, OfflineRechargeStatusPendingReview}).
		Updates(map[string]interface{}{
			"status":     OfflineRechargeStatusCancelled,
			"updated_at": common.GetTimestamp(),
		})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return errors.New("recharge request cannot be cancelled")
	}
	return nil
}

func CompleteOfflineRechargeRequest(id int, adminId int, reviewRemark string) error {
	return DB.Transaction(func(tx *gorm.DB) error {
		req := &OfflineRechargeRequest{}
		if err := tx.Set("gorm:query_option", "FOR UPDATE").First(req, id).Error; err != nil {
			return err
		}
		if req.Status != OfflineRechargeStatusPendingReview {
			return errors.New("only pending review requests can be completed")
		}
		now := common.GetTimestamp()
		// req.Amount is in CNY; convert to USD-equivalent quota units.
		// Balance display converts quota -> USD -> CNY via USDExchangeRate,
		// so dividing by the same rate keeps "paid ¥X" == "credited ¥X".
		rate := operation_setting.USDExchangeRate
		if rate <= 0 {
			rate = 1
		}
		quota := decimal.NewFromFloat(req.Amount).
			Div(decimal.NewFromFloat(rate)).
			Mul(decimal.NewFromFloat(common.QuotaPerUnit)).
			IntPart()
		req.Quota = quota
		req.Status = OfflineRechargeStatusCompleted
		req.ReviewRemark = reviewRemark
		req.ReviewedBy = adminId
		req.ReviewedAt = now
		req.CompletedAt = now
		req.UpdatedAt = now
		if err := tx.Save(req).Error; err != nil {
			return err
		}
		if err := tx.Model(&User{}).Where("id = ?", req.UserId).Update("quota", gorm.Expr("quota + ?", quota)).Error; err != nil {
			return err
		}
		RecordTopupLog(req.UserId, fmt.Sprintf("offline recharge completed, request_no=%s, amount=%.2f, quota=%s", req.RequestNo, req.Amount, logger.FormatQuota(int(quota))), "", "offline", "manual")
		return nil
	})
}

func RejectOfflineRechargeRequest(id int, adminId int, reviewRemark string) error {
	result := DB.Model(&OfflineRechargeRequest{}).
		Where("id = ? and status in ?", id, []string{OfflineRechargeStatusPendingPayment, OfflineRechargeStatusPendingReview}).
		Updates(map[string]interface{}{
			"status":        OfflineRechargeStatusRejected,
			"review_remark": reviewRemark,
			"reviewed_by":   adminId,
			"reviewed_at":   common.GetTimestamp(),
			"updated_at":    common.GetTimestamp(),
		})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return errors.New("recharge request cannot be rejected")
	}
	return nil
}

func CreateInvoiceRequest(req *InvoiceRequest) error {
	now := common.GetTimestamp()
	req.InvoiceNo = GenerateInvoiceNo()
	req.Status = InvoiceStatusPending
	req.CreatedAt = now
	req.UpdatedAt = now
	return DB.Create(req).Error
}

func FormatInvoiceRechargeRequestIds(ids []int) string {
	if len(ids) == 0 {
		return ""
	}
	parts := make([]string, 0, len(ids))
	for _, id := range ids {
		if id > 0 {
			parts = append(parts, strconv.Itoa(id))
		}
	}
	if len(parts) == 0 {
		return ""
	}
	return "," + strings.Join(parts, ",") + ","
}

func ParseInvoiceRechargeRequestIds(raw string, fallbackId int) []int {
	ids := make([]int, 0)
	seen := map[int]bool{}
	for _, part := range strings.Split(raw, ",") {
		id, err := strconv.Atoi(strings.TrimSpace(part))
		if err != nil || id <= 0 || seen[id] {
			continue
		}
		seen[id] = true
		ids = append(ids, id)
	}
	if len(ids) == 0 && fallbackId > 0 {
		ids = append(ids, fallbackId)
	}
	return ids
}

func HasActiveInvoiceForRecharge(userId int, rechargeRequestId int) (bool, error) {
	return HasActiveInvoiceForRecharges(userId, []int{rechargeRequestId})
}

func HasActiveInvoiceForRecharges(userId int, rechargeRequestIds []int) (bool, error) {
	if len(rechargeRequestIds) == 0 {
		return false, nil
	}
	target := map[int]bool{}
	for _, id := range rechargeRequestIds {
		if id > 0 {
			target[id] = true
		}
	}
	if len(target) == 0 {
		return false, nil
	}
	var invoices []InvoiceRequest
	err := DB.Model(&InvoiceRequest{}).
		Select(invoiceRequestSelectColumns()).
		Where("user_id = ? and status in ?", userId, []string{InvoiceStatusPending, InvoiceStatusIssued}).
		Find(&invoices).Error
	if err != nil {
		return false, err
	}
	for _, invoice := range invoices {
		for _, id := range ParseInvoiceRechargeRequestIds(invoice.RechargeRequestIds, invoice.RechargeRequestId) {
			if target[id] {
				return true, nil
			}
		}
	}
	return false, nil
}

func hasActiveInvoiceForRechargeMap(userId int) (map[int]bool, error) {
	used := map[int]bool{}
	var invoices []InvoiceRequest
	err := DB.Model(&InvoiceRequest{}).
		Select(invoiceRequestSelectColumns()).
		Where("user_id = ? and status in ?", userId, []string{InvoiceStatusPending, InvoiceStatusIssued}).
		Find(&invoices).Error
	if err != nil {
		return nil, err
	}
	for _, invoice := range invoices {
		for _, id := range ParseInvoiceRechargeRequestIds(invoice.RechargeRequestIds, invoice.RechargeRequestId) {
			used[id] = true
		}
	}
	return used, nil
}

func invoiceRequestSelectColumns() []string {
	columns := []string{
		"id",
		"invoice_no",
		"user_id",
		"username",
		"recharge_request_id",
		"recharge_request_no",
		"amount",
		"status",
		"invoice_type",
		"title",
		"tax_no",
		"email",
		"address",
		"phone",
		"bank_name",
		"bank_account",
		"remark",
		"file_url",
		"review_remark",
		"reviewed_by",
		"reviewed_at",
		"created_at",
		"updated_at",
	}
	if DB != nil && DB.Migrator().HasColumn(&InvoiceRequest{}, "recharge_request_ids") {
		columns = append(columns, "recharge_request_ids")
	}
	return columns
}

func GetUserInvoiceRequests(userId int, pageInfo *common.PageInfo) (items []*InvoiceRequest, total int64, err error) {
	tx := DB.Model(&InvoiceRequest{}).Where("user_id = ?", userId)
	if err = tx.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	err = tx.Select(invoiceRequestSelectColumns()).Order("id desc").Limit(pageInfo.GetPageSize()).Offset(pageInfo.GetStartIdx()).Find(&items).Error
	return items, total, err
}

func GetAllInvoiceRequests(pageInfo *common.PageInfo, status string) (items []*InvoiceRequest, total int64, err error) {
	tx := DB.Model(&InvoiceRequest{})
	if status != "" {
		tx = tx.Where("status = ?", status)
	}
	if err = tx.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	err = tx.Select(invoiceRequestSelectColumns()).Order("id desc").Limit(pageInfo.GetPageSize()).Offset(pageInfo.GetStartIdx()).Find(&items).Error
	return items, total, err
}

func GetInvoiceRequestById(id int) (*InvoiceRequest, error) {
	req := &InvoiceRequest{}
	if err := DB.Select(invoiceRequestSelectColumns()).First(req, id).Error; err != nil {
		return nil, err
	}
	return req, nil
}

func CancelInvoiceRequest(id int, userId int) error {
	result := DB.Model(&InvoiceRequest{}).
		Where("id = ? and user_id = ? and status = ?", id, userId, InvoiceStatusPending).
		Updates(map[string]interface{}{
			"status":     InvoiceStatusCancelled,
			"updated_at": common.GetTimestamp(),
		})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return errors.New("invoice request cannot be cancelled")
	}
	return nil
}

func IssueInvoiceRequest(id int, adminId int, fileUrl string, reviewRemark string) error {
	result := DB.Model(&InvoiceRequest{}).
		Where("id = ? and status = ?", id, InvoiceStatusPending).
		Updates(map[string]interface{}{
			"status":        InvoiceStatusIssued,
			"file_url":      fileUrl,
			"review_remark": reviewRemark,
			"reviewed_by":   adminId,
			"reviewed_at":   common.GetTimestamp(),
			"updated_at":    common.GetTimestamp(),
		})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return errors.New("invoice request cannot be issued")
	}
	return nil
}

func RejectInvoiceRequest(id int, adminId int, reviewRemark string) error {
	result := DB.Model(&InvoiceRequest{}).
		Where("id = ? and status = ?", id, InvoiceStatusPending).
		Updates(map[string]interface{}{
			"status":        InvoiceStatusRejected,
			"review_remark": reviewRemark,
			"reviewed_by":   adminId,
			"reviewed_at":   common.GetTimestamp(),
			"updated_at":    common.GetTimestamp(),
		})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return errors.New("invoice request cannot be rejected")
	}
	return nil
}

func GetOfflineRechargeSummary(userId int) (OfflineRechargeSummary, error) {
	var user User
	if err := DB.Select("quota").First(&user, userId).Error; err != nil {
		return OfflineRechargeSummary{}, err
	}

	var invoiceable struct {
		Amount float64
	}
	var completedRecharges []OfflineRechargeRequest
	if err := DB.Model(&OfflineRechargeRequest{}).
		Where("user_id = ? and status = ?", userId, OfflineRechargeStatusCompleted).
		Find(&completedRecharges).Error; err != nil {
		return OfflineRechargeSummary{}, err
	}
	invoicedRechargeIds, err := hasActiveInvoiceForRechargeMap(userId)
	if err != nil {
		return OfflineRechargeSummary{}, err
	}
	for _, recharge := range completedRecharges {
		if !invoicedRechargeIds[recharge.Id] {
			invoiceable.Amount += recharge.Amount
		}
	}

	var pendingCount int64
	if err := DB.Model(&OfflineRechargeRequest{}).Where("user_id = ? and status in ?", userId, []string{OfflineRechargeStatusPendingPayment, OfflineRechargeStatusPendingReview}).Count(&pendingCount).Error; err != nil {
		return OfflineRechargeSummary{}, err
	}
	var pendingInvoices int64
	if err := DB.Model(&InvoiceRequest{}).Where("user_id = ? and status = ?", userId, InvoiceStatusPending).Count(&pendingInvoices).Error; err != nil {
		return OfflineRechargeSummary{}, err
	}

	return OfflineRechargeSummary{
		BalanceAmount:     float64(user.Quota) / common.QuotaPerUnit,
		InvoiceableAmount: invoiceable.Amount,
		PendingCount:      pendingCount + pendingInvoices,
	}, nil
}
