package task

import (
	"crypto/rand"
	"sync"
)

// Entry represents a tracked task with generic payload data.
type Entry[T any] struct {
	ID     string
	Key    string
	Status string
	Data   T
	ch     chan struct{}
}

// NewEntry creates an Entry with the given id, key, and initial data.
func NewEntry[T any](id, key string, data T) *Entry[T] {
	return &Entry[T]{
		ID:     id,
		Key:    key,
		Status: "pending",
		Data:   data,
		ch:     make(chan struct{}, 1),
	}
}

// Notify sends a non-blocking signal to Waiters.
func (e *Entry[T]) Notify() {
	select {
	case e.ch <- struct{}{}:
	default:
	}
}

// Wait returns a channel that receives a signal on each Notify.
func (e *Entry[T]) Wait() <-chan struct{} {
	return e.ch
}

// Manager tracks per-user tasks keyed by a string (e.g. platform name).
type Manager[T any] struct {
	mu    sync.RWMutex
	tasks map[int64]map[string]*Entry[T]
}

// NewManager creates an empty Manager.
func NewManager[T any]() *Manager[T] {
	return &Manager[T]{
		tasks: make(map[int64]map[string]*Entry[T]),
	}
}

// Create creates a new Entry for the given user and key.
func (m *Manager[T]) Create(userID int64, key string, initData T) *Entry[T] {
	m.mu.Lock()
	defer m.mu.Unlock()

	if _, ok := m.tasks[userID]; !ok {
		m.tasks[userID] = make(map[string]*Entry[T])
	}

	id := generateID()
	entry := NewEntry(id, key, initData)
	m.tasks[userID][key] = entry
	return entry
}

// Get returns the Entry for a user+key, or nil.
func (m *Manager[T]) Get(userID int64, key string) *Entry[T] {
	m.mu.RLock()
	defer m.mu.RUnlock()

	if keys, ok := m.tasks[userID]; ok {
		return keys[key]
	}
	return nil
}

// GetActive returns the first non-idle Entry for the user, or nil.
func (m *Manager[T]) GetActive(userID int64) *Entry[T] {
	m.mu.RLock()
	defer m.mu.RUnlock()

	keys, ok := m.tasks[userID]
	if !ok {
		return nil
	}
	for _, entry := range keys {
		if entry.Status != "idle" {
			return entry
		}
	}
	return nil
}

// Clear removes all entries for the given user.
func (m *Manager[T]) Clear(userID int64) {
	m.mu.Lock()
	defer m.mu.Unlock()
	delete(m.tasks, userID)
}

// ClearKey removes the entry for a user+key.
func (m *Manager[T]) ClearKey(userID int64, key string) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if keys, ok := m.tasks[userID]; ok {
		delete(keys, key)
	}
}

func generateID() string {
	b := make([]byte, 6)
	rand.Read(b)
	const charset = "0123456789abcdef"
	for i := range b {
		b[i] = charset[b[i]&0x0f]
	}
	return string(b)
}
