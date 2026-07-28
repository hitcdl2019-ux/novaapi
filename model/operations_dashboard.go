package model

import (
	"sort"
	"time"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

type OperationsDashboardSummary struct {
	RechargeAmount       float64 `json:"recharge_amount"`
	InvoiceAmount        float64 `json:"invoice_amount"`
	NewUsers             int64   `json:"new_users"`
	ActiveUsers          int64   `json:"active_users"`
	RequestCount         int64   `json:"request_count"`
	UsedQuota            int64   `json:"used_quota"`
	PendingRechargeCount int64   `json:"pending_recharge_count"`
	PendingInvoiceCount  int64   `json:"pending_invoice_count"`
}

type OperationsTrendPoint struct {
	Date           string  `json:"date"`
	RechargeAmount float64 `json:"recharge_amount"`
	InvoiceAmount  float64 `json:"invoice_amount"`
}

type OperationsTopUser struct {
	UserId   int     `json:"user_id"`
	Username string  `json:"username"`
	Amount   float64 `json:"amount"`
	Quota    int64   `json:"quota"`
}

type OperationsModelRanking struct {
	ModelName    string `json:"model_name"`
	RequestCount int64  `json:"request_count"`
	Quota        int64  `json:"quota"`
}

type OperationsTodoSummary struct {
	PendingRechargeCount  int64   `json:"pending_recharge_count"`
	PendingRechargeAmount float64 `json:"pending_recharge_amount"`
	PendingInvoiceCount   int64   `json:"pending_invoice_count"`
	PendingInvoiceAmount  float64 `json:"pending_invoice_amount"`
}

type OperationsDashboard struct {
	Summary          OperationsDashboardSummary `json:"summary"`
	RevenueTrend     []OperationsTrendPoint     `json:"revenue_trend"`
	TopRechargeUsers []OperationsTopUser        `json:"top_recharge_users"`
	TopConsumeUsers  []OperationsTopUser        `json:"top_consume_users"`
	ModelRanking     []OperationsModelRanking   `json:"model_ranking"`
	Todos            OperationsTodoSummary      `json:"todos"`
}

func GetOperationsDashboard(startTime int64, endTime int64) (OperationsDashboard, error) {
	var dashboard OperationsDashboard
	if startTime <= 0 {
		startTime = time.Now().AddDate(0, 0, -29).Unix()
	}
	if endTime <= 0 {
		endTime = common.GetTimestamp()
	}
	if endTime < startTime {
		startTime, endTime = endTime, startTime
	}

	rechargeRows, err := getOperationsAmountRows(&OfflineRechargeRequest{}, startTime, endTime, "completed_at", OfflineRechargeStatusCompleted)
	if err != nil {
		return dashboard, err
	}
	topUpRows, err := getOperationsTopUpAmountRows(startTime, endTime)
	if err != nil {
		return dashboard, err
	}
	rechargeRows = append(rechargeRows, topUpRows...)
	invoiceRows, err := getOperationsAmountRows(&InvoiceRequest{}, startTime, endTime, "reviewed_at", InvoiceStatusIssued)
	if err != nil {
		return dashboard, err
	}

	for _, row := range rechargeRows {
		dashboard.Summary.RechargeAmount += row.Amount
	}
	for _, row := range invoiceRows {
		dashboard.Summary.InvoiceAmount += row.Amount
	}

	if err := DB.Model(&User{}).Where("created_at >= ? and created_at <= ?", startTime, endTime).Count(&dashboard.Summary.NewUsers).Error; err != nil {
		return dashboard, err
	}
	logDB := operationsLogDB()
	if err := logDB.Model(&Log{}).Where("type = ? and created_at >= ? and created_at <= ?", LogTypeConsume, startTime, endTime).Count(&dashboard.Summary.RequestCount).Error; err != nil {
		return dashboard, err
	}
	if err := logDB.Model(&Log{}).Where("type = ? and created_at >= ? and created_at <= ?", LogTypeConsume, startTime, endTime).Distinct("user_id").Count(&dashboard.Summary.ActiveUsers).Error; err != nil {
		return dashboard, err
	}
	var quotaRow struct {
		Quota int64 `gorm:"column:quota"`
	}
	if err := logDB.Model(&Log{}).
		Select("COALESCE(SUM(quota), 0) as quota").
		Where("type = ? and created_at >= ? and created_at <= ?", LogTypeConsume, startTime, endTime).
		Scan(&quotaRow).Error; err != nil {
		return dashboard, err
	}
	dashboard.Summary.UsedQuota = quotaRow.Quota

	dashboard.RevenueTrend = buildOperationsRevenueTrend(startTime, endTime, rechargeRows, invoiceRows)
	if dashboard.TopRechargeUsers, err = buildOperationsTopRechargeUsers(rechargeRows, 10); err != nil {
		return dashboard, err
	}
	if dashboard.TopConsumeUsers, err = getOperationsTopConsumeUsers(startTime, endTime, 10); err != nil {
		return dashboard, err
	}
	if dashboard.ModelRanking, err = getOperationsModelRanking(startTime, endTime, 10); err != nil {
		return dashboard, err
	}
	if dashboard.Todos, err = getOperationsTodos(); err != nil {
		return dashboard, err
	}
	dashboard.Summary.PendingRechargeCount = dashboard.Todos.PendingRechargeCount
	dashboard.Summary.PendingInvoiceCount = dashboard.Todos.PendingInvoiceCount

	return dashboard, nil
}

type operationsAmountRow struct {
	UserId    int     `gorm:"column:user_id"`
	Amount    float64 `gorm:"column:amount"`
	Timestamp int64   `gorm:"column:op_time"`
}

func getOperationsAmountRows(model interface{}, startTime int64, endTime int64, timeColumn string, status string) ([]operationsAmountRow, error) {
	var rows []operationsAmountRow
	err := DB.Model(model).
		Select("user_id, amount, "+timeColumn+" as op_time").
		Where("status = ? and "+timeColumn+" >= ? and "+timeColumn+" <= ?", status, startTime, endTime).
		Find(&rows).Error
	return rows, err
}

func getOperationsTopUpAmountRows(startTime int64, endTime int64) ([]operationsAmountRow, error) {
	var rows []operationsAmountRow
	err := DB.Model(&TopUp{}).
		Select("user_id, money as amount, complete_time as op_time").
		Where("status = ? and complete_time >= ? and complete_time <= ?", common.TopUpStatusSuccess, startTime, endTime).
		Find(&rows).Error
	return rows, err
}

func buildOperationsRevenueTrend(startTime int64, endTime int64, recharges []operationsAmountRow, invoices []operationsAmountRow) []OperationsTrendPoint {
	points := map[string]*OperationsTrendPoint{}
	start := dayStart(startTime)
	end := dayStart(endTime)
	for ts := start; !ts.After(end); ts = ts.AddDate(0, 0, 1) {
		date := ts.Format("2006-01-02")
		points[date] = &OperationsTrendPoint{Date: date}
	}
	for _, row := range recharges {
		date := time.Unix(row.Timestamp, 0).Local().Format("2006-01-02")
		if points[date] == nil {
			points[date] = &OperationsTrendPoint{Date: date}
		}
		points[date].RechargeAmount += row.Amount
	}
	for _, row := range invoices {
		date := time.Unix(row.Timestamp, 0).Local().Format("2006-01-02")
		if points[date] == nil {
			points[date] = &OperationsTrendPoint{Date: date}
		}
		points[date].InvoiceAmount += row.Amount
	}
	dates := make([]string, 0, len(points))
	for date := range points {
		dates = append(dates, date)
	}
	sort.Strings(dates)
	result := make([]OperationsTrendPoint, 0, len(dates))
	for _, date := range dates {
		result = append(result, *points[date])
	}
	return result
}

func dayStart(timestamp int64) time.Time {
	t := time.Unix(timestamp, 0).Local()
	return time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, t.Location())
}

