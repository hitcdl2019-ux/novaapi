package service

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/QuantumNous/new-api/common"
)

const (
	TavilySearchURL = "https://api.tavily.com/search"
	DefaultTimeout  = 10
)

type TavilySearchRequest struct {
	APIKey      string `json:"api_key"`
	Query       string `json:"query"`
	SearchDepth string `json:"search_depth"`
	MaxResults  int    `json:"max_results"`
}

type TavilySearchResult struct {
	Title   string  `json:"title"`
	URL     string  `json:"url"`
	Content string  `json:"content"`
	Score   float64 `json:"score"`
}

type TavilySearchResponse struct {
	Results []TavilySearchResult `json:"results"`
}

func SearchWithTavily(query string) (string, error) {
	apiKey := common.TavilyAPIKey
	if apiKey == "" {
		return "", fmt.Errorf("Tavily API key not configured")
	}

	reqBody := TavilySearchRequest{
		APIKey:      apiKey,
		Query:       query,
		SearchDepth: "basic",
		MaxResults:  5,
	}

	bodyBytes, err := json.Marshal(reqBody)
	if err != nil {
		return "", fmt.Errorf("error marshaling Tavily request: %w", err)
	}

	client := &http.Client{Timeout: time.Duration(DefaultTimeout) * time.Second}
	req, err := http.NewRequest("POST", TavilySearchURL, bytes.NewReader(bodyBytes))
	if err != nil {
		return "", fmt.Errorf("error creating Tavily request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("Tavily API call failed: %w", err)
	}
	defer resp.Body.Close()

	respBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("error reading Tavily response: %w", err)
	}

	if resp.StatusCode != 200 {
		return "", fmt.Errorf("Tavily API returned status %d: %s", resp.StatusCode, string(respBytes))
	}

	var searchResp TavilySearchResponse
	if err := common.Unmarshal(respBytes, &searchResp); err != nil {
		return "", fmt.Errorf("error parsing Tavily response: %w", err)
	}

	if len(searchResp.Results) == 0 {
		return "No search results found.", nil
	}

	// Format results as context for LLM
	result := "Here are the top web search results for the query:\n\n"
	for i, r := range searchResp.Results {
		result += fmt.Sprintf("[%d] %s\n    URL: %s\n    %s\n\n", i+1, r.Title, r.URL, r.Content)
	}
	result += "Please answer the user's question based on the above search results. Cite sources using [1], [2], etc."

	return result, nil
}
