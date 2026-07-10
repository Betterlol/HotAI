package controller

import (
	"testing"

	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/assert"
)

func TestPricePerTokenConversion(t *testing.T) {
	tests := []struct {
		name     string
		ratio    float64
		expected float64
	}{
		{"gpt-4o-mini (ratio=0.075)", 0.075, 0.00000015},
		{"gpt-4o (ratio=1)", 1, 0.000002},
		{"deepseek-chat (ratio=0.125)", 0.125, 0.00000025},
		{"zero ratio", 0, 0},
		{"large ratio", 100, 0.0002},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := tt.ratio * pricePerTokenFactor
			assert.InDelta(t, tt.expected, got, 1e-12)
		})
	}
}

func TestResolveModelMappingNilChannel(t *testing.T) {
	m := resolveModelMapping(nil)
	assert.Nil(t, m)
}

func TestResolveModelMappingEmpty(t *testing.T) {
	ch := &model.Channel{}
	m := resolveModelMapping(ch)
	assert.Nil(t, m)
}

func TestResolveModelMappingHappyPath(t *testing.T) {
	mapping := `{"gpt-4o": "gpt-4o-2024-08-06", "gpt-4o-mini": "gpt-4o-mini-2024-07-18"}`
	ch := &model.Channel{ModelMapping: &mapping}
	m := resolveModelMapping(ch)

	assert.NotNil(t, m)
	assert.Equal(t, "gpt-4o-2024-08-06", m["gpt-4o"])
	assert.Equal(t, "gpt-4o-mini-2024-07-18", m["gpt-4o-mini"])
}

func TestResolveModelMappingInvalidJSON(t *testing.T) {
	invalid := `{bad json}`
	ch := &model.Channel{ModelMapping: &invalid}
	m := resolveModelMapping(ch)
	assert.Nil(t, m)
}

func TestResolveModelMappingPartialModels(t *testing.T) {
	mapping := `{"gpt-4o": "gpt-4o-2024-08-06"}`
	ch := &model.Channel{ModelMapping: &mapping}
	m := resolveModelMapping(ch)

	assert.NotNil(t, m)
	assert.Equal(t, "gpt-4o-2024-08-06", m["gpt-4o"])
	_, exists := m["nonexistent"]
	assert.False(t, exists)
}