func operationsLogDB() *gorm.DB {
	if LOG_DB != nil {
		return LOG_DB
	}
	return DB
}

func buildOperationsTopRechargeUsers(rows []operationsAmountRow, limit int) ([]OperationsTopUser, error) {
	amountByUser := map[int]float64{}
	for _, row := range rows {
		if row.UserId > 0 {
			amountByUser[row.UserId] += row.Amount
		}
	}
	if len(amountByUser) == 0 {
		return []OperationsTopUser{}, nil
	}

	userIds := make([]int, 0, len(amountByUser))
	for userId := range amountByUser {
		userIds = append(userIds, userId)
	}
	var users []User
	if err := DB.Select("id", "username").Where("id in ?", userIds).Find(&users).Error; err != nil {
		return nil, err
	}
	usernameById := make(map[int]string, len(users))
	for _, user := range users {
		usernameById[user.Id] = user.Username
	}

	result := make([]OperationsTopUser, 0, len(amountByUser))
	for userId, amount := range amountByUser {
		result = append(result, OperationsTopUser{
			UserId:   userId,
			Username: usernameById[userId],
			Amount:   amount,
		})
	}
	sort.Slice(result, func(i, j int) bool {
		return result[i].Amount > result[j].Amount
	})
	if len(result) > limit {
		result = result[:limit]
	}
	return result, nil
}

func getOperationsTopConsumeUsers(startTime int64, endTime int64, limit int) ([]OperationsTopUser, error) {
	var rows []OperationsTopUser
	err := operationsLogDB().Model(&Log{}).
		Select("user_id, username, SUM(quota) as quota").
		Where("type = ? and created_at >= ? and created_at <= ?", LogTypeConsume, startTime, endTime).
		Group("user_id, username").
		Order("quota desc").
		Limit(limit).
		Scan(&rows).Error
	return rows, err
}

func getOperationsModelRanking(startTime int64, endTime int64, limit int) ([]OperationsModelRanking, error) {
	var rows []OperationsModelRanking
	err := operationsLogDB().Model(&Log{}).
		Select("model_name, COUNT(*) as request_count, SUM(quota) as quota").
		Where("type = ? and created_at >= ? and created_at <= ?", LogTypeConsume, startTime, endTime).
		Group("model_name").
		Order("quota desc").
		Limit(limit).
		Scan(&rows).Error
	return rows, err
}

func getOperationsTodos() (OperationsTodoSummary, error) {
	var todos OperationsTodoSummary
	var recharge struct {
		Count  int64   `gorm:"column:count"`
		Amount float64 `gorm:"column:amount"`
	}
	if err := DB.Model(&OfflineRechargeRequest{}).
		Select("COUNT(*) as count, COALESCE(SUM(amount), 0) as amount").
		Where("status in ?", []string{OfflineRechargeStatusPendingPayment, OfflineRechargeStatusPendingReview}).
		Scan(&recharge).Error; err != nil {
		return todos, err
	}
	todos.PendingRechargeCount = recharge.Count
	todos.PendingRechargeAmount = recharge.Amount

	var invoice struct {
		Count  int64   `gorm:"column:count"`
		Amount float64 `gorm:"column:amount"`
	}
	if err := DB.Model(&InvoiceRequest{}).
		Select("COUNT(*) as count, COALESCE(SUM(amount), 0) as amount").
		Where("status = ?", InvoiceStatusPending).
		Scan(&invoice).Error; err != nil {
		return todos, err
	}
	todos.PendingInvoiceCount = invoice.Count
	todos.PendingInvoiceAmount = invoice.Amount
	return todos, nil
}
